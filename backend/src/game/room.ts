import { Player } from "./player.js";
import type { RoomSetting } from "../types/room.types.js";
import { Game } from "./game.js";

export class Room {
  private players: Map<string, Player> = new Map();
  private game: Game | null = null;

  constructor(
    public readonly id: string,
    public settings: RoomSetting
  ) {}

  addPlayer(player: Player) {
    if (this.players.size >= this.settings.maxPlayers) {
      throw new Error("Room is full");
    }

    this.players.set(player.id, player);
  }

  removePlayer(playerId: string) {
    this.players.delete(playerId);
  }

  getPlayers() {
    return Array.from(this.players.values());
  }

  getPlayerById(playerId: string) {
    return this.players.get(playerId) ?? null;
  }

  startGame() {
    if (this.players.size < 2) {
      throw new Error("At least 2 players are required to start");
    }

    this.game = new Game(this.getPlayers(), this.settings.rounds);
    this.game.startGame();
    return this.game;
  }

  getGame() {
    return this.game;
  }
}
