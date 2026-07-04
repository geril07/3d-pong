export type GamePhase = "running" | "input-not-captured";

export type GameSnapshot = Readonly<{
  phase: GamePhase;
  activeTimeSeconds: number;
}>;

export class GameRuntime {
  #phase: GamePhase = "input-not-captured";
  #activeTimeSeconds = 0;

  setInputCaptured(isCaptured: boolean): void {
    this.#phase = isCaptured ? "running" : "input-not-captured";
  }

  update(deltaSeconds: number): void {
    if (this.#phase !== "running") {
      return;
    }

    this.#activeTimeSeconds += Math.min(Math.max(deltaSeconds, 0), 0.1);
  }

  getSnapshot(): GameSnapshot {
    return {
      phase: this.#phase,
      activeTimeSeconds: this.#activeTimeSeconds,
    };
  }
}
