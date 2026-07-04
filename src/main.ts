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

const runtime = new GameRuntime();
const scene = new GameScene(canvas);

function syncStatus(): void {
  const snapshot = runtime.getSnapshot();

  statusPanel.classList.toggle("is-paused", snapshot.phase === "input-not-captured");
  statusPanel.classList.toggle("is-running", snapshot.phase === "running");
  statusLabel.textContent = snapshot.phase === "running" ? "Input captured" : "Input not captured";
  statusHelp.textContent =
    snapshot.phase === "running"
      ? "Gameplay is active. Press Escape to pause/release input."
      : "Click the arena to capture mouse input. Simulation is paused.";
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
  scene.render(runtime.getSnapshot());

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

window.addEventListener("resize", () => {
  scene.resize();
});
