// used in constructor
export interface CreatePlayerParams {
  id: string;
  name: string;
  isHost?: boolean;
}
// used for sending player data to clients

export interface PlayerDTO {
  id: string;
  name: string;
  score: number;
  isguessed: boolean;  
  isReady: boolean;
  }

