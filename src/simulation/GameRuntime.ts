import {
  createInitialGameState,
  EMPTY_INPUT,
  setInputCaptured,
  stepGame,
  type GameSnapshot,
  type GameState,
  type InputSnapshot,
} from "./GameSimulation";

export type { GamePhase, GameSnapshot, InputSnapshot } from "./GameSimulation";

export class GameRuntime {
  #state: GameState = createInitialGameState();

  setInputCaptured(isCaptured: boolean): void {
    this.#state = setInputCaptured(this.#state, isCaptured);
  }

  update(deltaSeconds: number, input: InputSnapshot = EMPTY_INPUT): void {
    this.#state = stepGame(this.#state, input, deltaSeconds);
  }

  getSnapshot(): GameSnapshot {
    return this.#state;
  }
}
