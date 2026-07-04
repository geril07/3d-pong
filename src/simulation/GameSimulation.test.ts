import { describe, expect, it } from "vitest";
import {
  createInitialGameState,
  DEFAULT_GAME_CONFIG,
  EMPTY_INPUT,
  setInputCaptured,
  stepGame,
  type BallState,
  type GameState,
} from "./GameSimulation";

const RUNNING_STATE = setInputCaptured(createInitialGameState(), true);

describe("stepGame", () => {
  it("moves the ball from velocity while running", () => {
    const state = withBall(RUNNING_STATE, {
      position: { x: 0, y: 1, z: 0 },
      velocity: { x: 1, y: 2, z: -3 },
    });

    const next = stepGame(state, EMPTY_INPUT, 0.25);

    expect(next.ball.position.x).toBeCloseTo(0.1);
    expect(next.ball.position.y).toBeCloseTo(1.2);
    expect(next.ball.position.z).toBeCloseTo(-0.3);
  });

  it("does not move gameplay while input is not captured", () => {
    const state = createInitialGameState();
    const next = stepGame(state, EMPTY_INPUT, 0.1);

    expect(next.activeTimeSeconds).toBe(0);
    expect(next.ball.position).toEqual(state.ball.position);
  });

  it("bounces the ball off side walls", () => {
    const maxX = DEFAULT_GAME_CONFIG.arena.width / 2 - DEFAULT_GAME_CONFIG.ball.radius;
    const state = withBall(RUNNING_STATE, {
      position: { x: maxX - 0.02, y: 1.5, z: 0 },
      velocity: { x: 2, y: 0, z: 0 },
    });

    const next = stepGame(state, EMPTY_INPUT, 0.05);

    expect(next.ball.position.x).toBeLessThan(maxX);
    expect(next.ball.velocity.x).toBeLessThan(0);
    expect(next.events).toContainEqual({ type: "wall-bounce", axis: "x" });
  });

  it("bounces the ball off the floor", () => {
    const minY = DEFAULT_GAME_CONFIG.ball.radius;
    const state = withBall(RUNNING_STATE, {
      position: { x: 0, y: minY + 0.01, z: 0 },
      velocity: { x: 0, y: -1, z: 0 },
    });

    const next = stepGame(state, EMPTY_INPUT, 0.05);

    expect(next.ball.position.y).toBeGreaterThan(minY);
    expect(next.ball.velocity.y).toBeGreaterThan(0);
    expect(next.events).toContainEqual({ type: "wall-bounce", axis: "y" });
  });

  it("bounces the ball off the ceiling", () => {
    const maxY = DEFAULT_GAME_CONFIG.arena.height - DEFAULT_GAME_CONFIG.ball.radius;
    const state = withBall(RUNNING_STATE, {
      position: { x: 0, y: maxY - 0.01, z: 0 },
      velocity: { x: 0, y: 1, z: 0 },
    });

    const next = stepGame(state, EMPTY_INPUT, 0.05);

    expect(next.ball.position.y).toBeLessThan(maxY);
    expect(next.ball.velocity.y).toBeLessThan(0);
    expect(next.events).toContainEqual({ type: "wall-bounce", axis: "y" });
  });

  it("clamps player paddle movement inside the Paddle Movement Area", () => {
    const next = stepGame(
      RUNNING_STATE,
      { playerMovement: { x: 99, y: -99 } },
      1,
    );

    expect(next.playerPaddle.position.x).toBeLessThanOrEqual(RUNNING_STATE.playerPaddle.movementArea.maxX);
    expect(next.playerPaddle.position.y).toBeGreaterThanOrEqual(RUNNING_STATE.playerPaddle.movementArea.minY);
  });
});

function withBall(
  state: GameState,
  ball: Pick<BallState, "position" | "velocity">,
): GameState {
  return {
    ...state,
    ball: {
      ...state.ball,
      ...ball,
    },
  };
}
