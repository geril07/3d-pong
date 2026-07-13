import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { GameSnapshot } from "../simulation/GameRuntime";
import { DEFAULT_GAME_CONFIG } from "../simulation/GameSimulation";
import { ARENA_BLOOM_LAYER, createArenaRoom } from "./ArenaRoom";
import { createBallVisual, type BallVisual } from "./BallVisual";
import { createPaddleMesh } from "./PaddleVisual";

const { arena, ball, paddle } = DEFAULT_GAME_CONFIG;
const ARENA_BLOOM_STRENGTH = 0.12;
const ARENA_BLOOM_RADIUS = 0.5;
const ARENA_BLOOM_THRESHOLD = 0.8;
const SCENE_BACKGROUND_COLOR = 0x37285c;
const SCORE_FLASH_BACKGROUND_COLOR = 0x4c3577;
const FOG_NEAR = 16;
const FOG_FAR = 34;
const TRAIL_LENGTH = 9;
const ENVIRONMENT_BLUR = 0.04;
const BACKDROP_ASPECT = 16 / 9;
const BACKDROP_DISTANCE = 42;
const CAMERA_VERTICAL_OFFSET_RATIO = 0.075;

export class GameScene {
  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene: THREE.Scene;
  readonly #camera: THREE.PerspectiveCamera;
  readonly #composer: EffectComposer;
  readonly #bloomComposer: EffectComposer;
  readonly #backdrop: THREE.Sprite;
  readonly #ballVisual: BallVisual;
  readonly #ball: THREE.Group;
  readonly #playerPaddle: THREE.Mesh;
  readonly #opponentPaddle: THREE.Mesh;
  #trailPositions: THREE.Vector3[] = [];
  #lastTrailPosition: THREE.Vector3 | null = null;
  #scoreFlashUntilSeconds = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.#renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.#renderer.setClearColor(SCENE_BACKGROUND_COLOR, 1);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.#renderer.toneMappingExposure = 1.05;

    this.#scene = new THREE.Scene();
    this.#scene.fog = new THREE.Fog(SCENE_BACKGROUND_COLOR, FOG_NEAR, FOG_FAR);

    const pmremGenerator = new THREE.PMREMGenerator(this.#renderer);
    const envScene = new RoomEnvironment();
    const envMap = pmremGenerator.fromScene(envScene, ENVIRONMENT_BLUR).texture;
    this.#scene.environment = envMap;
    pmremGenerator.dispose();
    envScene.dispose?.();

    this.#camera = new THREE.PerspectiveCamera(54, 1, 0.1, 70);
    this.#camera.position.set(0, 2.5, 11.1);
    this.#camera.lookAt(0, 2, -1.6);

    const backdropTexture = new THREE.TextureLoader().load(
      "/textures/cosmic-background.webp",
    );
    backdropTexture.colorSpace = THREE.SRGBColorSpace;
    this.#backdrop = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: backdropTexture,
        depthTest: false,
        depthWrite: false,
        fog: false,
      }),
    );
    this.#backdrop.renderOrder = -100;
    this.#camera.add(this.#backdrop);
    this.#scene.add(this.#camera);

    this.#scene.add(new THREE.AmbientLight(0xffffff, 0.48));

    this.#scene.add(new THREE.HemisphereLight(0xd7c4ff, 0x24173c, 1.25));

    const keyLight = new THREE.DirectionalLight(0xf7efff, 1.9);
    keyLight.position.set(1.8, 6.5, 4.8);
    this.#scene.add(keyLight);

    const ceilingGlow = new THREE.PointLight(0xb679ff, 18, 30, 2);
    ceilingGlow.position.set(0, 7.2, -0.8);
    this.#scene.add(ceilingGlow);

    const frontFill = new THREE.PointLight(0xe4d4ff, 7, 24, 2);
    frontFill.position.set(0, 3, 7.1);
    this.#scene.add(frontFill);

    this.#scene.add(createArenaRoom(arena));

    this.#playerPaddle = createPaddleMesh(paddle, 0x45d7ff, 0.3);
    this.#scene.add(this.#playerPaddle);

    this.#opponentPaddle = createPaddleMesh(paddle, 0xff5edb, 0.4);
    this.#scene.add(this.#opponentPaddle);

    this.#ballVisual = createBallVisual(ball.radius);
    this.#ball = this.#ballVisual.ball;
    this.#ball.renderOrder = 1;
    this.#scene.add(this.#ball);
    this.#scene.add(this.#ballVisual.trail);

    const finalRenderTarget = new THREE.WebGLRenderTarget(1, 1, {
      samples: 4,
      type: THREE.HalfFloatType,
    });
    this.#composer = new EffectComposer(this.#renderer, finalRenderTarget);

    const bloomRenderTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
    });
    this.#bloomComposer = new EffectComposer(this.#renderer, bloomRenderTarget);
    this.#bloomComposer.renderToScreen = false;
    this.#bloomComposer.addPass(
      new RenderPass(
        this.#scene,
        this.#camera,
        null,
        new THREE.Color(0x000000),
        0,
      ),
    );
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      ARENA_BLOOM_STRENGTH,
      ARENA_BLOOM_RADIUS,
      ARENA_BLOOM_THRESHOLD,
    );
    this.#bloomComposer.addPass(bloomPass);

    const mixPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: {
            // Use bloom-only composite so the thick continuity mask never
            // replaces the visible arena rail.
            value: bloomPass.renderTargetsHorizontal[0].texture,
          },
        },
        vertexShader: `
          varying vec2 passUv;

          void main() {
            passUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D baseTexture;
          uniform sampler2D bloomTexture;
          varying vec2 passUv;

          void main() {
            gl_FragColor = texture2D(baseTexture, passUv) + texture2D(bloomTexture, passUv);
          }
        `,
      }),
      "baseTexture",
    );
    this.#composer.addPass(new RenderPass(this.#scene, this.#camera));
    this.#composer.addPass(mixPass);
    this.#composer.addPass(new SMAAPass());
    this.#composer.addPass(new OutputPass());

    this.resize();
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.#camera.aspect = width / height;
    this.#camera.setViewOffset(
      width,
      height,
      0,
      -height * CAMERA_VERTICAL_OFFSET_RATIO,
      width,
      height,
    );
    this.#renderer.setSize(width, height, false);
    this.#composer.setSize(width, height);
    this.#bloomComposer.setSize(width, height);

    const viewportHeight =
      2 *
      Math.tan(THREE.MathUtils.degToRad(this.#camera.fov / 2)) *
      BACKDROP_DISTANCE;
    const viewportWidth = viewportHeight * this.#camera.aspect;
    const scale = Math.max(viewportWidth / BACKDROP_ASPECT, viewportHeight);
    this.#backdrop.position.set(
      0,
      viewportHeight * CAMERA_VERTICAL_OFFSET_RATIO,
      -BACKDROP_DISTANCE,
    );
    this.#backdrop.scale.set(scale * BACKDROP_ASPECT, scale, 1);
  }

  render(snapshot: GameSnapshot): void {
    this.#updateFeedback(snapshot);
    this.#updateTrail(snapshot);

    setPosition(this.#ball, snapshot.ball.position);
    setPosition(this.#playerPaddle, snapshot.playerPaddle.position);
    setPosition(this.#opponentPaddle, snapshot.opponentPaddle.position);

    const nowSeconds = performance.now() / 1000;
    const isScoreFlashActive = nowSeconds < this.#scoreFlashUntilSeconds;
    const isGameplayActive =
      snapshot.phase === "running" || snapshot.phase === "serve-delay";

    this.#renderer.setClearColor(
      isScoreFlashActive
        ? SCORE_FLASH_BACKGROUND_COLOR
        : SCENE_BACKGROUND_COLOR,
      1,
    );
    this.#playerPaddle.scale.setScalar(isGameplayActive ? 1 : 0.96);

    this.#camera.layers.set(ARENA_BLOOM_LAYER);
    this.#bloomComposer.render();
    this.#camera.layers.set(0);
    this.#composer.render();
  }

  #updateFeedback(snapshot: GameSnapshot): void {
    const nowSeconds = performance.now() / 1000;

    for (const event of snapshot.events) {
      if (event.type === "score") {
        this.#scoreFlashUntilSeconds = nowSeconds + 0.42;
        this.#trailPositions = [];
        this.#lastTrailPosition = null;
      }
    }
  }

  #updateTrail(snapshot: GameSnapshot): void {
    const currentPosition = toVector3(snapshot.ball.position);

    if (
      !this.#lastTrailPosition ||
      currentPosition.distanceTo(this.#lastTrailPosition) > 0.025
    ) {
      this.#trailPositions.unshift(currentPosition.clone());
      this.#trailPositions = this.#trailPositions.slice(0, TRAIL_LENGTH);
      this.#lastTrailPosition = currentPosition;
    }

    this.#ballVisual.update(
      this.#trailPositions,
      snapshot.phase !== "serve-delay",
      snapshot.activeTimeSeconds,
    );
  }
}

function setPosition(
  object: THREE.Object3D,
  position: { x: number; y: number; z: number },
): void {
  object.position.set(position.x, position.y, position.z);
}

function toVector3(position: {
  x: number;
  y: number;
  z: number;
}): THREE.Vector3 {
  return new THREE.Vector3(position.x, position.y, position.z);
}
