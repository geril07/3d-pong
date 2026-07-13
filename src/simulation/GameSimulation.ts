export type Side = "player" | "opponent";

export type GamePhase = "running" | "input-not-captured" | "serve-delay" | "match-over";

export type ResumablePhase = "running" | "serve-delay";

export type Vector2 = Readonly<{
  x: number;
  y: number;
}>;

export type Vector3 = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type ArenaConfig = Readonly<{
  width: number;
  height: number;
  depth: number;
  scoringPlaneOffset: number;
}>;

export type MovementArea = Readonly<{
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  z: number;
}>;

export type PaddleConfig = Readonly<{
  visibleSize: Vector3;
  edgeGlowWidth: number;
  maxSpeed: number;
  velocitySmoothing: number;
  playerArea: MovementArea;
  opponentArea: MovementArea;
}>;

export type BallConfig = Readonly<{
  radius: number;
  serveSpeed: number;
  minSpeed: number;
  maxSpeed: number;
  rallySpeedIncreasePerHit: number;
  serveX: number;
  serveY: number;
}>;

export type CollisionConfig = Readonly<{
  forgivingHitbox: Vector3;
  bufferZone: Vector3;
  contactInfluenceX: number;
  contactInfluenceY: number;
  dragDirectionInfluence: number;
  dragSpeedThreshold: number;
  dragSpeedBonusPerVelocity: number;
  maxDragSpeedBonus: number;
}>;

export type BotConfig = Readonly<{
  maxSpeed: number;
  reactionSeconds: number;
  trackingError: number;
}>;

export type ScoreConfig = Readonly<{
  target: number;
}>;

export type ServeConfig = Readonly<{
  delaySeconds: number;
  firstServeToward: Side;
  chooseServeAim: () => Vector2;
}>;

export type InputConfig = Readonly<{
  mouseWorldUnitsPerPixel: number;
}>;

export type GameConfig = Readonly<{
  arena: ArenaConfig;
  ball: BallConfig;
  paddle: PaddleConfig;
  collision: CollisionConfig;
  bot: BotConfig;
  input: InputConfig;
  score: ScoreConfig;
  serve: ServeConfig;
}>;

export type BotDifficulty = "easy" | "medium" | "hard" | "expert";

export type GameSettings = Readonly<{
  difficulty: BotDifficulty;
  ballSpeed: number;
}>;

export type BallState = Readonly<{
  position: Vector3;
  velocity: Vector3;
  radius: number;
}>;

export type PaddleState = Readonly<{
  position: Vector3;
  velocity: Vector3;
  movementArea: MovementArea;
}>;

export type BotState = Readonly<{
  target: Vector2;
}>;

export type GameEvent = Readonly<{
  type: "wall-bounce";
  axis: "x" | "y";
}> | Readonly<{
  type: "score";
  scoringSide: Side;
  lostSide: Side;
}> | Readonly<{
  type: "serve";
  toward: Side;
}> | Readonly<{
  type: "paddle-hit";
  side: Side;
  speed: number;
}>;

export type InputSnapshot = Readonly<{
  playerMovement: Vector2;
}>;

export type GameState = Readonly<{
  phase: GamePhase;
  phaseBeforePause: ResumablePhase;
  activeTimeSeconds: number;
  serveTimerSeconds: number;
  nextServeToward: Side;
  score: Readonly<Record<Side, number>>;
  winner: Side | null;
  ball: BallState;
  playerTarget: Vector2;
  playerPaddle: PaddleState;
  opponentPaddle: PaddleState;
  bot: BotState;
  events: readonly GameEvent[];
}>;

export type GameSnapshot = GameState;

const DEFAULT_ARENA: ArenaConfig = {
  width: 9.36,
  height: 4.608,
  depth: 9.2,
  scoringPlaneOffset: 0.45,
};

const DEFAULT_PADDLE_VISIBLE_SIZE: Vector3 = {
  x: 0.9,
  y: 0.6,
  z: 0.12,
};

const DEFAULT_PADDLE_EDGE_GLOW_WIDTH = 0.14;

const DEFAULT_COLLISION: CollisionConfig = {
  forgivingHitbox: {
    x: 0.08,
    y: 0.05,
    z: 0.03,
  },
  bufferZone: {
    x: 0.45,
    y: 0.3,
    z: 0.25,
  },
  contactInfluenceX: 0.85,
  contactInfluenceY: 0.65,
  dragDirectionInfluence: 0.055,
  dragSpeedThreshold: 1.1,
  dragSpeedBonusPerVelocity: 0.18,
  maxDragSpeedBonus: 1.25,
};

export const DEFAULT_GAME_CONFIG: GameConfig = {
  arena: DEFAULT_ARENA,
  ball: {
    radius: 0.13,
    serveSpeed: 4.5,
    minSpeed: 3.2,
    maxSpeed: 8,
    rallySpeedIncreasePerHit: 0.5,
    serveX: 0.35,
    serveY: 0.18,
  },
  paddle: {
    visibleSize: DEFAULT_PADDLE_VISIBLE_SIZE,
    edgeGlowWidth: DEFAULT_PADDLE_EDGE_GLOW_WIDTH,
    maxSpeed: 8,
    velocitySmoothing: 0.7,
    playerArea: createPaddleMovementArea(4.35),
    opponentArea: createPaddleMovementArea(-4.35),
  },
  collision: DEFAULT_COLLISION,
  bot: {
    maxSpeed: 5.4,
    reactionSeconds: 0.18,
    trackingError: 0.18,
  },
  input: {
    mouseWorldUnitsPerPixel: 0.01,
  },
  score: {
    target: 5,
  },
  serve: {
    delaySeconds: 0.9,
    firstServeToward: "player",
    chooseServeAim: () => ({
      x: randomSignedServeOffsetFactor(),
      y: randomSignedServeOffsetFactor(),
    }),
  },
};

function createPaddleMovementArea(z: number): MovementArea {
  const halfWidth = DEFAULT_PADDLE_VISIBLE_SIZE.x / 2 + Math.max(
    DEFAULT_COLLISION.forgivingHitbox.x,
    DEFAULT_PADDLE_EDGE_GLOW_WIDTH,
  );
  const halfHeight = DEFAULT_PADDLE_VISIBLE_SIZE.y / 2 + Math.max(
    DEFAULT_COLLISION.forgivingHitbox.y,
    DEFAULT_PADDLE_EDGE_GLOW_WIDTH,
  );

  return {
    minX: -DEFAULT_ARENA.width / 2 + halfWidth,
    maxX: DEFAULT_ARENA.width / 2 - halfWidth,
    minY: halfHeight,
    maxY: DEFAULT_ARENA.height - halfHeight,
    z,
  };
}

const BOT_DIFFICULTIES: Readonly<Record<BotDifficulty, BotConfig>> = {
  easy: { maxSpeed: 3.2, reactionSeconds: 0.45, trackingError: 0.75 },
  medium: { maxSpeed: 4.2, reactionSeconds: 0.3, trackingError: 0.5 },
  hard: { maxSpeed: 4.8, reactionSeconds: 0.22, trackingError: 0.3 },
  expert: DEFAULT_GAME_CONFIG.bot,
};

export function createGameConfig(settings: GameSettings): GameConfig {
  const bot = BOT_DIFFICULTIES[settings.difficulty];
  const speed = settings.ballSpeed;

  return {
    ...DEFAULT_GAME_CONFIG,
    ball: {
      ...DEFAULT_GAME_CONFIG.ball,
      serveSpeed: DEFAULT_GAME_CONFIG.ball.serveSpeed * speed,
      minSpeed: DEFAULT_GAME_CONFIG.ball.minSpeed * speed,
      maxSpeed: DEFAULT_GAME_CONFIG.ball.maxSpeed * speed,
      rallySpeedIncreasePerHit: DEFAULT_GAME_CONFIG.ball.rallySpeedIncreasePerHit * speed,
    },
    bot: {
      ...bot,
      maxSpeed: bot.maxSpeed * speed,
      reactionSeconds: bot.reactionSeconds / speed,
    },
  };
}

export const EMPTY_INPUT: InputSnapshot = {
  playerMovement: {
    x: 0,
    y: 0,
  },
};

const SERVE_TIMER_EPSILON = 0.000001;
const MIN_SERVE_AIM_OFFSET_FACTOR = 0.35;

function randomSignedServeOffsetFactor(): number {
  const magnitude = lerp(MIN_SERVE_AIM_OFFSET_FACTOR, 1, Math.random());

  return Math.random() < 0.5 ? -magnitude : magnitude;
}

export function createInitialGameState(config = DEFAULT_GAME_CONFIG): GameState {
  const playerPaddle = createPaddle(config.paddle.playerArea);
  const opponentPaddle = createPaddle(config.paddle.opponentArea);

  return {
    phase: "input-not-captured",
    phaseBeforePause: "serve-delay",
    activeTimeSeconds: 0,
    serveTimerSeconds: config.serve.delaySeconds,
    nextServeToward: config.serve.firstServeToward,
    score: { player: 0, opponent: 0 },
    winner: null,
    ball: {
      ...createResetBall(config),
      radius: config.ball.radius,
    },
    playerTarget: {
      x: playerPaddle.position.x,
      y: playerPaddle.position.y,
    },
    playerPaddle,
    opponentPaddle,
    bot: createBotState(config.paddle.opponentArea),
    events: [],
  };
}

export function setInputCaptured(state: GameState, isCaptured: boolean): GameState {
  if (state.phase === "match-over") {
    return {
      ...state,
      events: [],
    };
  }

  if (isCaptured) {
    return {
      ...state,
      phase: state.phase === "input-not-captured" ? state.phaseBeforePause : state.phase,
      events: [],
    };
  }

  return {
    ...state,
    phaseBeforePause: state.phase === "input-not-captured" ? state.phaseBeforePause : state.phase,
    phase: "input-not-captured",
    events: [],
  };
}

export function restartGame(state: GameState, isInputCaptured: boolean, config = DEFAULT_GAME_CONFIG): GameState {
  return setInputCaptured(createInitialGameState(config), isInputCaptured && state.phase !== "input-not-captured");
}

export function stepGame(
  state: GameState,
  input: InputSnapshot,
  deltaSeconds: number,
  config = DEFAULT_GAME_CONFIG,
): GameState {
  const dt = clamp(deltaSeconds, 0, 0.1);

  if (state.phase !== "running" && state.phase !== "serve-delay") {
    return {
      ...state,
      events: [],
    };
  }

  if (dt === 0) {
    return { ...state, events: [] };
  }

  const playerTarget = movePlayerTarget(state.playerTarget, input.playerMovement, state.playerPaddle.movementArea);
  const playerPaddle = movePaddleTowardTarget(state.playerPaddle, playerTarget, dt, config);

  if (state.phase === "serve-delay") {
    return stepServeDelay(state, playerTarget, playerPaddle, dt, config);
  }

  const botStep = moveBot(state.opponentPaddle, state.bot, state.ball, state.activeTimeSeconds, dt, config);
  const ballStep = moveBall(state.ball, dt, config);
  const hitResult = resolvePaddleCollision(state.ball, ballStep.ball, playerPaddle, "player", config);
  const opponentHitResult = hitResult
    ? null
    : resolvePaddleCollision(state.ball, ballStep.ball, botStep.paddle, "opponent", config);
  const ball = hitResult?.ball ?? opponentHitResult?.ball ?? ballStep.ball;
  const events = [
    ...ballStep.events,
    ...(hitResult ? [hitResult.event] : []),
    ...(opponentHitResult ? [opponentHitResult.event] : []),
  ];
  const scoreEvent = getScoreEvent(ball, config);

  if (scoreEvent) {
    return applyScore(state, scoreEvent, dt, config);
  }

  return {
    ...state,
    activeTimeSeconds: state.activeTimeSeconds + dt,
    ball,
    playerTarget,
    playerPaddle,
    opponentPaddle: botStep.paddle,
    bot: botStep.bot,
    events,
  };
}

function stepServeDelay(
  state: GameState,
  playerTarget: Vector2,
  playerPaddle: PaddleState,
  deltaSeconds: number,
  config: GameConfig,
): GameState {
  const serveTimerSeconds = Math.max(state.serveTimerSeconds - deltaSeconds, 0);

  if (serveTimerSeconds > SERVE_TIMER_EPSILON) {
    return {
      ...state,
      activeTimeSeconds: state.activeTimeSeconds + deltaSeconds,
      serveTimerSeconds,
      playerTarget,
      playerPaddle,
      opponentPaddle: {
        ...state.opponentPaddle,
        velocity: { x: 0, y: 0, z: 0 },
      },
      events: [],
    };
  }

  return {
    ...state,
    phase: "running",
    phaseBeforePause: "running",
    activeTimeSeconds: state.activeTimeSeconds + deltaSeconds,
    serveTimerSeconds: 0,
    playerTarget,
    ball: {
      ...state.ball,
      velocity: createServeVelocity(state.nextServeToward, config),
    },
    playerPaddle,
    opponentPaddle: {
      ...state.opponentPaddle,
      velocity: { x: 0, y: 0, z: 0 },
    },
    events: [{ type: "serve", toward: state.nextServeToward }],
  };
}

function applyScore(
  state: GameState,
  scoreEvent: Extract<GameEvent, { type: "score" }>,
  deltaSeconds: number,
  config: GameConfig,
): GameState {
  const playerPaddle = createPaddle(config.paddle.playerArea);
  const opponentPaddle = createPaddle(config.paddle.opponentArea);
  const score = {
    ...state.score,
    [scoreEvent.scoringSide]: state.score[scoreEvent.scoringSide] + 1,
  };
  const winner = score[scoreEvent.scoringSide] >= config.score.target ? scoreEvent.scoringSide : null;
  const phase = winner ? "match-over" : "serve-delay";

  return {
    ...state,
    phase,
    phaseBeforePause: winner ? state.phaseBeforePause : "serve-delay",
    activeTimeSeconds: state.activeTimeSeconds + deltaSeconds,
    serveTimerSeconds: winner ? 0 : config.serve.delaySeconds,
    nextServeToward: scoreEvent.lostSide,
    score,
    winner,
    ball: {
      ...createResetBall(config),
      radius: state.ball.radius,
    },
    playerTarget: {
      x: playerPaddle.position.x,
      y: playerPaddle.position.y,
    },
    playerPaddle,
    opponentPaddle,
    bot: createBotState(config.paddle.opponentArea),
    events: [scoreEvent],
  };
}

function getScoreEvent(ball: BallState, config: GameConfig): Extract<GameEvent, { type: "score" }> | null {
  const playerScoringPlane = config.arena.depth / 2 + config.arena.scoringPlaneOffset;
  const opponentScoringPlane = -config.arena.depth / 2 - config.arena.scoringPlaneOffset;

  if (ball.position.z > playerScoringPlane) {
    return { type: "score", scoringSide: "opponent", lostSide: "player" };
  }

  if (ball.position.z < opponentScoringPlane) {
    return { type: "score", scoringSide: "player", lostSide: "opponent" };
  }

  return null;
}

function createResetBall(config: GameConfig): Omit<BallState, "radius"> {
  return {
    position: {
      x: 0,
      y: config.arena.height / 2,
      z: 0,
    },
    velocity: { x: 0, y: 0, z: 0 },
  };
}

function createServeVelocity(toward: Side, config: GameConfig): Vector3 {
  const zDirection = toward === "player" ? 1 : -1;
  const aim = config.serve.chooseServeAim();

  return normalizeToSpeed(
    {
      x: config.ball.serveX * aim.x,
      y: config.ball.serveY * aim.y,
      z: zDirection,
    },
    config.ball.serveSpeed,
  );
}

function createPaddle(area: MovementArea): PaddleState {
  return {
    position: {
      x: (area.minX + area.maxX) / 2,
      y: (area.minY + area.maxY) / 2,
      z: area.z,
    },
    velocity: { x: 0, y: 0, z: 0 },
    movementArea: area,
  };
}

function createBotState(area: MovementArea): BotState {
  return {
    target: {
      x: (area.minX + area.maxX) / 2,
      y: (area.minY + area.maxY) / 2,
    },
  };
}

function moveBot(
  paddle: PaddleState,
  bot: BotState,
  ball: BallState,
  activeTimeSeconds: number,
  deltaSeconds: number,
  config: GameConfig,
): Readonly<{ paddle: PaddleState; bot: BotState }> {
  const desiredTarget = chooseBotTarget(ball, activeTimeSeconds, config);
  const reactionAmount =
    config.bot.reactionSeconds <= 0 ? 1 : clamp(deltaSeconds / config.bot.reactionSeconds, 0, 1);
  const target = {
    x: lerp(bot.target.x, desiredTarget.x, reactionAmount),
    y: lerp(bot.target.y, desiredTarget.y, reactionAmount),
  };
  const nextPaddle = movePaddle(
    paddle,
    {
      x: target.x - paddle.position.x,
      y: target.y - paddle.position.y,
    },
    deltaSeconds,
    config,
    config.bot.maxSpeed,
  );

  return {
    paddle: nextPaddle,
    bot: { target },
  };
}

function movePlayerTarget(target: Vector2, movement: Vector2, area: MovementArea): Vector2 {
  return {
    x: clamp(target.x + movement.x, area.minX, area.maxX),
    y: clamp(target.y + movement.y, area.minY, area.maxY),
  };
}

function movePaddleTowardTarget(
  paddle: PaddleState,
  target: Vector2,
  deltaSeconds: number,
  config: GameConfig,
  maxSpeed = config.paddle.maxSpeed,
): PaddleState {
  const nextPosition = {
    x: clamp(target.x, paddle.movementArea.minX, paddle.movementArea.maxX),
    y: clamp(target.y, paddle.movementArea.minY, paddle.movementArea.maxY),
    z: paddle.movementArea.z,
  };
  const movementForVelocity = limitVector(
    {
      x: nextPosition.x - paddle.position.x,
      y: nextPosition.y - paddle.position.y,
    },
    maxSpeed * deltaSeconds,
  );
  const rawVelocity = {
    x: movementForVelocity.x / deltaSeconds,
    y: movementForVelocity.y / deltaSeconds,
    z: 0,
  };
  const smoothing = clamp(config.paddle.velocitySmoothing, 0, 1);

  return {
    ...paddle,
    position: nextPosition,
    velocity: {
      x: lerp(paddle.velocity.x, rawVelocity.x, smoothing),
      y: lerp(paddle.velocity.y, rawVelocity.y, smoothing),
      z: 0,
    },
  };
}

function chooseBotTarget(ball: BallState, activeTimeSeconds: number, config: GameConfig): Vector2 {
  const area = config.paddle.opponentArea;

  if (ball.velocity.z >= 0) {
    return {
      x: (area.minX + area.maxX) / 2,
      y: (area.minY + area.maxY) / 2,
    };
  }

  const targetZ = getPaddleContactCenterZ("opponent", config);
  const timeToPaddle = (targetZ - ball.position.z) / ball.velocity.z;

  if (timeToPaddle <= 0) {
    return {
      x: paddleCenterX(area),
      y: paddleCenterY(area),
    };
  }

  const xBounds = getBallXBounds(ball, config);
  const yBounds = getBallYBounds(ball, config);
  const predictedX = reflectIntoRange(ball.position.x + ball.velocity.x * timeToPaddle, xBounds.min, xBounds.max);
  const predictedY = reflectIntoRange(ball.position.y + ball.velocity.y * timeToPaddle, yBounds.min, yBounds.max);
  const errorX = Math.sin(activeTimeSeconds * 2.1 + 0.4) * config.bot.trackingError;
  const errorY = Math.cos(activeTimeSeconds * 1.7 + 0.8) * config.bot.trackingError;

  return {
    x: clamp(predictedX + errorX, area.minX, area.maxX),
    y: clamp(predictedY + errorY, area.minY, area.maxY),
  };
}

function movePaddle(
  paddle: PaddleState,
  requestedMovement: Vector2,
  deltaSeconds: number,
  config: GameConfig,
  maxSpeed = config.paddle.maxSpeed,
): PaddleState {
  const movement = limitVector(requestedMovement, maxSpeed * deltaSeconds);
  const nextPosition = {
    x: clamp(paddle.position.x + movement.x, paddle.movementArea.minX, paddle.movementArea.maxX),
    y: clamp(paddle.position.y + movement.y, paddle.movementArea.minY, paddle.movementArea.maxY),
    z: paddle.movementArea.z,
  };
  const rawVelocity = {
    x: (nextPosition.x - paddle.position.x) / deltaSeconds,
    y: (nextPosition.y - paddle.position.y) / deltaSeconds,
    z: 0,
  };
  const smoothing = clamp(config.paddle.velocitySmoothing, 0, 1);

  return {
    ...paddle,
    position: nextPosition,
    velocity: {
      x: lerp(paddle.velocity.x, rawVelocity.x, smoothing),
      y: lerp(paddle.velocity.y, rawVelocity.y, smoothing),
      z: 0,
    },
  };
}

function resolvePaddleCollision(
  previousBall: BallState,
  candidateBall: BallState,
  paddle: PaddleState,
  side: Side,
  config: GameConfig,
): Readonly<{ ball: BallState; event: Extract<GameEvent, { type: "paddle-hit" }> }> | null {
  const approachDirection = side === "player" ? 1 : -1;

  if (previousBall.velocity.z * approachDirection <= 0) {
    return null;
  }

  const hitbox = createPaddleHitbox(paddle, side, config);
  const contactCenterZ = hitbox.faceZ - approachDirection * previousBall.radius;
  const previousDistance = (previousBall.position.z - contactCenterZ) * approachDirection;
  const nextDistance = (candidateBall.position.z - contactCenterZ) * approachDirection;

  if (previousDistance > 0 || nextDistance < 0) {
    return null;
  }

  const zDelta = candidateBall.position.z - previousBall.position.z;

  if (zDelta === 0) {
    return null;
  }

  const contactTime = clamp((contactCenterZ - previousBall.position.z) / zDelta, 0, 1);
  const contactPoint = interpolate(previousBall.position, candidateBall.position, contactTime);

  const nearestX = clamp(contactPoint.x, hitbox.minX, hitbox.maxX);
  const nearestY = clamp(contactPoint.y, hitbox.minY, hitbox.maxY);

  if (Math.hypot(contactPoint.x - nearestX, contactPoint.y - nearestY) > previousBall.radius) {
    return null;
  }

  const outgoingVelocity = createPaddleReturnVelocity(candidateBall.velocity, paddle, contactPoint, side, config);
  const speed = vectorLength(outgoingVelocity);

  return {
    ball: {
      ...candidateBall,
      position: {
        x: contactPoint.x,
        y: contactPoint.y,
        z: contactCenterZ - approachDirection * 0.001,
      },
      velocity: outgoingVelocity,
    },
    event: {
      type: "paddle-hit",
      side,
      speed,
    },
  };
}

function createPaddleHitbox(
  paddle: PaddleState,
  side: Side,
  config: GameConfig,
): Readonly<{ minX: number; maxX: number; minY: number; maxY: number; faceZ: number }> {
  const halfWidth = config.paddle.visibleSize.x / 2 + config.collision.forgivingHitbox.x;
  const halfHeight = config.paddle.visibleSize.y / 2 + config.collision.forgivingHitbox.y;
  const halfDepth = config.paddle.visibleSize.z / 2 + config.collision.forgivingHitbox.z;

  return {
    minX: paddle.position.x - halfWidth,
    maxX: paddle.position.x + halfWidth,
    minY: paddle.position.y - halfHeight,
    maxY: paddle.position.y + halfHeight,
    faceZ: getPaddleFaceZ(side, paddle.position.z, halfDepth),
  };
}

function getPaddleContactCenterZ(side: Side, config: GameConfig): number {
  const area = side === "player" ? config.paddle.playerArea : config.paddle.opponentArea;
  const halfDepth = config.paddle.visibleSize.z / 2 + config.collision.forgivingHitbox.z;
  const approachDirection = side === "player" ? 1 : -1;

  return getPaddleFaceZ(side, area.z, halfDepth) - approachDirection * config.ball.radius;
}

function getPaddleFaceZ(side: Side, paddleZ: number, halfDepth: number): number {
  return paddleZ - (side === "player" ? halfDepth : -halfDepth);
}

function createPaddleReturnVelocity(
  incomingVelocity: Vector3,
  paddle: PaddleState,
  contactPoint: Vector3,
  side: Side,
  config: GameConfig,
): Vector3 {
  const halfWidth = config.paddle.visibleSize.x / 2 + config.collision.forgivingHitbox.x;
  const halfHeight = config.paddle.visibleSize.y / 2 + config.collision.forgivingHitbox.y;
  const contactX = clamp((contactPoint.x - paddle.position.x) / halfWidth, -1, 1);
  const contactY = clamp((contactPoint.y - paddle.position.y) / halfHeight, -1, 1);
  const paddleSpeed = Math.hypot(paddle.velocity.x, paddle.velocity.y);
  const dragAmount = Math.max(0, paddleSpeed - config.collision.dragSpeedThreshold);
  const hasDragHit = dragAmount > 0;
  const outgoingZ = side === "player" ? -1 : 1;
  const direction = normalize({
    x:
      contactX * config.collision.contactInfluenceX +
      (hasDragHit ? paddle.velocity.x * config.collision.dragDirectionInfluence : 0),
    y:
      contactY * config.collision.contactInfluenceY +
      (hasDragHit ? paddle.velocity.y * config.collision.dragDirectionInfluence : 0),
    z: outgoingZ,
  });
  const speedBonus = clamp(
    dragAmount * config.collision.dragSpeedBonusPerVelocity,
    0,
    config.collision.maxDragSpeedBonus,
  );
  const speed = clamp(
    vectorLength(incomingVelocity) + config.ball.rallySpeedIncreasePerHit + speedBonus,
    config.ball.minSpeed,
    config.ball.maxSpeed,
  );

  return scale(direction, speed);
}

function moveBall(
  ball: BallState,
  deltaSeconds: number,
  config: GameConfig,
): Readonly<{ ball: BallState; events: readonly GameEvent[] }> {
  const events: GameEvent[] = [];
  let position = add(ball.position, scale(ball.velocity, deltaSeconds));
  let velocity = ball.velocity;
  const xBounds = getBallXBounds(ball, config);
  const yBounds = getBallYBounds(ball, config);

  if (position.x < xBounds.min) {
    position = { ...position, x: reflectBelow(position.x, xBounds.min) };
    velocity = { ...velocity, x: Math.abs(velocity.x) };
    events.push({ type: "wall-bounce", axis: "x" });
  } else if (position.x > xBounds.max) {
    position = { ...position, x: reflectAbove(position.x, xBounds.max) };
    velocity = { ...velocity, x: -Math.abs(velocity.x) };
    events.push({ type: "wall-bounce", axis: "x" });
  }

  if (position.y < yBounds.min) {
    position = { ...position, y: reflectBelow(position.y, yBounds.min) };
    velocity = { ...velocity, y: Math.abs(velocity.y) };
    events.push({ type: "wall-bounce", axis: "y" });
  } else if (position.y > yBounds.max) {
    position = { ...position, y: reflectAbove(position.y, yBounds.max) };
    velocity = { ...velocity, y: -Math.abs(velocity.y) };
    events.push({ type: "wall-bounce", axis: "y" });
  }

  return {
    ball: {
      ...ball,
      position,
      velocity,
    },
    events,
  };
}

function getBallXBounds(ball: BallState, config: GameConfig): Readonly<{ min: number; max: number }> {
  return {
    min: -config.arena.width / 2 + ball.radius,
    max: config.arena.width / 2 - ball.radius,
  };
}

function getBallYBounds(ball: BallState, config: GameConfig): Readonly<{ min: number; max: number }> {
  return {
    min: ball.radius,
    max: config.arena.height - ball.radius,
  };
}

function add(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

function interpolate(a: Vector3, b: Vector3, amount: number): Vector3 {
  return {
    x: lerp(a.x, b.x, amount),
    y: lerp(a.y, b.y, amount),
    z: lerp(a.z, b.z, amount),
  };
}

function scale(vector: Vector3, amount: number): Vector3 {
  return {
    x: vector.x * amount,
    y: vector.y * amount,
    z: vector.z * amount,
  };
}

function normalizeToSpeed(vector: Vector3, speed: number): Vector3 {
  return scale(normalize(vector), speed);
}

function normalize(vector: Vector3): Vector3 {
  const length = Math.hypot(vector.x, vector.y, vector.z);

  if (length === 0) {
    return { x: 0, y: 0, z: 1 };
  }

  return scale(vector, 1 / length);
}

function vectorLength(vector: Vector3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function limitVector(vector: Vector2, maxLength: number): Vector2 {
  const length = Math.hypot(vector.x, vector.y);

  if (length <= maxLength || length === 0) {
    return vector;
  }

  const scaleAmount = maxLength / length;

  return {
    x: vector.x * scaleAmount,
    y: vector.y * scaleAmount,
  };
}

function reflectBelow(value: number, minimum: number): number {
  return minimum + (minimum - value);
}

function reflectAbove(value: number, maximum: number): number {
  return maximum - (value - maximum);
}

function reflectIntoRange(value: number, minimum: number, maximum: number): number {
  const range = maximum - minimum;
  const period = range * 2;

  if (period === 0) {
    return minimum;
  }

  const normalized = positiveModulo(value - minimum, period);

  return normalized <= range ? minimum + normalized : maximum - (normalized - range);
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function paddleCenterX(area: MovementArea): number {
  return (area.minX + area.maxX) / 2;
}

function paddleCenterY(area: MovementArea): number {
  return (area.minY + area.maxY) / 2;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
