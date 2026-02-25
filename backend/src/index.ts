import { Server } from "socket.io";
import { randomUUID } from "node:crypto";
import { Room } from "./game/room.js";
import { Player } from "./game/player.js";
import { GamePhase, type RoomSetting } from "./types/room.types.js";

const rooms = new Map<string, Room>();
const socketRoomMap = new Map<string, string>();
const roomCleanupTimers = new Map<string, NodeJS.Timeout>();
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

io.on("connection", (socket) => {
  const clearRoomCleanup = (roomId: string) => {
    const timer = roomCleanupTimers.get(roomId);
    if (!timer) return;
    clearTimeout(timer);
    roomCleanupTimers.delete(roomId);
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
        clearRoomCleanup(roomId);
        socketRoomMap.set(socket.id, roomId);
        socket.join(roomId);

        socket.emit("room_created", {
          roomId,
          players: room.getPlayers().map((p) => p.toJSON()),
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

      const chosenWord = randomWord();
      game.setWord(chosenWord);

      io.to(room.id).emit("game_state", {
        phase: game.getPhase(),
        round: game.getRound(),
        drawerId: game.getCurrentDrawer().id,
        drawerName: game.getCurrentDrawer().name,
        wordHint: wordHint(chosenWord),
      });
      io.to(room.id).emit("players_updated", {
        players: room.getPlayers().map((p) => p.toJSON()),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start game";
      socket.emit("error", message);
    }
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

    game.nextTurn();

    if (game.getPhase() === GamePhase.GAME_OVER) {
      io.to(room.id).emit("game_state", {
        phase: game.getPhase(),
        round: game.getRound(),
        drawerId: null,
        drawerName: null,
        wordHint: null,
      });
      return;
    }

    const nextWord = randomWord();
    game.setWord(nextWord);
    io.to(room.id).emit("game_state", {
      phase: game.getPhase(),
      round: game.getRound(),
      drawerId: game.getCurrentDrawer().id,
      drawerName: game.getCurrentDrawer().name,
      wordHint: wordHint(nextWord),
    });
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

    room.removePlayer(socket.id);
    const players = room.getPlayers();
    if (players.length === 0) {
      const timer = setTimeout(() => {
        const latestRoom = rooms.get(roomId);
        if (!latestRoom) return;
        if (latestRoom.getPlayers().length === 0) {
          rooms.delete(roomId);
        }
        roomCleanupTimers.delete(roomId);
      }, 15000);
      roomCleanupTimers.set(roomId, timer);
      return;
    }

    io.to(roomId).emit("player_joined", {
      players: players.map((p) => p.toJSON()),
    });
  });
});
