import {
  createInitialGameState,
  EMPTY_INPUT,
  restartGame,
  setInputCaptured,
  stepGame,
  type GameSnapshot,
  type GameState,
  type InputSnapshot,
} from "./GameSimulation";

export type { GamePhase, GameSnapshot, InputSnapshot } from "./GameSimulation";

export class GameRuntime {
  #state: GameState = createInitialGameState();
  #isInputCaptured = false;

  setInputCaptured(isCaptured: boolean): void {
    this.#isInputCaptured = isCaptured;
    this.#state = setInputCaptured(this.#state, isCaptured);
  }

  restart(): void {
    this.#state = restartGame(this.#state, this.#isInputCaptured);
  }

  update(deltaSeconds: number, input: InputSnapshot = EMPTY_INPUT): void {
    this.#state = stepGame(this.#state, input, deltaSeconds);
  }

  getSnapshot(): GameSnapshot {
    return this.#state;
  }
}
