import { Server } from "socket.io";


export type GamePhase =
  | "lobby"
  | "word_select"
  | "drawing"
  | "round_end"
  | "game_over";

export interface GameSettings {
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  wordCount: number;
  hints: number;
}

export interface Stroke {
  type: string;
  [key: string]: any;
}

export interface Score {
  id: string;
  name: string;
  score: number;
}

const WORD_BANK = [
  "apple",
  "house",
  "river",
  "phone",
  "guitar",
  "pencil",
  "mountain",
  "tiger",
  "bridge",
  "castle",
  "school",
  "forest",
  "rocket",
  "island",
  "camera",
];

function getRandomWords(count: number): string[] {
  const shuffled = [...WORD_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(1, count));
}


export class Player {
  id: string;
  name: string;
  socketId: string;
  score = 0;
  hasGuessed = false;
  isReady = false;
  isConnected = true;

  constructor(id: string, name: string, socketId: string) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      score: this.score,
      hasGuessed: this.hasGuessed,
      isReady: this.isReady,
      isConnected: this.isConnected,
    };
  }
}


class Game {
  settings: GameSettings;
  round = 0;
  currentDrawerIndex = 0;
  currentWord: string | null = null;
  wordHint: string | null = null;
  phase: GamePhase = "lobby";

  timer: NodeJS.Timeout | null = null;
  wordSelectTimer: NodeJS.Timeout | null = null;

  timeLeft = 0;
  drawOrder: string[] = [];
  strokes: Stroke[] = [];

  hintTimer: NodeJS.Timeout | null = null;
  revealedIndices: Set<number> = new Set();

  currentDrawerId: string | null = null;
  wordOptions: string[] = [];

  constructor(settings: GameSettings) {
    this.settings = settings;
  }

  generateHint(word: string): string {
    return word
      .split("")
      .map((ch, i) => {
        if (ch === " ") return " ";
        if (this.revealedIndices.has(i)) return ch;
        return "_";
      })
      .join("");
  }

  revealNextLetter(word: string): string {
    const hiddenIndices = word
      .split("")
      .map((ch, i) => ({ ch, i }))
      .filter(({ ch, i }) => ch !== " " && !this.revealedIndices.has(i))
      .map(({ i }) => i);

    if (hiddenIndices.length > 0) {
      const idx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
      if (idx !== undefined) {
        this.revealedIndices.add(idx);
      }
    }

    return this.generateHint(word);
  }
}


export class GameRoom {
  id: string;
  hostId: string;
  isPrivate: boolean;
  players: Map<string, Player> = new Map();
  settings: GameSettings;
  game: Game;
  createdAt: number;
  io: Server | null = null;

  constructor(
    id: string,
    hostId: string,
    settings: Partial<GameSettings>,
    isPrivate: boolean = false
  ) {
    this.id = id;
    this.hostId = hostId;
    this.isPrivate = isPrivate;

    this.settings = {
      maxPlayers: settings.maxPlayers ?? 8,
      rounds: settings.rounds ?? 3,
      drawTime: settings.drawTime ?? 80,
      wordCount: settings.wordCount ?? 3,
      hints: settings.hints ?? 2,
    };

    this.game = new Game(this.settings);
    this.createdAt = Date.now();
  }

  setIO(io: Server) {
    this.io = io;
  }

  addPlayer(player: Player) {
    this.players.set(player.id, player);
  }

  removePlayer(playerId: string) {
    this.players.delete(playerId);
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getPlayerList() {
    return Array.from(this.players.values()).map((p) => p.toJSON());
  }

  broadcast(event: string, data: any, excludeId?: string) {
    if (!this.io) return;

    this.players.forEach((player) => {
      if (player.id !== excludeId && player.isConnected) {
        this.io?.to(player.socketId).emit(event, data);
      }
    });
  }

  broadcastAll(event: string, data: any) {
    if (!this.io) return;
    this.io.to(this.id).emit(event, data);
  }

  startGame() {
    this.game.round = 0;
    this.game.drawOrder = Array.from(this.players.keys());

    this.players.forEach((p) => {
      p.score = 0;
      p.hasGuessed = false;
    });

    this.startNextRound();
  }

  startNextRound() {
    const g = this.game;
    g.round++;

    if (g.round > this.settings.rounds * this.players.size) {
      this.endGame();
      return;
    }

    const drawerIndex = (g.round - 1) % g.drawOrder.length;
    const drawerId = g.drawOrder[drawerIndex];
    if (!drawerId) {
      this.startNextRound();
      return;
    }

    const drawer = this.players.get(drawerId);

    if (!drawer) {
      this.startNextRound();
      return;
    }

    g.phase = "word_select";
    g.strokes = [];
    g.revealedIndices.clear();
    this.players.forEach((p) => (p.hasGuessed = false));

    const wordOptions = getRandomWords(this.settings.wordCount);
    g.wordOptions = wordOptions;
    g.currentDrawerId = drawerId;

    this.broadcastAll("round_start", {
      round: g.round,
      totalRounds: this.settings.rounds * this.players.size,
      drawerId,
      drawerName: drawer.name,
      drawTime: this.settings.drawTime,
    });

    this.io?.to(drawer.socketId).emit("word_options", { words: wordOptions });

    g.wordSelectTimer = setTimeout(() => {
      if (g.phase === "word_select") {
        this.chooseWord(wordOptions[0] ?? "apple");
      }
    }, 15000);
  }

  chooseWord(word: string) {
    const g = this.game;

    if (g.wordSelectTimer) clearTimeout(g.wordSelectTimer);

    g.currentWord = word;
    g.wordHint = word.replace(/[^ ]/g, "_");
    g.phase = "drawing";
    g.timeLeft = this.settings.drawTime;
    g.revealedIndices.clear();

    const drawerId = g.currentDrawerId;
    if (!drawerId) return;

    const drawer = this.players.get(drawerId);
    if (!drawer) return;

    this.io?.to(drawer.socketId).emit("word_chosen", {
      word,
      hint: g.wordHint,
    });

    this.broadcast(
      "word_chosen",
      { hint: g.wordHint, wordLength: word.length },
      drawerId
    );

    g.timer = setInterval(() => {
      g.timeLeft--;

      this.broadcastAll("timer_tick", { timeLeft: g.timeLeft });

      if (g.timeLeft <= 0) {
        this.endRound(false);
      }
    }, 1000);
  }

  handleGuess(playerId: string, text: string) {
    const g = this.game;
    const player = this.players.get(playerId);
    if (!player || !g.currentWord) return { correct: false };

    if (playerId === g.currentDrawerId) return { correct: false, isDrawer: true };

    if (player.hasGuessed) return { correct: false, alreadyGuessed: true };

    if (g.phase !== "drawing") return { correct: false };

    const correct = text.trim().toLowerCase() === g.currentWord.toLowerCase();

    if (correct) {
      player.hasGuessed = true;

      const points = Math.max(
        50,
        Math.floor((g.timeLeft / this.settings.drawTime) * 100) + 50
      );

      player.score += points;

      const drawerId = g.currentDrawerId;
      if (drawerId) {
        const drawer = this.players.get(drawerId);
        if (drawer) drawer.score += 25;
      }

      return { correct: true, points, playerName: player.name };
    }

    return { correct: false, playerName: player.name, text };
  }

  endRound(allGuessed: boolean) {
    const g = this.game;

    if (g.timer) {
      clearInterval(g.timer);
      g.timer = null;
    }

    g.phase = "round_end";

    this.broadcastAll("round_end", {
      word: g.currentWord,
      scores: this.getScores(),
      allGuessed,
    });

    setTimeout(() => this.startNextRound(), 5000);
  }

  endGame() {
    const g = this.game;
    g.phase = "game_over";

    const scores = this.getScores();
    const winner = scores[0];

    this.broadcastAll("game_over", { winner, leaderboard: scores });
  }

  getScores(): Score[] {
    return Array.from(this.players.values())
      .map((p) => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  clearCanvas() {
    this.game.strokes = [];
    this.broadcastAll("canvas_cleared", {});
  }

  addStroke(stroke: Stroke) {
    this.game.strokes.push(stroke);
  }

  undoLastStroke() {
    const strokes = this.game.strokes;

    while (strokes.length > 0) {
      const last = strokes.pop();
      if (last?.type === "draw_start") break;
    }
  }

  toPublicInfo() {
    return {
      id: this.id,
      playerCount: this.players.size,
      maxPlayers: this.settings.maxPlayers,
      phase: this.game.phase,
      rounds: this.settings.rounds,
    };
  }
}
