import * as THREE from "three";
import type { GameSnapshot } from "../simulation/GameRuntime";
import { DEFAULT_GAME_CONFIG } from "../simulation/GameSimulation";

const { ball, paddle } = DEFAULT_GAME_CONFIG;
const SCENE_BACKGROUND_COLOR = 0x050711;
const SCORE_FLASH_BACKGROUND_COLOR = 0x0c1224;
const FOG_NEAR = 7.5;
const FOG_FAR = 17;
const TRAIL_LENGTH = 9;
const TRAIL_BASE_OPACITY = 0.3;
const BALL_EMISSIVE_COLOR = 0x2f4f85;
const BALL_HIT_EMISSIVE_COLOR = 0x8fb9ff;
const PADDLE_EMISSIVE_INTENSITY = 0.2;
const PADDLE_HIT_EMISSIVE_INTENSITY = 0.82;

export class GameScene {
  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene: THREE.Scene;
  readonly #camera: THREE.PerspectiveCamera;
  readonly #ballMaterial: THREE.MeshStandardMaterial;
  readonly #playerPaddleMaterial: THREE.MeshStandardMaterial;
  readonly #opponentPaddleMaterial: THREE.MeshStandardMaterial;
  readonly #ball: THREE.Mesh;
  readonly #playerPaddle: THREE.Mesh;
  readonly #opponentPaddle: THREE.Mesh;
  #trail: THREE.Mesh[];
  #trailPositions: THREE.Vector3[] = [];
  #lastTrailPosition: THREE.Vector3 | null = null;
  #hitFlashUntilSeconds = 0;
  #scoreFlashUntilSeconds = 0;
  #lastHitSide: "player" | "opponent" | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.#renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.#renderer.setClearColor(SCENE_BACKGROUND_COLOR, 1);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.#scene = new THREE.Scene();
    this.#scene.fog = new THREE.Fog(SCENE_BACKGROUND_COLOR, FOG_NEAR, FOG_FAR);

    this.#camera = new THREE.PerspectiveCamera(56, 1, 0.1, 50);
    this.#camera.position.set(0, 2.7, 7.8);
    this.#camera.lookAt(0, 1.45, -2.5);

    this.#scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(2.5, 5, 4);
    this.#scene.add(keyLight);

    this.#playerPaddleMaterial = createPaddleMaterial(0x45d7ff);
    this.#playerPaddle = createPaddle(this.#playerPaddleMaterial);
    this.#scene.add(this.#playerPaddle);

    this.#opponentPaddleMaterial = createPaddleMaterial(0xff9d38);
    this.#opponentPaddle = createPaddle(this.#opponentPaddleMaterial);
    this.#scene.add(this.#opponentPaddle);

    const ballGeometry = new THREE.SphereGeometry(ball.radius, 24, 16);
    this.#ballMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f7ff, emissive: BALL_EMISSIVE_COLOR });
    this.#ball = new THREE.Mesh(ballGeometry, this.#ballMaterial);
    this.#scene.add(this.#ball);
    this.#trail = createBallTrail();

    for (const trailPart of this.#trail) {
      this.#scene.add(trailPart);
    }

    this.resize();
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setSize(width, height, false);
  }

  render(snapshot: GameSnapshot): void {
    this.#updateFeedback(snapshot);
    this.#updateTrail(snapshot);

    setPosition(this.#ball, snapshot.ball.position);
    setPosition(this.#playerPaddle, snapshot.playerPaddle.position);
    setPosition(this.#opponentPaddle, snapshot.opponentPaddle.position);
    this.#ball.rotation.y = snapshot.activeTimeSeconds * 1.5;

    const nowSeconds = performance.now() / 1000;
    const isHitFlashActive = nowSeconds < this.#hitFlashUntilSeconds;
    const isScoreFlashActive = nowSeconds < this.#scoreFlashUntilSeconds;
    const isGameplayActive = snapshot.phase === "running" || snapshot.phase === "serve-delay";

    this.#renderer.setClearColor(isScoreFlashActive ? SCORE_FLASH_BACKGROUND_COLOR : SCENE_BACKGROUND_COLOR, 1);
    this.#ball.scale.setScalar(isHitFlashActive ? 1.24 : 1);
    this.#ballMaterial.emissive.setHex(isHitFlashActive ? BALL_HIT_EMISSIVE_COLOR : BALL_EMISSIVE_COLOR);
    this.#playerPaddle.scale.setScalar(isGameplayActive ? 1 : 0.96);
    this.#playerPaddleMaterial.emissiveIntensity =
      isHitFlashActive && this.#lastHitSide === "player" ? PADDLE_HIT_EMISSIVE_INTENSITY : PADDLE_EMISSIVE_INTENSITY;
    this.#opponentPaddleMaterial.emissiveIntensity =
      isHitFlashActive && this.#lastHitSide === "opponent" ? PADDLE_HIT_EMISSIVE_INTENSITY : PADDLE_EMISSIVE_INTENSITY;

    this.#renderer.render(this.#scene, this.#camera);
  }

  #updateFeedback(snapshot: GameSnapshot): void {
    const nowSeconds = performance.now() / 1000;

    for (const event of snapshot.events) {
      if (event.type === "paddle-hit") {
        this.#hitFlashUntilSeconds = nowSeconds + 0.14;
        this.#lastHitSide = event.side;
      }

      if (event.type === "score") {
        this.#scoreFlashUntilSeconds = nowSeconds + 0.42;
        this.#trailPositions = [];
        this.#lastTrailPosition = null;
      }
    }
  }

  #updateTrail(snapshot: GameSnapshot): void {
    const currentPosition = toVector3(snapshot.ball.position);

    if (!this.#lastTrailPosition || currentPosition.distanceTo(this.#lastTrailPosition) > 0.025) {
      this.#trailPositions.unshift(currentPosition.clone());
      this.#trailPositions = this.#trailPositions.slice(0, TRAIL_LENGTH);
      this.#lastTrailPosition = currentPosition;
    }

    for (let index = 0; index < this.#trail.length; index += 1) {
      const trailPart = this.#trail[index];
      const trailPosition = this.#trailPositions[index];

      trailPart.visible = Boolean(trailPosition) && snapshot.phase !== "serve-delay";

      if (trailPosition) {
        trailPart.position.copy(trailPosition);
      }
    }
  }
}

function createPaddle(material: THREE.MeshStandardMaterial): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(paddle.visibleSize.x, paddle.visibleSize.y, paddle.visibleSize.z);

  return new THREE.Mesh(geometry, material);
}

function createPaddleMaterial(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    roughness: 0.62,
    metalness: 0,
    transmission: 0.22,
    thickness: 0.18,
    ior: 1.36,
    clearcoat: 0.48,
    clearcoatRoughness: 0.38,
    emissive: color,
    emissiveIntensity: PADDLE_EMISSIVE_INTENSITY,
  });
}

function createBallTrail(): THREE.Mesh[] {
  return Array.from({ length: TRAIL_LENGTH }, (_, index) => {
    const falloff = 1 - index / TRAIL_LENGTH;
    const geometry = new THREE.SphereGeometry(ball.radius, 16, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0x9cc9ff,
      transparent: true,
      opacity: falloff * TRAIL_BASE_OPACITY,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(0.42 + falloff * 0.58);
    mesh.visible = false;

    return mesh;
  });
}

function setPosition(object: THREE.Object3D, position: { x: number; y: number; z: number }): void {
  object.position.set(position.x, position.y, position.z);
}

function toVector3(position: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(position.x, position.y, position.z);
}
