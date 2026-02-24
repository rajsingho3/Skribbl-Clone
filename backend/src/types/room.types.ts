export interface RoomSetting{
    maxPlayers: number;
    rounds: number;
    drawingTime: number;
    wordCount: number;
    hintsenbled: boolean;


}

export enum GamePhase {
  LOBBY = "LOBBY",
  WORD_SELECTION = "WORD_SELECTION",
  DRAWING = "DRAWING",
  ROUND_END = "ROUND_END",
  GAME_OVER = "GAME_OVER",
}

export interface RoomState {
  phase: GamePhase;
  currentRound: number;
  currentDrawerId: string | null;
  word: string | null;
  wordHint: string | null;
}