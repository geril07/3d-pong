import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_CONFIG, EMPTY_INPUT } from "./GameSimulation";
import { GameRuntime } from "./GameRuntime";

describe("GameRuntime", () => {
  it("keeps gameplay paused until input is captured", () => {
    const runtime = new GameRuntime();
    const initial = runtime.getSnapshot();

    runtime.update(1, { playerMovement: { x: 99, y: 99 } });
    const paused = runtime.getSnapshot();

    expect(paused.phase).toBe("input-not-captured");
    expect(paused.activeTimeSeconds).toBe(0);
    expect(paused.serveTimerSeconds).toBe(initial.serveTimerSeconds);
    expect(paused.ball).toEqual(initial.ball);
    expect(paused.playerPaddle).toEqual(initial.playerPaddle);

    runtime.setInputCaptured(true);

    expect(runtime.getSnapshot().phase).toBe("serve-delay");
  });

  it("preserves runtime input capture state when restarting", () => {
    const runtime = new GameRuntime();

    runtime.setInputCaptured(true);
    advanceRuntime(runtime, DEFAULT_GAME_CONFIG.serve.delaySeconds);
    runtime.restart();

    expect(runtime.getSnapshot().phase).toBe("serve-delay");

    runtime.setInputCaptured(false);
    runtime.restart();

    const restartedWithoutInput = runtime.getSnapshot();
    expect(restartedWithoutInput.phase).toBe("input-not-captured");
    expect(restartedWithoutInput.phaseBeforePause).toBe("serve-delay");
    expect(restartedWithoutInput.score).toEqual({ player: 0, opponent: 0 });
  });

  it("does not advance a running match while runtime input capture is lost", () => {
    const runtime = new GameRuntime();

    runtime.setInputCaptured(true);
    advanceRuntime(runtime, DEFAULT_GAME_CONFIG.serve.delaySeconds);
    const running = runtime.getSnapshot();

    runtime.setInputCaptured(false);
    runtime.update(1, { playerMovement: { x: 99, y: 99 } });
    const paused = runtime.getSnapshot();

    expect(paused.phase).toBe("input-not-captured");
    expect(paused.activeTimeSeconds).toBe(running.activeTimeSeconds);
    expect(paused.ball).toEqual(running.ball);
    expect(paused.playerPaddle).toEqual(running.playerPaddle);

    runtime.setInputCaptured(true);

    expect(runtime.getSnapshot().phase).toBe("running");
  });
});

function advanceRuntime(runtime: GameRuntime, seconds: number): void {
  let remaining = seconds;

  while (remaining > 0) {
    const frameSeconds = Math.min(remaining, 0.1);
    runtime.update(frameSeconds, EMPTY_INPUT);
    remaining -= frameSeconds;
  }
}
