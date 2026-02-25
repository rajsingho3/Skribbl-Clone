import { Server } from "socket.io";
import { randomUUID } from "node:crypto";
import { Room } from "./game/room.js";
import { Player } from "./game/player.js";
import { GamePhase, type RoomSetting } from "./types/room.types.js";

const rooms = new Map<string, Room>();
const socketRoomMap = new Map<string, string>();
const roomCleanupTimers = new Map<string, NodeJS.Timeout>();
const roomStrokes = new Map<string, StrokeData[]>();
const roomTurnTickers = new Map<string, NodeJS.Timeout>();
const roomTimeLeft = new Map<string, number>();

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
];

type StrokeData = {
  type: "start" | "move";
  x: number;
  y: number;
  color: string;
  size: number;
};

function randomWord() {
  const word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  return word ?? "apple";
}

function wordHint(word: string) {
  return word
    .split("")
    .map(() => "_")
    .join(" ");
}

const io = new Server(3000, {
  cors: {
    origin: "*",
  },
});

function emitGameState(room: Room, word: string) {
  const game = room.getGame();
  if (!game) {
    return;
  }

  const drawer = game.getCurrentDrawer();
  const hint = wordHint(word);

  room.getPlayers().forEach((player) => {
    io.to(player.id).emit("game_state", {
      phase: game.getPhase(),
      round: game.getRound(),
      drawerId: drawer.id,
      drawerName: drawer.name,
      wordHint: player.id === drawer.id ? word : hint,
      isDrawer: player.id === drawer.id,
    });
  });
}

function clearTurnTicker(roomId: string) {
  const ticker = roomTurnTickers.get(roomId);
  if (ticker) {
    clearInterval(ticker);
    roomTurnTickers.delete(roomId);
  }
  roomTimeLeft.delete(roomId);
}

function allGuessersFinished(room: Room): boolean {
  const game = room.getGame();
  if (!game) return false;

  const drawerId = game.getCurrentDrawer().id;
  const guessers = room.getPlayers().filter((player) => player.id !== drawerId);

  if (guessers.length === 0) return false;
  return guessers.every((player) => player.hasGuessed());
}

function advanceTurn(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) {
    clearTurnTicker(roomId);
    return;
  }

  const game = room.getGame();
  if (!game) {
    clearTurnTicker(roomId);
    return;
  }

  clearTurnTicker(roomId);
  game.nextTurn();

  if (game.getPhase() === GamePhase.GAME_OVER) {
    io.to(room.id).emit("game_state", {
      phase: game.getPhase(),
      round: game.getRound(),
      drawerId: null,
      drawerName: null,
      wordHint: null,
      isDrawer: false,
    });
    io.to(room.id).emit("players_updated", {
      players: room.getPlayers().map((p) => p.toJSON()),
    });
    return;
  }

  startTurn(roomId);
}

function startTurn(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  const game = room.getGame();
  if (!game || game.getPhase() === GamePhase.GAME_OVER) return;

  clearTurnTicker(roomId);
  roomStrokes.set(roomId, []);
  io.to(roomId).emit("canvas_cleared", {});

  const chosenWord = randomWord();
  game.setWord(chosenWord);
  emitGameState(room, chosenWord);
  io.to(room.id).emit("players_updated", {
    players: room.getPlayers().map((p) => p.toJSON()),
  });

  const initialTimeLeft = Math.max(1, room.settings.drawingTime);
  roomTimeLeft.set(roomId, initialTimeLeft);
  io.to(roomId).emit("timer_tick", { timeLeft: initialTimeLeft });

  const ticker = setInterval(() => {
    const nextTime = (roomTimeLeft.get(roomId) ?? 1) - 1;

    if (nextTime <= 0) {
      io.to(roomId).emit("timer_tick", { timeLeft: 0 });
      advanceTurn(roomId);
      return;
    }

    roomTimeLeft.set(roomId, nextTime);
    io.to(roomId).emit("timer_tick", { timeLeft: nextTime });
  }, 1000);

  roomTurnTickers.set(roomId, ticker);
}

io.on("connection", (socket) => {
  const clearRoomCleanup = (roomId: string) => {
    const timer = roomCleanupTimers.get(roomId);
    if (!timer) return;
    clearTimeout(timer);
    roomCleanupTimers.delete(roomId);
  };

  const resolveRoomId = (payloadRoomId?: string) => payloadRoomId ?? socketRoomMap.get(socket.id);

  const canDrawInRoom = (room: Room) => {
    const game = room.getGame();
    if (!game || game.getPhase() !== GamePhase.DRAWING) return false;

    const drawer = game.getCurrentDrawer();
    return drawer.id === socket.id;
  };

  socket.on(
    "create_room",
    ({ hostName, settings }: { hostName: string; settings: RoomSetting }) => {
      try {
        const roomId = randomUUID();
        const room = new Room(roomId, settings);

        const host = new Player({
          id: socket.id,
          name: hostName,
          isHost: true,
        });

        room.addPlayer(host);
        rooms.set(roomId, room);
        roomStrokes.set(roomId, []);
        clearRoomCleanup(roomId);
        socketRoomMap.set(socket.id, roomId);
        socket.join(roomId);

        socket.emit("room_created", {
          roomId,
          players: room.getPlayers().map((p) => p.toJSON()),
        });

        socket.emit("canvas_data", {
          strokes: roomStrokes.get(roomId) ?? [],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create room";
        socket.emit("error", message);
      }
    }
  );

  socket.on(
    "join_room",
    ({ roomId, playerName }: { roomId: string; playerName: string }) => {
      try {
        const room = rooms.get(roomId);

        if (!room) {
          socket.emit("error", "Room not found");
          return;
        }

        const player = new Player({
          id: socket.id,
          name: playerName,
        });

        room.addPlayer(player);
        clearRoomCleanup(roomId);
        socketRoomMap.set(socket.id, roomId);
        socket.join(roomId);

        socket.emit("room_joined", {
          roomId,
          players: room.getPlayers().map((p) => p.toJSON()),
        });

        socket.emit("canvas_data", {
          strokes: roomStrokes.get(roomId) ?? [],
        });

        io.to(roomId).emit("player_joined", {
          players: room.getPlayers().map((p) => p.toJSON()),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to join room";
        socket.emit("error", message);
      }
    }
  );

  socket.on("start_game", ({ roomId }: { roomId: string }) => {
    try {
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }

      room.startGame();
      const game = room.getGame();

      if (!game) {
        socket.emit("error", "Could not start game");
        return;
      }

      startTurn(roomId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start game";
      socket.emit("error", message);
    }
  });

  socket.on("draw_start", (payload: { roomId?: string; x: number; y: number; color: string; size: number }) => {
    const roomId = resolveRoomId(payload.roomId);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room || !canDrawInRoom(room)) return;

    const stroke: StrokeData = {
      type: "start",
      x: payload.x,
      y: payload.y,
      color: payload.color,
      size: payload.size,
    };

    const strokes = roomStrokes.get(roomId) ?? [];
    strokes.push(stroke);
    roomStrokes.set(roomId, strokes);

    socket.to(roomId).emit("draw_data", stroke);
  });

  socket.on("draw_move", (payload: { roomId?: string; x: number; y: number }) => {
    const roomId = resolveRoomId(payload.roomId);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room || !canDrawInRoom(room)) return;

    const strokes = roomStrokes.get(roomId);
    const lastStart = strokes?.slice().reverse().find((s) => s.type === "start");
    if (!strokes || !lastStart) return;

    const stroke: StrokeData = {
      type: "move",
      x: payload.x,
      y: payload.y,
      color: lastStart.color,
      size: lastStart.size,
    };

    strokes.push(stroke);
    roomStrokes.set(roomId, strokes);

    socket.to(roomId).emit("draw_data", stroke);
  });

  socket.on("draw_end", (_payload: { roomId?: string }) => {
    // No-op for now. Strokes are segmented by each "start" event.
  });

  socket.on("clear_canvas", ({ roomId }: { roomId?: string }) => {
    const resolvedRoomId = resolveRoomId(roomId);
    if (!resolvedRoomId) return;

    const room = rooms.get(resolvedRoomId);
    if (!room || !canDrawInRoom(room)) return;

    roomStrokes.set(resolvedRoomId, []);
    io.to(resolvedRoomId).emit("canvas_cleared", {});
  });

  socket.on("undo_canvas", ({ roomId }: { roomId?: string }) => {
    const resolvedRoomId = resolveRoomId(roomId);
    if (!resolvedRoomId) return;

    const room = rooms.get(resolvedRoomId);
    if (!room || !canDrawInRoom(room)) return;

    const strokes = roomStrokes.get(resolvedRoomId) ?? [];

    while (strokes.length > 0) {
      const last = strokes.pop();
      if (last?.type === "start") {
        break;
      }
    }

    roomStrokes.set(resolvedRoomId, strokes);
    io.to(resolvedRoomId).emit("canvas_undo", { strokes });
  });

  socket.on("submit_guess", ({ roomId, guess }: { roomId: string; guess: string }) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    const game = room.getGame();
    if (!game || game.getPhase() !== GamePhase.DRAWING) {
      socket.emit("error", "Game is not in guessing phase");
      return;
    }

    const player = room.getPlayerById(socket.id);
    if (!player) {
      socket.emit("error", "Player not in room");
      return;
    }

    const cleanedGuess = guess?.trim() ?? "";
    if (!cleanedGuess) {
      return;
    }

    const correct = game.checkGuess(player, cleanedGuess);
    io.to(room.id).emit("chat_message", {
      playerName: player.name,
      message: cleanedGuess,
      correct,
    });

    if (!correct) {
      return;
    }

    io.to(room.id).emit("players_updated", {
      players: room.getPlayers().map((p) => p.toJSON()),
    });

    if (allGuessersFinished(room)) {
      advanceTurn(room.id);
    }
  });

  socket.on("disconnect", () => {
    const roomId = socketRoomMap.get(socket.id);
    socketRoomMap.delete(socket.id);

    if (!roomId) {
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      return;
    }

    const game = room.getGame();
    const wasCurrentDrawer =
      game?.getPhase() === GamePhase.DRAWING && game.getCurrentDrawer().id === socket.id;

    room.removePlayer(socket.id);
    const players = room.getPlayers();
    if (players.length === 0) {
      clearTurnTicker(roomId);
      const timer = setTimeout(() => {
        const latestRoom = rooms.get(roomId);
        if (!latestRoom) return;
        if (latestRoom.getPlayers().length === 0) {
          rooms.delete(roomId);
          roomStrokes.delete(roomId);
        }
        roomCleanupTimers.delete(roomId);
      }, 15000);
      roomCleanupTimers.set(roomId, timer);
      return;
    }

    io.to(roomId).emit("player_joined", {
      players: players.map((p) => p.toJSON()),
    });

    if (wasCurrentDrawer) {
      advanceTurn(roomId);
    }
  });
});
