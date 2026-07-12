import {
  createInitialGameState,
  DEFAULT_GAME_CONFIG,
  EMPTY_INPUT,
  restartGame,
  setInputCaptured,
  stepGame,
  type GameSnapshot,
  type GameConfig,
  type GameState,
  type InputSnapshot,
} from "./GameSimulation";

export type { GamePhase, GameSnapshot, InputSnapshot } from "./GameSimulation";

export class GameRuntime {
  #state: GameState;
  #isInputCaptured = false;
  #config: GameConfig;

  constructor(config?: GameConfig) {
    this.#config = config ?? DEFAULT_GAME_CONFIG;
    this.#state = createInitialGameState(this.#config);
  }

  setInputCaptured(isCaptured: boolean): void {
    this.#isInputCaptured = isCaptured;
    this.#state = setInputCaptured(this.#state, isCaptured);
  }

  restart(config = this.#config): void {
    this.#config = config;
    this.#state = restartGame(this.#state, this.#isInputCaptured, config);
  }

  update(deltaSeconds: number, input: InputSnapshot = EMPTY_INPUT): void {
    this.#state = stepGame(this.#state, input, deltaSeconds, this.#config);
  }

  getSnapshot(): GameSnapshot {
    return this.#state;
  }
}
