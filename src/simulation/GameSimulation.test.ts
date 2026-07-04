import { describe, expect, it } from "vitest";
import {
  createInitialGameState,
  DEFAULT_GAME_CONFIG,
  EMPTY_INPUT,
  restartGame,
  setInputCaptured,
  stepGame,
  type BallState,
  type GameState,
} from "./GameSimulation";

const RUNNING_STATE = createRunningState();

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

  it("starts with a deterministic serve delay toward the player side", () => {
    const captured = setInputCaptured(createInitialGameState(), true);

    expect(captured.phase).toBe("serve-delay");
    expect(captured.nextServeToward).toBe("player");
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

  it("scores for the opponent only after the ball crosses the player Scoring Plane", () => {
    const playerPlane = DEFAULT_GAME_CONFIG.arena.depth / 2 + DEFAULT_GAME_CONFIG.arena.scoringPlaneOffset;
    const beforePlane = stepGame(
      withBall(RUNNING_STATE, {
        position: { x: 0, y: 1.5, z: playerPlane - 0.2 },
        velocity: { x: 0, y: 0, z: 1 },
      }),
      EMPTY_INPUT,
      0.05,
    );

    expect(beforePlane.score.opponent).toBe(0);
    expect(beforePlane.phase).toBe("running");

    const crossedPlane = stepGame(
      withBall(RUNNING_STATE, {
        position: { x: 0, y: 1.5, z: playerPlane - 0.01 },
        velocity: { x: 0, y: 0, z: 1 },
      }),
      EMPTY_INPUT,
      0.05,
    );

    expect(crossedPlane.score.opponent).toBe(1);
    expect(crossedPlane.phase).toBe("serve-delay");
    expect(crossedPlane.nextServeToward).toBe("player");
    expect(crossedPlane.events).toContainEqual({ type: "score", scoringSide: "opponent", lostSide: "player" });
  });

  it("resets the ball and both paddles after a score", () => {
    const playerPlane = DEFAULT_GAME_CONFIG.arena.depth / 2 + DEFAULT_GAME_CONFIG.arena.scoringPlaneOffset;
    const movedState = {
      ...withBall(RUNNING_STATE, {
        position: { x: 1, y: 2, z: playerPlane - 0.01 },
        velocity: { x: 0, y: 0, z: 1 },
      }),
      playerPaddle: {
        ...RUNNING_STATE.playerPaddle,
        position: { x: 2, y: 2.2, z: RUNNING_STATE.playerPaddle.position.z },
      },
    };

    const next = stepGame(movedState, EMPTY_INPUT, 0.05);
    const reset = createInitialGameState();

    expect(next.ball.position).toEqual(reset.ball.position);
    expect(next.ball.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(next.playerPaddle.position).toEqual(reset.playerPaddle.position);
    expect(next.opponentPaddle.position).toEqual(reset.opponentPaddle.position);
  });

  it("serves automatically after the configured delay toward the side that lost the point", () => {
    const scored = {
      ...createInitialGameState(),
      phase: "serve-delay" as const,
      phaseBeforePause: "serve-delay" as const,
      nextServeToward: "player" as const,
      serveTimerSeconds: DEFAULT_GAME_CONFIG.serve.delaySeconds,
    };

    const waiting = advanceGame(scored, DEFAULT_GAME_CONFIG.serve.delaySeconds - 0.05);
    expect(waiting.phase).toBe("serve-delay");
    expect(waiting.ball.velocity.z).toBe(0);

    const served = advanceGame(waiting, 0.05);
    expect(served.phase).toBe("running");
    expect(served.ball.velocity.z).toBeGreaterThan(0);
    expect(served.events).toContainEqual({ type: "serve", toward: "player" });
  });

  it("ends the match when either side reaches the target score", () => {
    const playerPlane = DEFAULT_GAME_CONFIG.arena.depth / 2 + DEFAULT_GAME_CONFIG.arena.scoringPlaneOffset;
    const state = withBall(
      {
        ...RUNNING_STATE,
        score: { player: 0, opponent: DEFAULT_GAME_CONFIG.score.target - 1 },
      },
      {
        position: { x: 0, y: 1.5, z: playerPlane - 0.01 },
        velocity: { x: 0, y: 0, z: 1 },
      },
    );

    const next = stepGame(state, EMPTY_INPUT, 0.05);

    expect(next.phase).toBe("match-over");
    expect(next.winner).toBe("opponent");
    expect(next.score.opponent).toBe(DEFAULT_GAME_CONFIG.score.target);
  });

  it("restarts a completed match without reloading", () => {
    const matchOver = {
      ...RUNNING_STATE,
      phase: "match-over" as const,
      score: { player: 5, opponent: 3 },
      winner: "player" as const,
    };

    const restarted = restartGame(matchOver, true);

    expect(restarted.phase).toBe("serve-delay");
    expect(restarted.score).toEqual({ player: 0, opponent: 0 });
    expect(restarted.winner).toBeNull();
  });

  it("bounces normally off the player paddle when paddle velocity is below the Drag-Hit threshold", () => {
    const next = stepGame(createPlayerHitState({ x: 0, y: 0 }, { x: 0, y: 0 }), EMPTY_INPUT, 0.05);

    expect(next.ball.velocity.z).toBeLessThan(0);
    expect(next.ball.velocity.x).toBeCloseTo(0);
    expect(next.ball.velocity.y).toBeCloseTo(0);
    expect(next.events).toContainEqual({ type: "paddle-hit", side: "player", speed: expect.any(Number) });
  });

  it("uses contact position to change the baseline return angle", () => {
    const left = stepGame(createPlayerHitState({ x: -0.4, y: 0 }, { x: 0, y: 0 }), EMPTY_INPUT, 0.05);
    const right = stepGame(createPlayerHitState({ x: 0.4, y: 0 }, { x: 0, y: 0 }), EMPTY_INPUT, 0.05);

    expect(left.ball.velocity.x).toBeLessThan(0);
    expect(right.ball.velocity.x).toBeGreaterThan(0);
  });

  it("uses Drag-Hit paddle velocity to influence outgoing direction and speed", () => {
    const still = stepGame(createPlayerHitState({ x: 0, y: 0 }, { x: 0, y: 0 }), EMPTY_INPUT, 0.05);
    const dragging = stepGame(createPlayerHitState({ x: 0, y: 0 }, { x: 5, y: 4 }), EMPTY_INPUT, 0.05);

    expect(dragging.ball.velocity.x).toBeGreaterThan(still.ball.velocity.x);
    expect(dragging.ball.velocity.y).toBeGreaterThan(still.ball.velocity.y);
    expect(speedOf(dragging.ball.velocity)).toBeGreaterThan(speedOf(still.ball.velocity));
  });

  it("ignores paddle jitter below the Drag-Hit threshold", () => {
    const jitter = DEFAULT_GAME_CONFIG.collision.dragSpeedThreshold * 0.5;
    const next = stepGame(createPlayerHitState({ x: 0, y: 0 }, { x: jitter, y: 0 }), EMPTY_INPUT, 0.05);

    expect(next.ball.velocity.x).toBeCloseTo(0);
    expect(speedOf(next.ball.velocity)).toBeCloseTo(3);
  });

  it("clamps ball speed after paddle collision", () => {
    const slow = stepGame(
      createPlayerHitState({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0, z: 1 }),
      EMPTY_INPUT,
      0.05,
    );
    const fast = stepGame(
      createPlayerHitState({ x: 0, y: 0 }, { x: 99, y: 99 }, { x: 0, y: 0, z: 40 }),
      EMPTY_INPUT,
      0.05,
    );

    expect(speedOf(slow.ball.velocity)).toBeCloseTo(DEFAULT_GAME_CONFIG.ball.minSpeed);
    expect(speedOf(fast.ball.velocity)).toBeCloseTo(DEFAULT_GAME_CONFIG.ball.maxSpeed);
  });

  it("uses the configurable Forgiving Hitbox beyond the visible paddle", () => {
    const visibleHalfWidth = DEFAULT_GAME_CONFIG.paddle.visibleSize.x / 2;
    const forgivingOffset = DEFAULT_GAME_CONFIG.collision.forgivingHitbox.x * 0.5;
    const next = stepGame(
      createPlayerHitState({ x: visibleHalfWidth + forgivingOffset, y: 0 }, { x: 0, y: 0 }),
      EMPTY_INPUT,
      0.05,
    );

    expect(next.ball.velocity.z).toBeLessThan(0);
    expect(next.events).toContainEqual({ type: "paddle-hit", side: "player", speed: expect.any(Number) });
  });

  it("does not treat the Buffer Zone as a collider", () => {
    const visibleHalfWidth = DEFAULT_GAME_CONFIG.paddle.visibleSize.x / 2;
    const forgivingWidth = DEFAULT_GAME_CONFIG.collision.forgivingHitbox.x;
    const bufferOffset = DEFAULT_GAME_CONFIG.collision.bufferZone.x * 0.5;
    const next = stepGame(
      createPlayerHitState({ x: visibleHalfWidth + forgivingWidth + bufferOffset, y: 0 }, { x: 0, y: 0 }),
      EMPTY_INPUT,
      0.05,
    );

    expect(next.ball.velocity.z).toBeGreaterThan(0);
    expect(next.events).not.toContainEqual({ type: "paddle-hit", side: "player", speed: expect.any(Number) });
  });

  it("bases Drag-Hit on actual clamped paddle velocity, not raw input spikes", () => {
    const next = stepGame(createPlayerHitState({ x: 0, y: 0 }, { x: 0, y: 0 }), { playerMovement: { x: 100, y: 0 } }, 0.05);

    expect(Math.abs(next.playerPaddle.velocity.x)).toBeLessThanOrEqual(DEFAULT_GAME_CONFIG.paddle.maxSpeed);
    expect(speedOf(next.ball.velocity)).toBeLessThanOrEqual(DEFAULT_GAME_CONFIG.ball.maxSpeed);
  });
});

function createRunningState(): GameState {
  const state = setInputCaptured(createInitialGameState(), true);

  return {
    ...state,
    phase: "running",
    phaseBeforePause: "running",
    serveTimerSeconds: 0,
    ball: {
      ...state.ball,
      velocity: { x: 1, y: 1, z: -1 },
    },
  };
}

function advanceGame(state: GameState, seconds: number): GameState {
  let next = state;
  let remaining = seconds;

  while (remaining > 0) {
    const frameSeconds = Math.min(remaining, 0.1);
    next = stepGame(next, EMPTY_INPUT, frameSeconds);
    remaining -= frameSeconds;
  }

  return next;
}

function createPlayerHitState(
  contactOffset: { x: number; y: number },
  paddleVelocity: { x: number; y: number },
  ballVelocity = { x: 0, y: 0, z: 3 },
): GameState {
  const state = createRunningState();
  const contactZ = playerContactCenterZ();
  const paddle = {
    ...state.playerPaddle,
    velocity: { x: paddleVelocity.x, y: paddleVelocity.y, z: 0 },
  };

  return {
    ...state,
    playerPaddle: paddle,
    ball: {
      ...state.ball,
      position: {
        x: paddle.position.x + contactOffset.x,
        y: paddle.position.y + contactOffset.y,
        z: contactZ - 0.03,
      },
      velocity: ballVelocity,
    },
  };
}

function playerContactCenterZ(): number {
  const paddleFaceZ =
    DEFAULT_GAME_CONFIG.paddle.playerArea.z -
    (DEFAULT_GAME_CONFIG.paddle.visibleSize.z / 2 + DEFAULT_GAME_CONFIG.collision.forgivingHitbox.z);

  return paddleFaceZ - DEFAULT_GAME_CONFIG.ball.radius;
}

function speedOf(vector: { x: number; y: number; z: number }): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

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
