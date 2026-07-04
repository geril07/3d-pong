import "./styles.css";
import { PointerLockController } from "./browser/PointerLockController";
import { GameRuntime } from "./simulation/GameRuntime";
import { GameScene } from "./rendering/GameScene";
import { DEFAULT_GAME_CONFIG } from "./simulation/GameSimulation";

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

const runtime = new GameRuntime();
const scene = new GameScene(canvas);
let scoreFeedbackTimeout: number | undefined;

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

  if (snapshot.events.some((event) => event.type === "score")) {
    triggerScoreFeedback();
  }

  if (snapshot.phase === "match-over") {
    statusLabel.textContent = `${formatSide(snapshot.winner)} wins`;
    statusHelp.textContent = "Press R to restart the match.";
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

function triggerScoreFeedback(): void {
  window.clearTimeout(scoreFeedbackTimeout);
  scorePanel.classList.add("is-scoring");
  scoreFeedbackTimeout = window.setTimeout(() => {
    scorePanel.classList.remove("is-scoring");
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

let lastFrameTimeMs = performance.now();

function animate(frameTimeMs: number): void {
  const deltaSeconds = (frameTimeMs - lastFrameTimeMs) / 1000;
  lastFrameTimeMs = frameTimeMs;

  runtime.update(deltaSeconds, pointerLock.consumeInput());
  syncStatus();
  scene.render(runtime.getSnapshot());

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

window.addEventListener("resize", () => {
  scene.resize();
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "r" || runtime.getSnapshot().phase !== "match-over") {
    return;
  }

  runtime.restart();
  syncStatus();
});
