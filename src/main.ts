import "./styles.css";
import { PointerLockController } from "./browser/PointerLockController";
import { GameRuntime } from "./simulation/GameRuntime";
import { GameScene } from "./rendering/GameScene";
import {
  createGameConfig,
  DEFAULT_GAME_CONFIG,
  type BotDifficulty,
  type GameSettings,
} from "./simulation/GameSimulation";

const BALL_SPEEDS = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const;
const SETTINGS_KEY = "3d-pong-settings";
const DEFAULT_SETTINGS: GameSettings = { difficulty: "medium", ballSpeed: 1 };

function requireElement<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Game boot markup is missing ${selector}.`);
  }

  return element;
}

const canvas = requireElement<HTMLCanvasElement>("#game-canvas");
const statusPanel = requireElement<HTMLDivElement>("#status-panel");
const statusLabel = requireElement<HTMLDivElement>("#status-label");
const statusHelp = requireElement<HTMLDivElement>("#status-help");
const scorePanel = requireElement<HTMLDivElement>("#score-panel");
const playerScore = requireElement<HTMLSpanElement>("#player-score");
const opponentScore = requireElement<HTMLSpanElement>("#opponent-score");
const gameMenu = requireElement<HTMLElement>("#game-menu");
const menuEyebrow = requireElement<HTMLParagraphElement>("#menu-eyebrow");
const menuTitle = requireElement<HTMLHeadingElement>("#menu-title");
const playButton = requireElement<HTMLButtonElement>("#play-button");
const resumeButton = requireElement<HTMLButtonElement>("#resume-button");
const exitButton = requireElement<HTMLButtonElement>("#exit-button");
const speedInput = requireElement<HTMLInputElement>("#ball-speed");
const speedValue = requireElement<HTMLOutputElement>("#ball-speed-value");

const runtime = new GameRuntime();
const scene = new GameScene(canvas);
let settings = loadSettings();
let isMenuOpen = true;
let lastPhase = runtime.getSnapshot().phase;
let scoreFeedbackTimeout: number | undefined;

syncSettingsControls();
menuTitle.focus();

function syncStatus(): void {
  const snapshot = runtime.getSnapshot();
  const isInputMissing = snapshot.phase === "input-not-captured";
  const isMatchOver = snapshot.phase === "match-over";

  playerScore.textContent = String(snapshot.score.player);
  opponentScore.textContent = String(snapshot.score.opponent);
  statusPanel.classList.toggle("is-paused", isInputMissing || isMatchOver);
  statusPanel.classList.toggle("is-running", snapshot.phase === "running" || snapshot.phase === "serve-delay");
  statusPanel.classList.toggle("is-serving", snapshot.phase === "serve-delay");
  statusPanel.classList.toggle("is-match-over", isMatchOver);
  statusPanel.hidden = isMenuOpen || isMatchOver;

  const scoreEvent = snapshot.events.find((event) => event.type === "score");
  if (scoreEvent?.type === "score") {
    triggerScoreFeedback(scoreEvent.scoringSide);
  }

  if (snapshot.phase === "match-over") {
    statusLabel.textContent = `${formatSide(snapshot.winner)} wins`;
    statusHelp.textContent = "Choose settings for the next match.";
    return;
  }

  if (snapshot.phase === "serve-delay") {
    statusLabel.textContent = "Serving";
    statusHelp.textContent = `Next serve goes toward ${formatSide(snapshot.nextServeToward)}.`;
    return;
  }

  statusLabel.textContent = snapshot.phase === "running" ? "Input captured" : "Input not captured";
  statusHelp.textContent =
    snapshot.phase === "running"
      ? "Gameplay is active. Press Escape to pause/release input."
      : "Click the arena to capture mouse input. Simulation is paused.";
}

function triggerScoreFeedback(scoringSide: "player" | "opponent"): void {
  window.clearTimeout(scoreFeedbackTimeout);
  scorePanel.classList.remove("is-scoring-player", "is-scoring-opponent");
  scorePanel.classList.add(`is-scoring-${scoringSide}`);
  scoreFeedbackTimeout = window.setTimeout(() => {
    scorePanel.classList.remove("is-scoring-player", "is-scoring-opponent");
  }, 420);
}

function formatSide(side: "player" | "opponent" | null): string {
  if (side === "player") {
    return "Player";
  }

  return "Bot";
}

const pointerLock = new PointerLockController(
  canvas,
  (isCaptured) => {
    runtime.setInputCaptured(isCaptured);
    syncStatus();
  },
  { worldUnitsPerPixel: DEFAULT_GAME_CONFIG.input.mouseWorldUnitsPerPixel },
);

pointerLock.start();
syncStatus();

playButton.addEventListener("click", startMatch);
resumeButton.addEventListener("click", () => pointerLock.capture());
exitButton.addEventListener("click", () => openMenu());
speedInput.addEventListener("input", () => {
  speedValue.value = `${BALL_SPEEDS[Number(speedInput.value)]}×`;
});

let lastFrameTimeMs = performance.now();

function animate(frameTimeMs: number): void {
  const deltaSeconds = (frameTimeMs - lastFrameTimeMs) / 1000;
  lastFrameTimeMs = frameTimeMs;

  runtime.update(deltaSeconds, pointerLock.consumeInput());
  const phase = runtime.getSnapshot().phase;

  if (phase === "match-over" && lastPhase !== "match-over") {
    document.exitPointerLock();
    openMenu(runtime.getSnapshot().winner);
  }

  lastPhase = phase;
  syncStatus();
  scene.render(runtime.getSnapshot());

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

window.addEventListener("resize", () => {
  scene.resize();
});


function startMatch(): void {
  settings = readSettingsControls();
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage is optional; the match can still start without persistence.
  }
  runtime.restart(createGameConfig(settings));
  lastPhase = runtime.getSnapshot().phase;
  isMenuOpen = false;
  gameMenu.hidden = true;
  syncStatus();
  pointerLock.capture();
}

function openMenu(winner: "player" | "opponent" | null = null): void {
  isMenuOpen = true;
  gameMenu.hidden = false;
  menuEyebrow.textContent = winner ? "MATCH COMPLETE" : "ARENA SETTINGS";
  menuTitle.textContent = winner ? `${formatSide(winner)} wins` : "3D PONG";
  playButton.textContent = winner ? "Play Again" : "Play";
  if (document.pointerLockElement) document.exitPointerLock();
  syncStatus();
  menuTitle.focus();
}

function syncSettingsControls(): void {
  const difficulty = document.querySelector<HTMLInputElement>(`input[name="difficulty"][value="${settings.difficulty}"]`);
  if (difficulty) difficulty.checked = true;
  const speedIndex = BALL_SPEEDS.indexOf(settings.ballSpeed as (typeof BALL_SPEEDS)[number]);
  speedInput.value = String(speedIndex < 0 ? 2 : speedIndex);
  speedValue.value = `${BALL_SPEEDS[Number(speedInput.value)]}×`;
}

function readSettingsControls(): GameSettings {
  const difficulty = document.querySelector<HTMLInputElement>('input[name="difficulty"]:checked')?.value as BotDifficulty;
  return { difficulty, ballSpeed: BALL_SPEEDS[Number(speedInput.value)] };
}

function loadSettings(): GameSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<GameSettings> | null;
    const difficulties: readonly string[] = ["easy", "medium", "hard", "expert"];
    if (saved && difficulties.includes(saved.difficulty ?? "") && BALL_SPEEDS.includes(saved.ballSpeed as never)) {
      return saved as GameSettings;
    }
  } catch {
    // Invalid browser storage falls back to defaults.
  }
  return DEFAULT_SETTINGS;
}
