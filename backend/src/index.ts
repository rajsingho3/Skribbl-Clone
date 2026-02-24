import { Server } from "socket.io";
import { Room } from "./game/room.js";
import { Player } from "./game/player.js";
import type { RoomSetting } from "./types/room.types.js";

const rooms = new Map<string, Room>();

const io = new Server(3000, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  socket.on(
    "create_room",
    ({ hostName, settings }: { hostName: string; settings: RoomSetting }) => {
      const roomId = crypto.randomUUID();
      const room = new Room(roomId, settings);

      const host = new Player({
        id: socket.id,
        name: hostName,
        isHost: true,
      });

      room.addPlayer(host);
      rooms.set(roomId, room);
      socket.join(roomId);

      socket.emit("room_created", {
        roomId,
        players: room.getPlayers().map((p) => p.toJSON()),
      });
    }
  );

  socket.on(
    "join_room",
    ({ roomId, playerName }: { roomId: string; playerName: string }) => {
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
      socket.join(roomId);

      io.to(roomId).emit("player_joined", {
        players: room.getPlayers().map((p) => p.toJSON()),
      });
    }
  );

  socket.on("start_game", ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    room.startGame();
    const game = room.getGame();

    io.to(room.id).emit("game_state", {
      phase: game?.getPhase(),
      round: game?.getRound(),
    });
  });
  socket.on("disconnect", () => {
    console.log(`Socket ${socket.id} disconnected`);
  });
});
