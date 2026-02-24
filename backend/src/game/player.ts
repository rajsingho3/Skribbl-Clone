import type { PlayerDTO, CreatePlayerParams } from "../types/player.types.js";

export class Player{
    private score : number = 0;
    private isguessed : boolean = false;
    private isReady : boolean = false;

    public  id : string;
    public name : string;
    public isHost : boolean;


   constructor(params: CreatePlayerParams){
    this.id = params.id;
    this.name = params.name;
    this.isHost = params.isHost || false;
   }

   addScore(points: number){
    this.score += points;
   }

   resetRound(){
    this.isguessed = false;
   }

   toJSON(): PlayerDTO{
    return {
        id: this.id,
        name: this.name,
        score: this.score,                
        isguessed: this.isguessed,
        isReady: this.isReady
    }
   }

   

}

