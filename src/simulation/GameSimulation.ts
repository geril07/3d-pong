export type GamePhase = "running" | "input-not-captured";

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
  maxSpeed: number;
  playerArea: MovementArea;
  opponentArea: MovementArea;
}>;

export type BallConfig = Readonly<{
  radius: number;
  initialVelocity: Vector3;
}>;

export type InputConfig = Readonly<{
  mouseWorldUnitsPerPixel: number;
}>;

export type GameConfig = Readonly<{
  arena: ArenaConfig;
  ball: BallConfig;
  paddle: PaddleConfig;
  input: InputConfig;
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

export type GameEvent = Readonly<{
  type: "wall-bounce";
  axis: "x" | "y";
}>;

export type InputSnapshot = Readonly<{
  playerMovement: Vector2;
}>;

export type GameState = Readonly<{
  phase: GamePhase;
  activeTimeSeconds: number;
  ball: BallState;
  playerPaddle: PaddleState;
  opponentPaddle: PaddleState;
  events: readonly GameEvent[];
}>;

export type GameSnapshot = GameState;

export const DEFAULT_GAME_CONFIG: GameConfig = {
  arena: {
    width: 6,
    height: 3.2,
    depth: 8,
  },
  ball: {
    radius: 0.13,
    initialVelocity: {
      x: 0.95,
      y: 0.45,
      z: -3.4,
    },
  },
  paddle: {
    visibleSize: {
      x: 0.9,
      y: 0.6,
      z: 0.12,
    },
    maxSpeed: 8,
    playerArea: {
      minX: -2.2,
      maxX: 2.2,
      minY: 0.45,
      maxY: 2.55,
      z: 3.75,
    },
    opponentArea: {
      minX: -2.2,
      maxX: 2.2,
      minY: 0.45,
      maxY: 2.55,
      z: -3.75,
    },
  },
  input: {
    mouseWorldUnitsPerPixel: 0.01,
  },
};

export const EMPTY_INPUT: InputSnapshot = {
  playerMovement: {
    x: 0,
    y: 0,
  },
};

export function createInitialGameState(config = DEFAULT_GAME_CONFIG): GameState {
  const playerPaddle = createPaddle(config.paddle.playerArea);
  const opponentPaddle = createPaddle(config.paddle.opponentArea);

  return {
    phase: "input-not-captured",
    activeTimeSeconds: 0,
    ball: {
      position: {
        x: 0,
        y: config.arena.height / 2,
        z: 0,
      },
      velocity: config.ball.initialVelocity,
      radius: config.ball.radius,
    },
    playerPaddle,
    opponentPaddle,
    events: [],
  };
}

export function setInputCaptured(state: GameState, isCaptured: boolean): GameState {
  return {
    ...state,
    phase: isCaptured ? "running" : "input-not-captured",
    events: [],
  };
}

export function stepGame(
  state: GameState,
  input: InputSnapshot,
  deltaSeconds: number,
  config = DEFAULT_GAME_CONFIG,
): GameState {
  const dt = clamp(deltaSeconds, 0, 0.1);

  if (state.phase !== "running" || dt === 0) {
    return {
      ...state,
      events: [],
    };
  }

  const playerPaddle = movePaddle(state.playerPaddle, input.playerMovement, dt, config);
  const ballStep = moveBall(state.ball, dt, config);

  return {
    ...state,
    activeTimeSeconds: state.activeTimeSeconds + dt,
    ball: ballStep.ball,
    playerPaddle,
    opponentPaddle: {
      ...state.opponentPaddle,
      velocity: { x: 0, y: 0, z: 0 },
    },
    events: ballStep.events,
  };
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

function movePaddle(
  paddle: PaddleState,
  requestedMovement: Vector2,
  deltaSeconds: number,
  config: GameConfig,
): PaddleState {
  const movement = limitVector(requestedMovement, config.paddle.maxSpeed * deltaSeconds);
  const nextPosition = {
    x: clamp(paddle.position.x + movement.x, paddle.movementArea.minX, paddle.movementArea.maxX),
    y: clamp(paddle.position.y + movement.y, paddle.movementArea.minY, paddle.movementArea.maxY),
    z: paddle.movementArea.z,
  };

  return {
    ...paddle,
    position: nextPosition,
    velocity: {
      x: (nextPosition.x - paddle.position.x) / deltaSeconds,
      y: (nextPosition.y - paddle.position.y) / deltaSeconds,
      z: 0,
    },
  };
}

function moveBall(
  ball: BallState,
  deltaSeconds: number,
  config: GameConfig,
): Readonly<{ ball: BallState; events: readonly GameEvent[] }> {
  const events: GameEvent[] = [];
  let position = add(ball.position, scale(ball.velocity, deltaSeconds));
  let velocity = ball.velocity;

  const minX = -config.arena.width / 2 + ball.radius;
  const maxX = config.arena.width / 2 - ball.radius;
  const minY = ball.radius;
  const maxY = config.arena.height - ball.radius;

  if (position.x < minX) {
    position = { ...position, x: reflectBelow(position.x, minX) };
    velocity = { ...velocity, x: Math.abs(velocity.x) };
    events.push({ type: "wall-bounce", axis: "x" });
  } else if (position.x > maxX) {
    position = { ...position, x: reflectAbove(position.x, maxX) };
    velocity = { ...velocity, x: -Math.abs(velocity.x) };
    events.push({ type: "wall-bounce", axis: "x" });
  }

  if (position.y < minY) {
    position = { ...position, y: reflectBelow(position.y, minY) };
    velocity = { ...velocity, y: Math.abs(velocity.y) };
    events.push({ type: "wall-bounce", axis: "y" });
  } else if (position.y > maxY) {
    position = { ...position, y: reflectAbove(position.y, maxY) };
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

function add(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

function scale(vector: Vector3, amount: number): Vector3 {
  return {
    x: vector.x * amount,
    y: vector.y * amount,
    z: vector.z * amount,
  };
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
