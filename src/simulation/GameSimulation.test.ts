import { describe, expect, it, vi } from "vitest";
import {
  createInitialGameState,
  createGameConfig,
  DEFAULT_GAME_CONFIG,
  EMPTY_INPUT,
  restartGame,
  setInputCaptured,
  stepGame,
  type BallConfig,
  type BallState,
  type BotConfig,
  type CollisionConfig,
  type GameConfig,
  type GameState,
  type PaddleState,
} from "./GameSimulation";

const RUNNING_STATE = createRunningState();

describe("createGameConfig", () => {
  it("scales the complete ball speed profile and compensates bot timing", () => {
    const config = createGameConfig({ difficulty: "medium", ballSpeed: 2 });

    expect(config.ball.serveSpeed).toBe(DEFAULT_GAME_CONFIG.ball.serveSpeed * 2);
    expect(config.ball.minSpeed).toBe(DEFAULT_GAME_CONFIG.ball.minSpeed * 2);
    expect(config.ball.maxSpeed).toBe(DEFAULT_GAME_CONFIG.ball.maxSpeed * 2);
    expect(config.ball.rallySpeedIncreasePerHit).toBe(DEFAULT_GAME_CONFIG.ball.rallySpeedIncreasePerHit * 2);
    expect(config.bot).toEqual({ maxSpeed: 8.4, reactionSeconds: 0.15, trackingError: 0.5 });
  });

  it("keeps the existing bot as the expert profile", () => {
    expect(createGameConfig({ difficulty: "expert", ballSpeed: 1 }).bot).toEqual(DEFAULT_GAME_CONFIG.bot);
  });
});

describe("stepGame", () => {
  it("initializes with input paused and a deterministic pending first serve", () => {
    const state = createInitialGameState();
    const playerCenter = centerOf(DEFAULT_GAME_CONFIG.paddle.playerArea);

    expect(state.phase).toBe("input-not-captured");
    expect(state.phaseBeforePause).toBe("serve-delay");
    expect(state.serveTimerSeconds).toBe(DEFAULT_GAME_CONFIG.serve.delaySeconds);
    expect(state.nextServeToward).toBe("player");
    expect(state.score).toEqual({ player: 0, opponent: 0 });
    expect(state.winner).toBeNull();
    expect(state.ball.position).toEqual({ x: 0, y: DEFAULT_GAME_CONFIG.arena.height / 2, z: 0 });
    expect(state.ball.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(state.playerTarget).toEqual({ x: playerCenter.x, y: playerCenter.y });
    expect(state.playerPaddle.position).toEqual(playerCenter);
    expect(state.opponentPaddle.position).toEqual(centerOf(DEFAULT_GAME_CONFIG.paddle.opponentArea));
    expect(state.events).toEqual([]);
  });

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

  it("clamps large delta times before moving gameplay", () => {
    const area = DEFAULT_GAME_CONFIG.paddle.playerArea;
    const state = withBall(RUNNING_STATE, {
      position: { x: 0, y: 1.5, z: 0 },
      velocity: { x: 10, y: 0, z: 0 },
    });

    const next = stepGame(state, { playerMovement: { x: 99, y: 0 } }, 1);

    expect(next.activeTimeSeconds).toBeCloseTo(0.1);
    expect(next.ball.position.x).toBeCloseTo(1);
    expect(next.playerPaddle.position.x).toBe(area.maxX);
  });

  it.each([0, -0.25])("ignores %s second delta times", (deltaSeconds) => {
    const next = stepGame(RUNNING_STATE, { playerMovement: { x: 1, y: 1 } }, deltaSeconds);

    expect(next.activeTimeSeconds).toBe(RUNNING_STATE.activeTimeSeconds);
    expect(next.ball).toEqual(RUNNING_STATE.ball);
    expect(next.playerPaddle).toEqual(RUNNING_STATE.playerPaddle);
    expect(next.events).toEqual([]);
  });

  it("does not move gameplay while input is not captured", () => {
    const state = createInitialGameState();
    const next = stepGame(state, EMPTY_INPUT, 0.1);

    expect(next.activeTimeSeconds).toBe(0);
    expect(next.ball.position).toEqual(state.ball.position);
  });

  it("pauses running gameplay and resumes the previous phase without advancing state", () => {
    const paused = setInputCaptured(
      {
        ...RUNNING_STATE,
        events: [{ type: "wall-bounce", axis: "x" }],
      },
      false,
    );
    const steppedWhilePaused = stepGame(paused, { playerMovement: { x: 1, y: 1 } }, 0.1);
    const resumed = setInputCaptured(steppedWhilePaused, true);

    expect(paused.phase).toBe("input-not-captured");
    expect(paused.phaseBeforePause).toBe("running");
    expect(paused.events).toEqual([]);
    expect(steppedWhilePaused.activeTimeSeconds).toBe(RUNNING_STATE.activeTimeSeconds);
    expect(steppedWhilePaused.ball).toEqual(RUNNING_STATE.ball);
    expect(steppedWhilePaused.playerPaddle).toEqual(RUNNING_STATE.playerPaddle);
    expect(resumed.phase).toBe("running");
  });

  it("does not count down a pending serve while input is not captured", () => {
    const serving = setInputCaptured(createInitialGameState(), true);
    const paused = setInputCaptured(serving, false);
    const steppedWhilePaused = stepGame(paused, EMPTY_INPUT, 1);
    const resumed = setInputCaptured(steppedWhilePaused, true);

    expect(steppedWhilePaused.serveTimerSeconds).toBe(DEFAULT_GAME_CONFIG.serve.delaySeconds);
    expect(steppedWhilePaused.ball.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(resumed.phase).toBe("serve-delay");
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

  it("reflects from the left side wall using the ball radius as the boundary", () => {
    const minX = -DEFAULT_GAME_CONFIG.arena.width / 2 + DEFAULT_GAME_CONFIG.ball.radius;
    const state = withBall(RUNNING_STATE, {
      position: { x: minX + 0.01, y: 1.5, z: 0 },
      velocity: { x: -1, y: 0, z: 0 },
    });

    const next = stepGame(state, EMPTY_INPUT, 0.05);

    expect(next.ball.position.x).toBeGreaterThan(minX);
    expect(next.ball.velocity.x).toBeGreaterThan(0);
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

  it("applies the latest player target immediately instead of queueing prior movement", () => {
    const frameSeconds = 1 / 60;
    const firstFrame = stepGame(RUNNING_STATE, { playerMovement: { x: 0.8, y: 0 } }, frameSeconds);
    const reversed = stepGame(firstFrame, { playerMovement: { x: -0.5, y: 0 } }, frameSeconds);
    const idle = stepGame(firstFrame, EMPTY_INPUT, frameSeconds);

    expect(firstFrame.playerTarget.x).toBeCloseTo(RUNNING_STATE.playerPaddle.position.x + 0.8);
    expect(firstFrame.playerPaddle.position.x).toBeCloseTo(firstFrame.playerTarget.x);
    expect(reversed.playerTarget.x).toBeCloseTo(RUNNING_STATE.playerPaddle.position.x + 0.3);
    expect(reversed.playerPaddle.position.x).toBeCloseTo(reversed.playerTarget.x);
    expect(idle.playerPaddle.position.x).toBeCloseTo(firstFrame.playerPaddle.position.x);
  });

  it("clamps player paddle movement at all edges and derives velocity from clamped movement", () => {
    const area = DEFAULT_GAME_CONFIG.paddle.playerArea;
    const deltaSeconds = 0.05;
    const smoothing = DEFAULT_GAME_CONFIG.paddle.velocitySmoothing;
    const nearMax = withPlayerPaddle(RUNNING_STATE, {
      position: { x: area.maxX - 0.01, y: area.maxY - 0.01, z: area.z },
      velocity: { x: 0, y: 0, z: 0 },
    });
    const nearMin = withPlayerPaddle(RUNNING_STATE, {
      position: { x: area.minX + 0.01, y: area.minY + 0.01, z: area.z },
      velocity: { x: 0, y: 0, z: 0 },
    });

    const clampedMax = stepGame(nearMax, { playerMovement: { x: 99, y: 99 } }, deltaSeconds);
    const clampedMin = stepGame(nearMin, { playerMovement: { x: -99, y: -99 } }, deltaSeconds);

    expect(clampedMax.playerPaddle.position).toEqual({ x: area.maxX, y: area.maxY, z: area.z });
    expect(clampedMax.playerPaddle.velocity.x).toBeCloseTo((0.01 / deltaSeconds) * smoothing);
    expect(clampedMax.playerPaddle.velocity.y).toBeCloseTo((0.01 / deltaSeconds) * smoothing);
    expect(clampedMin.playerPaddle.position).toEqual({ x: area.minX, y: area.minY, z: area.z });
    expect(clampedMin.playerPaddle.velocity.x).toBeCloseTo((-0.01 / deltaSeconds) * smoothing);
    expect(clampedMin.playerPaddle.velocity.y).toBeCloseTo((-0.01 / deltaSeconds) * smoothing);
  });

  it("does not turn outward input spikes at a movement edge into paddle velocity", () => {
    const area = DEFAULT_GAME_CONFIG.paddle.playerArea;
    const state = withPlayerPaddle(RUNNING_STATE, {
      position: { x: area.maxX, y: area.maxY, z: area.z },
      velocity: { x: 0, y: 0, z: 0 },
    });

    const next = stepGame(state, { playerMovement: { x: 99, y: 99 } }, 0.05);

    expect(next.playerPaddle.position).toEqual({ x: area.maxX, y: area.maxY, z: area.z });
    expect(next.playerPaddle.velocity).toEqual({ x: 0, y: 0, z: 0 });
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

  it("does not score while the ball center is exactly on either Scoring Plane", () => {
    const playerPlane = DEFAULT_GAME_CONFIG.arena.depth / 2 + DEFAULT_GAME_CONFIG.arena.scoringPlaneOffset;
    const opponentPlane = -DEFAULT_GAME_CONFIG.arena.depth / 2 - DEFAULT_GAME_CONFIG.arena.scoringPlaneOffset;

    const atPlayerPlane = stepGame(
      withBall(RUNNING_STATE, {
        position: { x: 0, y: 1.5, z: playerPlane },
        velocity: { x: 0, y: 0, z: 0 },
      }),
      EMPTY_INPUT,
      0.05,
    );
    const atOpponentPlane = stepGame(
      withBall(RUNNING_STATE, {
        position: { x: 0, y: 1.5, z: opponentPlane },
        velocity: { x: 0, y: 0, z: 0 },
      }),
      EMPTY_INPUT,
      0.05,
    );

    expect(atPlayerPlane.score).toEqual({ player: 0, opponent: 0 });
    expect(atPlayerPlane.phase).toBe("running");
    expect(atOpponentPlane.score).toEqual({ player: 0, opponent: 0 });
    expect(atOpponentPlane.phase).toBe("running");
  });

  it("scores for the player only after the ball crosses the opponent Scoring Plane", () => {
    const opponentPlane = -DEFAULT_GAME_CONFIG.arena.depth / 2 - DEFAULT_GAME_CONFIG.arena.scoringPlaneOffset;
    const beforePlane = stepGame(
      withBall(RUNNING_STATE, {
        position: { x: 0, y: 1.5, z: opponentPlane + 0.2 },
        velocity: { x: 0, y: 0, z: -1 },
      }),
      EMPTY_INPUT,
      0.05,
    );

    expect(beforePlane.score.player).toBe(0);
    expect(beforePlane.phase).toBe("running");

    const crossedPlane = stepGame(
      withBall(RUNNING_STATE, {
        position: { x: 0, y: 1.5, z: opponentPlane + 0.01 },
        velocity: { x: 0, y: 0, z: -1 },
      }),
      EMPTY_INPUT,
      0.05,
    );

    expect(crossedPlane.score.player).toBe(1);
    expect(crossedPlane.phase).toBe("serve-delay");
    expect(crossedPlane.nextServeToward).toBe("opponent");
    expect(crossedPlane.events).toContainEqual({ type: "score", scoringSide: "player", lostSide: "opponent" });
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
        velocity: { x: 4, y: 3, z: 0 },
      },
      opponentPaddle: {
        ...RUNNING_STATE.opponentPaddle,
        position: { x: -1.5, y: 0.8, z: RUNNING_STATE.opponentPaddle.position.z },
        velocity: { x: -2, y: 1, z: 0 },
      },
      bot: {
        target: { x: 1.8, y: 2.4 },
      },
    };

    const next = stepGame(movedState, EMPTY_INPUT, 0.05);
    const reset = createInitialGameState();

    expect(next.phase).toBe("serve-delay");
    expect(next.serveTimerSeconds).toBe(DEFAULT_GAME_CONFIG.serve.delaySeconds);
    expect(next.ball.position).toEqual(reset.ball.position);
    expect(next.ball.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(next.playerTarget).toEqual({ x: reset.playerPaddle.position.x, y: reset.playerPaddle.position.y });
    expect(next.playerPaddle).toEqual(reset.playerPaddle);
    expect(next.opponentPaddle).toEqual(reset.opponentPaddle);
    expect(next.bot).toEqual(reset.bot);
    expect(next.events).toEqual([{ type: "score", scoringSide: "opponent", lostSide: "player" }]);
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

  it("serves toward the opponent after the bot loses the previous point", () => {
    const scored = {
      ...createInitialGameState(),
      phase: "serve-delay" as const,
      phaseBeforePause: "serve-delay" as const,
      nextServeToward: "opponent" as const,
      serveTimerSeconds: 0.05,
    };

    const served = stepGame(scored, EMPTY_INPUT, 0.05);

    expect(served.phase).toBe("running");
    expect(served.ball.velocity.z).toBeLessThan(0);
    expect(served.events).toEqual([{ type: "serve", toward: "opponent" }]);
  });

  it("uses randomized serve aim to change ball direction for the same pending target side", () => {
    const upRightConfig = serveAimConfig({ x: 1, y: 1 });
    const downLeftConfig = serveAimConfig({ x: -1, y: -1 });
    const pendingServe = {
      ...createInitialGameState(upRightConfig),
      phase: "serve-delay" as const,
      phaseBeforePause: "serve-delay" as const,
      nextServeToward: "player" as const,
      serveTimerSeconds: 0.05,
    };
    const upRightServe = stepGame(pendingServe, EMPTY_INPUT, 0.05, upRightConfig);
    const downLeftServe = stepGame(pendingServe, EMPTY_INPUT, 0.05, downLeftConfig);

    expect(upRightServe.events).toContainEqual({ type: "serve", toward: "player" });
    expect(downLeftServe.events).toContainEqual({ type: "serve", toward: "player" });
    expect(upRightServe.ball.velocity.z).toBeGreaterThan(0);
    expect(downLeftServe.ball.velocity.z).toBeGreaterThan(0);
    expect(upRightServe.ball.velocity.x).toBeGreaterThan(0);
    expect(upRightServe.ball.velocity.y).toBeGreaterThan(0);
    expect(downLeftServe.ball.velocity.x).toBeLessThan(0);
    expect(downLeftServe.ball.velocity.y).toBeLessThan(0);
  });

  it("uses default serve aim offsets between center and corner instead of only corner signs", () => {
    const random = vi.spyOn(Math, "random");
    random
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.25);

    try {
      const pendingServe = {
        ...createInitialGameState(),
        phase: "serve-delay" as const,
        phaseBeforePause: "serve-delay" as const,
        nextServeToward: "player" as const,
        serveTimerSeconds: 0.05,
      };
      const served = stepGame(pendingServe, EMPTY_INPUT, 0.05);

      expect(served.events).toContainEqual({ type: "serve", toward: "player" });
      expect(served.ball.velocity.x / served.ball.velocity.z).toBeCloseTo(DEFAULT_GAME_CONFIG.ball.serveX * 0.35);
      expect(served.ball.velocity.y / served.ball.velocity.z).toBeCloseTo(-DEFAULT_GAME_CONFIG.ball.serveY * 0.675);
    } finally {
      random.mockRestore();
    }
  });

  it("clears transient serve events on the next simulation step", () => {
    const scored = {
      ...createInitialGameState(),
      phase: "serve-delay" as const,
      phaseBeforePause: "serve-delay" as const,
      nextServeToward: "player" as const,
      serveTimerSeconds: 0.01,
    };

    const served = stepGame(scored, EMPTY_INPUT, 0.01);
    const next = stepGame(served, EMPTY_INPUT, 0.01);

    expect(served.events).toEqual([{ type: "serve", toward: "player" }]);
    expect(next.events).toEqual([]);
  });

  it("serves toward a reachable point on the player side", () => {
    const config = serveAimConfig({ x: 1, y: 1 });
    let state = setInputCaptured(createInitialGameState(config), true);

    state = advanceGame(state, DEFAULT_GAME_CONFIG.serve.delaySeconds, config);

    while (state.phase === "running" && state.ball.position.z < playerContactCenterZ()) {
      state = stepGame(state, EMPTY_INPUT, 1 / 60, config);
    }

    const halfHitboxWidth = DEFAULT_GAME_CONFIG.paddle.visibleSize.x / 2 + DEFAULT_GAME_CONFIG.collision.forgivingHitbox.x;
    const halfHitboxHeight = DEFAULT_GAME_CONFIG.paddle.visibleSize.y / 2 + DEFAULT_GAME_CONFIG.collision.forgivingHitbox.y;

    expect(state.ball.position.x).toBeLessThanOrEqual(DEFAULT_GAME_CONFIG.paddle.playerArea.maxX + halfHitboxWidth);
    expect(state.ball.position.y).toBeLessThanOrEqual(DEFAULT_GAME_CONFIG.paddle.playerArea.maxY + halfHitboxHeight);
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

  it("restarts non-match states to a fresh game while respecting input capture", () => {
    const running = {
      ...RUNNING_STATE,
      score: { player: 2, opponent: 1 },
      activeTimeSeconds: 12,
    };

    const capturedRestart = restartGame(running, true);
    const uncapturedRestart = restartGame(running, false);

    expect(capturedRestart.phase).toBe("serve-delay");
    expect(capturedRestart.score).toEqual({ player: 0, opponent: 0 });
    expect(capturedRestart.activeTimeSeconds).toBe(0);
    expect(uncapturedRestart.phase).toBe("input-not-captured");
    expect(uncapturedRestart.phaseBeforePause).toBe("serve-delay");
  });

  it("bounces normally off the player paddle when paddle velocity is below the Drag-Hit threshold", () => {
    const next = stepGame(createPlayerHitState({ x: 0, y: 0 }, { x: 0, y: 0 }), EMPTY_INPUT, 0.05);

    expect(next.ball.velocity.z).toBeLessThan(0);
    expect(next.ball.velocity.x).toBeCloseTo(0);
    expect(next.ball.velocity.y).toBeCloseTo(0);
    expect(next.events).toContainEqual({ type: "paddle-hit", side: "player", speed: expect.any(Number) });
  });

  it("hits the player paddle when the ball tunnels across the paddle plane in one step", () => {
    const contactZ = playerContactCenterZ();
    const state = withBall(RUNNING_STATE, {
      position: { x: RUNNING_STATE.playerPaddle.position.x, y: RUNNING_STATE.playerPaddle.position.y, z: contactZ - 1 },
      velocity: { x: 0, y: 0, z: 30 },
    });

    const next = stepGame(state, EMPTY_INPUT, 0.1);

    expect(next.phase).toBe("running");
    expect(next.score).toEqual({ player: 0, opponent: 0 });
    expect(next.ball.velocity.z).toBeLessThan(0);
    expect(speedOf(next.ball.velocity)).toBeCloseTo(DEFAULT_GAME_CONFIG.ball.maxSpeed);
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

  it("uses negative Drag-Hit paddle velocity to pull the return left and down", () => {
    const dragging = stepGame(createPlayerHitState({ x: 0, y: 0 }, { x: -5, y: -4 }), EMPTY_INPUT, 0.05);

    expect(dragging.ball.velocity.x).toBeLessThan(0);
    expect(dragging.ball.velocity.y).toBeLessThan(0);
    expect(speedOf(dragging.ball.velocity)).toBeGreaterThan(3);
  });

  it("ignores paddle jitter below the Drag-Hit threshold", () => {
    const jitter = DEFAULT_GAME_CONFIG.collision.dragSpeedThreshold * 0.5;
    const next = stepGame(createPlayerHitState({ x: 0, y: 0 }, { x: jitter, y: 0 }), EMPTY_INPUT, 0.05);

    expect(next.ball.velocity.x).toBeCloseTo(0);
    expect(speedOf(next.ball.velocity)).toBeCloseTo(3 + DEFAULT_GAME_CONFIG.ball.rallySpeedIncreasePerHit);
  });

  it("does not apply Drag-Hit direction or speed at the exact anti-jitter threshold", () => {
    const threshold = DEFAULT_GAME_CONFIG.collision.dragSpeedThreshold;
    const next = stepGame(createPlayerHitState({ x: 0, y: 0 }, { x: threshold, y: 0 }), EMPTY_INPUT, 0.05);

    expect(next.ball.velocity.x).toBeCloseTo(0);
    expect(next.ball.velocity.y).toBeCloseTo(0);
    expect(speedOf(next.ball.velocity)).toBeCloseTo(3 + DEFAULT_GAME_CONFIG.ball.rallySpeedIncreasePerHit);
  });

  it("adds configurable rally speed after each paddle hit", () => {
    const withoutRamp = stepGame(
      createPlayerHitState({ x: 0, y: 0 }, { x: 0, y: 0 }),
      EMPTY_INPUT,
      0.05,
      ballConfig({ rallySpeedIncreasePerHit: 0 }),
    );
    const withRamp = stepGame(createPlayerHitState({ x: 0, y: 0 }, { x: 0, y: 0 }), EMPTY_INPUT, 0.05);

    expect(speedOf(withoutRamp.ball.velocity)).toBeCloseTo(DEFAULT_GAME_CONFIG.ball.minSpeed);
    expect(speedOf(withRamp.ball.velocity)).toBeCloseTo(3 + DEFAULT_GAME_CONFIG.ball.rallySpeedIncreasePerHit);
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

  it("misses beyond the default Forgiving Hitbox", () => {
    const halfHitboxWidth = DEFAULT_GAME_CONFIG.paddle.visibleSize.x / 2 + DEFAULT_GAME_CONFIG.collision.forgivingHitbox.x;
    const next = stepGame(
      createPlayerHitState({ x: halfHitboxWidth + DEFAULT_GAME_CONFIG.ball.radius + 0.01, y: 0 }, { x: 0, y: 0 }),
      EMPTY_INPUT,
      0.05,
    );

    expect(next.ball.velocity.z).toBeGreaterThan(0);
    expect(next.events).not.toContainEqual({ type: "paddle-hit", side: "player", speed: expect.any(Number) });
  });

  it("uses a custom configurable Forgiving Hitbox beyond the visible paddle", () => {
    const visibleHalfWidth = DEFAULT_GAME_CONFIG.paddle.visibleSize.x / 2;
    const forgivingHitbox = { x: 0.12, y: 0.1, z: 0 };
    const forgivingOffset = DEFAULT_GAME_CONFIG.ball.radius + forgivingHitbox.x * 0.5;
    const config = collisionConfig({
      forgivingHitbox,
    });

    const next = stepGame(
      createPlayerHitState({ x: visibleHalfWidth + forgivingOffset, y: 0 }, { x: 0, y: 0 }),
      EMPTY_INPUT,
      0.05,
      config,
    );

    expect(next.ball.velocity.z).toBeLessThan(0);
    expect(next.events).toContainEqual({ type: "paddle-hit", side: "player", speed: expect.any(Number) });
  });

  it("hits when the ball sphere overlaps the top edge of the visible paddle", () => {
    const visibleHalfHeight = DEFAULT_GAME_CONFIG.paddle.visibleSize.y / 2;
    const next = stepGame(
      createPlayerHitState({ x: 0, y: visibleHalfHeight + DEFAULT_GAME_CONFIG.ball.radius * 0.5 }, { x: 0, y: 0 }),
      EMPTY_INPUT,
      0.05,
    );

    expect(next.ball.velocity.z).toBeLessThan(0);
    expect(next.events).toContainEqual({ type: "paddle-hit", side: "player", speed: expect.any(Number) });
  });

  it("hits when the ball sphere overlaps the visible paddle edge without extra forgiveness", () => {
    const visibleHalfWidth = DEFAULT_GAME_CONFIG.paddle.visibleSize.x / 2;
    const config = collisionConfig({
      forgivingHitbox: { x: 0, y: 0, z: 0 },
    });

    const next = stepGame(
      createPlayerHitState({ x: visibleHalfWidth + DEFAULT_GAME_CONFIG.ball.radius * 0.5, y: 0 }, { x: 0, y: 0 }),
      EMPTY_INPUT,
      0.05,
      config,
    );

    expect(next.ball.velocity.z).toBeLessThan(0);
    expect(next.events).toContainEqual({ type: "paddle-hit", side: "player", speed: expect.any(Number) });
  });

  it("misses just outside the visible paddle plus ball radius", () => {
    const halfHitboxWidth = DEFAULT_GAME_CONFIG.paddle.visibleSize.x / 2 + DEFAULT_GAME_CONFIG.collision.forgivingHitbox.x;
    const next = stepGame(
      createPlayerHitState({ x: halfHitboxWidth + DEFAULT_GAME_CONFIG.ball.radius + 0.01, y: 0 }, { x: 0, y: 0 }),
      EMPTY_INPUT,
      0.05,
    );

    expect(next.ball.velocity.z).toBeGreaterThan(0);
    expect(next.events).not.toContainEqual({ type: "paddle-hit", side: "player", speed: expect.any(Number) });
  });

  it("misses diagonally outside the rounded visible paddle corner", () => {
    const halfHitboxWidth = DEFAULT_GAME_CONFIG.paddle.visibleSize.x / 2 + DEFAULT_GAME_CONFIG.collision.forgivingHitbox.x;
    const halfHitboxHeight = DEFAULT_GAME_CONFIG.paddle.visibleSize.y / 2 + DEFAULT_GAME_CONFIG.collision.forgivingHitbox.y;
    const diagonalOffset = DEFAULT_GAME_CONFIG.ball.radius * 0.8;
    const next = stepGame(
      createPlayerHitState(
        { x: halfHitboxWidth + diagonalOffset, y: halfHitboxHeight + diagonalOffset },
        { x: 0, y: 0 },
      ),
      EMPTY_INPUT,
      0.05,
    );

    expect(Math.hypot(diagonalOffset, diagonalOffset)).toBeGreaterThan(DEFAULT_GAME_CONFIG.ball.radius);
    expect(next.ball.velocity.z).toBeGreaterThan(0);
    expect(next.events).not.toContainEqual({ type: "paddle-hit", side: "player", speed: expect.any(Number) });
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

  it("moves the Default Bot under speed limits without teleporting", () => {
    const state = createBotTrackingState({ x: 2, y: 2.2, z: -2 });
    const next = stepGame(state, EMPTY_INPUT, 0.1, botConfig({ trackingError: 0, reactionSeconds: 0 }));
    const movedDistance = distance2D(state.opponentPaddle.position, next.opponentPaddle.position);

    expect(movedDistance).toBeLessThanOrEqual(DEFAULT_GAME_CONFIG.bot.maxSpeed * 0.1 + 0.000001);
    expect(next.opponentPaddle.position.x).toBeLessThanOrEqual(state.opponentPaddle.movementArea.maxX);
    expect(next.opponentPaddle.position.y).toBeLessThanOrEqual(state.opponentPaddle.movementArea.maxY);
  });

  it("tracks a predicted intercept target for incoming balls", () => {
    const state = createBotTrackingState({ x: 1.2, y: 2.1, z: -1.2 });
    const next = stepGame(state, EMPTY_INPUT, 0.1, botConfig({ trackingError: 0, reactionSeconds: 0 }));

    expect(next.bot.target.x).toBeGreaterThan(0);
    expect(distance2D(next.opponentPaddle.position, next.bot.target)).toBeLessThan(
      distance2D(state.opponentPaddle.position, next.bot.target),
    );
  });

  it("returns the Default Bot target to center while the ball is moving away", () => {
    const area = DEFAULT_GAME_CONFIG.paddle.opponentArea;
    const center = centerOf(area);
    const state = {
      ...createBotTrackingState({ x: 1.4, y: 2.2, z: -2 }),
      opponentPaddle: {
        ...RUNNING_STATE.opponentPaddle,
        position: { x: area.maxX, y: area.maxY, z: area.z },
      },
      bot: { target: { x: area.maxX, y: area.maxY } },
      ball: {
        ...RUNNING_STATE.ball,
        position: { x: 1.4, y: 2.2, z: -2 },
        velocity: { x: 0.2, y: 0.1, z: 3 },
      },
    };

    const next = stepGame(state, EMPTY_INPUT, 0.1, botConfig({ trackingError: 0, reactionSeconds: 0 }));

    expect(next.bot.target).toEqual({ x: center.x, y: center.y });
    expect(distance2D(next.opponentPaddle.position, center)).toBeLessThan(distance2D(state.opponentPaddle.position, center));
  });

  it("keeps the Default Bot target inside its Paddle Movement Area even with tracking error", () => {
    const area = DEFAULT_GAME_CONFIG.paddle.opponentArea;
    const state = createBotTrackingState({ x: 2.5, y: 2.9, z: -1.2 });

    const next = stepGame(state, EMPTY_INPUT, 0.1, botConfig({ trackingError: 10, reactionSeconds: 0 }));

    expect(next.bot.target.x).toBeGreaterThanOrEqual(area.minX);
    expect(next.bot.target.x).toBeLessThanOrEqual(area.maxX);
    expect(next.bot.target.y).toBeGreaterThanOrEqual(area.minY);
    expect(next.bot.target.y).toBeLessThanOrEqual(area.maxY);
  });

  it("applies Default Bot reaction delay instead of snapping to a new target", () => {
    const state = createBotTrackingState({ x: 1.4, y: 2.2, z: -1.2 });
    const instant = stepGame(state, EMPTY_INPUT, 0.1, botConfig({ trackingError: 0, reactionSeconds: 0 }));
    const delayed = stepGame(state, EMPTY_INPUT, 0.1, botConfig({ trackingError: 0, reactionSeconds: 1 }));

    expect(distance2D(delayed.bot.target, state.bot.target)).toBeGreaterThan(0);
    expect(distance2D(delayed.bot.target, state.bot.target)).toBeLessThan(distance2D(instant.bot.target, state.bot.target));
  });

  it("lets the Default Bot miss because of movement limits", () => {
    const state = createOpponentHitState({ x: 1.8, y: 0 }, { x: 0, y: 0 });
    const next = stepGame(state, EMPTY_INPUT, 0.05, botConfig({ maxSpeed: 0, trackingError: 0, reactionSeconds: 0 }));

    expect(next.ball.velocity.z).toBeLessThan(0);
    expect(next.events).not.toContainEqual({ type: "paddle-hit", side: "opponent", speed: expect.any(Number) });
  });

  it("returns bot hits through the shared collision and Drag-Hit rules", () => {
    const state = createOpponentHitState({ x: 0.27, y: 0 }, { x: 0, y: 0 });
    const next = stepGame(state, EMPTY_INPUT, 0.05, botConfig({ maxSpeed: 5.4, trackingError: 0, reactionSeconds: 0 }));

    expect(next.ball.velocity.z).toBeGreaterThan(0);
    expect(next.ball.velocity.x).toBeGreaterThan(0);
    expect(next.events).toContainEqual({ type: "paddle-hit", side: "opponent", speed: expect.any(Number) });
  });

  it("lets Default Bot paddle velocity add Drag-Hit speed through shared rules", () => {
    const state = createOpponentHitState({ x: 0.27, y: 0.2 }, { x: 0, y: 0 });
    const stillBot = stepGame(state, EMPTY_INPUT, 0.05, botConfig({ maxSpeed: 0, trackingError: 0, reactionSeconds: 0 }));
    const movingBot = stepGame(state, EMPTY_INPUT, 0.05, botConfig({ maxSpeed: 5.4, trackingError: 0, reactionSeconds: 0 }));

    expect(stillBot.events).toContainEqual({ type: "paddle-hit", side: "opponent", speed: expect.any(Number) });
    expect(movingBot.events).toContainEqual({ type: "paddle-hit", side: "opponent", speed: expect.any(Number) });
    expect(speedOf(movingBot.ball.velocity)).toBeGreaterThan(speedOf(stillBot.ball.velocity));
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

function advanceGame(state: GameState, seconds: number, config = DEFAULT_GAME_CONFIG): GameState {
  let next = state;
  let remaining = seconds;

  while (remaining > 0) {
    const frameSeconds = Math.min(remaining, 0.1);
    next = stepGame(next, EMPTY_INPUT, frameSeconds, config);
    remaining -= frameSeconds;
  }

  return next;
}

function serveAimConfig(aim: { x: number; y: number }): GameConfig {
  return {
    ...DEFAULT_GAME_CONFIG,
    serve: {
      ...DEFAULT_GAME_CONFIG.serve,
      chooseServeAim: () => aim,
    },
  };
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

function createBotTrackingState(ballPosition: { x: number; y: number; z: number }): GameState {
  return {
    ...createRunningState(),
    ball: {
      ...createRunningState().ball,
      position: ballPosition,
      velocity: { x: 0.3, y: 0.2, z: -3 },
    },
  };
}

function createOpponentHitState(
  contactOffset: { x: number; y: number },
  paddleVelocity: { x: number; y: number },
): GameState {
  const state = createRunningState();
  const contactZ = opponentContactCenterZ();
  const paddle = {
    ...state.opponentPaddle,
    velocity: { x: paddleVelocity.x, y: paddleVelocity.y, z: 0 },
  };

  return {
    ...state,
    opponentPaddle: paddle,
    bot: {
      target: {
        x: paddle.position.x + contactOffset.x,
        y: paddle.position.y + contactOffset.y,
      },
    },
    ball: {
      ...state.ball,
      position: {
        x: paddle.position.x + contactOffset.x,
        y: paddle.position.y + contactOffset.y,
        z: contactZ + 0.03,
      },
      velocity: { x: 0, y: 0, z: -3 },
    },
  };
}

function opponentContactCenterZ(): number {
  const paddleFaceZ =
    DEFAULT_GAME_CONFIG.paddle.opponentArea.z +
    (DEFAULT_GAME_CONFIG.paddle.visibleSize.z / 2 + DEFAULT_GAME_CONFIG.collision.forgivingHitbox.z);

  return paddleFaceZ + DEFAULT_GAME_CONFIG.ball.radius;
}

function speedOf(vector: { x: number; y: number; z: number }): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function distance2D(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function centerOf(area: { minX: number; maxX: number; minY: number; maxY: number; z: number }): { x: number; y: number; z: number } {
  return {
    x: (area.minX + area.maxX) / 2,
    y: (area.minY + area.maxY) / 2,
    z: area.z,
  };
}

function withPlayerPaddle(state: GameState, paddle: Partial<PaddleState>): GameState {
  const position = paddle.position ?? state.playerPaddle.position;

  return {
    ...state,
    playerTarget: {
      x: position.x,
      y: position.y,
    },
    playerPaddle: {
      ...state.playerPaddle,
      ...paddle,
    },
  };
}

function collisionConfig(overrides: Partial<CollisionConfig>): GameConfig {
  return {
    ...DEFAULT_GAME_CONFIG,
    collision: {
      ...DEFAULT_GAME_CONFIG.collision,
      ...overrides,
    },
  };
}

function ballConfig(overrides: Partial<BallConfig>): GameConfig {
  return {
    ...DEFAULT_GAME_CONFIG,
    ball: {
      ...DEFAULT_GAME_CONFIG.ball,
      ...overrides,
    },
  };
}

function botConfig(overrides: Partial<BotConfig>): GameConfig {
  return {
    ...DEFAULT_GAME_CONFIG,
    bot: {
      ...DEFAULT_GAME_CONFIG.bot,
      ...overrides,
    },
  };
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
