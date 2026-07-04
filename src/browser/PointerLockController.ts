export type PointerLockChangeHandler = (isCaptured: boolean) => void;

export class PointerLockController {
  readonly #canvas: HTMLCanvasElement;
  readonly #onChange: PointerLockChangeHandler;

  constructor(canvas: HTMLCanvasElement, onChange: PointerLockChangeHandler) {
    this.#canvas = canvas;
    this.#onChange = onChange;
  }

  start(): void {
    this.#canvas.addEventListener("click", this.#handleCanvasClick);
    document.addEventListener("pointerlockchange", this.#handlePointerLockChange);
    document.addEventListener("pointerlockerror", this.#handlePointerLockError);
  }

  stop(): void {
    this.#canvas.removeEventListener("click", this.#handleCanvasClick);
    document.removeEventListener("pointerlockchange", this.#handlePointerLockChange);
    document.removeEventListener("pointerlockerror", this.#handlePointerLockError);
  }

  readonly #handleCanvasClick = (): void => {
    if (document.pointerLockElement === this.#canvas) {
      return;
    }

    void this.#canvas.requestPointerLock();
  };

  readonly #handlePointerLockChange = (): void => {
    this.#onChange(document.pointerLockElement === this.#canvas);
  };

  readonly #handlePointerLockError = (): void => {
    this.#onChange(false);
  };
}
