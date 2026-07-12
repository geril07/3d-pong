import type { InputSnapshot } from "../simulation/GameRuntime";

export type PointerLockChangeHandler = (isCaptured: boolean) => void;

export type PointerLockOptions = Readonly<{
  worldUnitsPerPixel: number;
}>;

export class PointerLockController {
  readonly #canvas: HTMLCanvasElement;
  readonly #onChange: PointerLockChangeHandler;
  readonly #worldUnitsPerPixel: number;
  #pendingMovement = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, onChange: PointerLockChangeHandler, options: PointerLockOptions) {
    this.#canvas = canvas;
    this.#onChange = onChange;
    this.#worldUnitsPerPixel = options.worldUnitsPerPixel;
  }

  start(): void {
    this.#canvas.addEventListener("click", this.#handleCanvasClick);
    document.addEventListener("mousemove", this.#handleMouseMove);
    document.addEventListener("pointerlockchange", this.#handlePointerLockChange);
    document.addEventListener("pointerlockerror", this.#handlePointerLockError);
  }

  capture(): void {
    if (document.pointerLockElement !== this.#canvas) {
      void this.#canvas.requestPointerLock();
    }
  }

  stop(): void {
    this.#canvas.removeEventListener("click", this.#handleCanvasClick);
    document.removeEventListener("mousemove", this.#handleMouseMove);
    document.removeEventListener("pointerlockchange", this.#handlePointerLockChange);
    document.removeEventListener("pointerlockerror", this.#handlePointerLockError);
  }

  consumeInput(): InputSnapshot {
    const input = {
      playerMovement: this.#pendingMovement,
    };

    this.#pendingMovement = { x: 0, y: 0 };

    return input;
  }

  readonly #handleCanvasClick = (): void => {
    this.capture();
  };

  readonly #handlePointerLockChange = (): void => {
    this.#onChange(document.pointerLockElement === this.#canvas);
  };

  readonly #handlePointerLockError = (): void => {
    this.#onChange(false);
  };

  readonly #handleMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.#canvas) {
      return;
    }

    this.#pendingMovement = {
      x: this.#pendingMovement.x + event.movementX * this.#worldUnitsPerPixel,
      y: this.#pendingMovement.y - event.movementY * this.#worldUnitsPerPixel,
    };
  };
}
