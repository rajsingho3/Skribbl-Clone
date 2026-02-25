import { Player } from "./player.js";
import { GamePhase } from "../types/room.types.js";

export class Game {
  private round: number = 1;
  private currentDrawerIndex: number = 0;
  private word: string | null = null;
  private phase: GamePhase = GamePhase.LOBBY;

  constructor(
    private players: Player[],
    private totalRounds: number
  ) {}

  startGame() {
    this.phase = GamePhase.WORD_SELECTION;
    this.round = 1;
    this.currentDrawerIndex = 0;
    this.players.forEach((player) => player.resetRound());
  }

  getCurrentDrawer(): Player {
    const drawer = this.players[this.currentDrawerIndex];
    if (!drawer) {
      throw new Error("No current drawer available");
    }
    return drawer;
  }

  setWord(word: string) {
    this.word = word;
    this.phase = GamePhase.DRAWING;
    this.players.forEach((player) => player.resetRound());
  }

  checkGuess(player: Player, guess: string): boolean {
    if (!this.word) return false;
    if (player.id === this.getCurrentDrawer().id) return false;
    if (player.hasGuessed()) return false;

    if (guess.trim().toLowerCase() === this.word.toLowerCase()) {
      player.setGuessed(true);
      player.addScore(10);
      return true;
    }

    return false;
  }

  nextTurn() {
    this.currentDrawerIndex++;

    if (this.currentDrawerIndex >= this.players.length) {
      this.currentDrawerIndex = 0;
      this.round++;
    }

    if (this.round > this.totalRounds) {
      this.phase = GamePhase.GAME_OVER;
    } else {
      this.phase = GamePhase.WORD_SELECTION;
    }

    this.word = null;
    this.players.forEach((player) => player.resetRound());
  }

  getPhase() {
    return this.phase;
  }

  getRound() {
    return this.round;
  }

  getWord() {
    return this.word;
  }

  getPlayers() {
    return this.players;
  }
}
