import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { GameSnapshot } from "../simulation/GameRuntime";
import { DEFAULT_GAME_CONFIG } from "../simulation/GameSimulation";

const { arena, ball, paddle } = DEFAULT_GAME_CONFIG;
const SCENE_BACKGROUND_COLOR = 0x37285c;
const SCORE_FLASH_BACKGROUND_COLOR = 0x4c3577;
const FOG_NEAR = 16;
const FOG_FAR = 34;
const TRAIL_LENGTH = 9;
const BALL_EMISSIVE_COLOR = 0x2f4f85;
const BALL_HIT_EMISSIVE_COLOR = 0x8fb9ff;
const PADDLE_EMISSIVE_INTENSITY = 0.2;
const PADDLE_HIT_EMISSIVE_INTENSITY = 0.82;

const WALL_OPACITY = 0.11;
const WALL_TRANSMISSION = 0.94;
const WALL_ROUGHNESS = 0.34;
const WALL_THICKNESS = 0.05;
const WALL_IOR = 1.36;
const WALL_CLEARCOAT = 0.72;
const WALL_CLEARCOAT_ROUGHNESS = 0.26;
const WALL_EMISSIVE_INTENSITY = 0.1;
const SIDE_WALL_TINT = 0x9186ff;
const ENVIRONMENT_BLUR = 0.04;
const BACKDROP_ASPECT = 16 / 9;
const BACKDROP_DISTANCE = 42;

export class GameScene {
  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene: THREE.Scene;
  readonly #camera: THREE.PerspectiveCamera;
  readonly #composer: EffectComposer;
  readonly #backdrop: THREE.Sprite;
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
    this.#camera.position.set(0, 4.05, 11.1);
    this.#camera.lookAt(0, 1.8, -1.6);

    const backdropTexture = new THREE.TextureLoader().load("/textures/cosmic-background.webp");
    backdropTexture.colorSpace = THREE.SRGBColorSpace;
    this.#backdrop = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: backdropTexture, depthTest: false, depthWrite: false, fog: false }),
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

    this.#scene.add(createPlayfieldFloor());
    this.#scene.add(createBarrierVolume());
    this.#scene.add(createArenaEdges());

    this.#playerPaddleMaterial = createPaddleMaterial(0x45d7ff);
    this.#playerPaddle = createPaddle(this.#playerPaddleMaterial);
    this.#scene.add(this.#playerPaddle);

    this.#opponentPaddleMaterial = createPaddleMaterial(0xff5edb);
    this.#opponentPaddle = createPaddle(this.#opponentPaddleMaterial);
    this.#scene.add(this.#opponentPaddle);

    const ballGeometry = new THREE.SphereGeometry(ball.radius, 24, 16);
    this.#ballMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f7ff, emissive: BALL_EMISSIVE_COLOR });
    this.#ball = new THREE.Mesh(ballGeometry, this.#ballMaterial);
    this.#scene.add(this.#ball);
    this.#ball.add(createBallHalo());
    this.#trail = createBallTrail();

    for (const trailPart of this.#trail) {
      this.#scene.add(trailPart);
    }

    this.#composer = new EffectComposer(this.#renderer);
    this.#composer.addPass(new RenderPass(this.#scene, this.#camera));
    this.#composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.72, 0.48, 0.72));
    this.#composer.addPass(new OutputPass());

    this.resize();
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setSize(width, height, false);
    this.#composer?.setSize(width, height);

    const viewportHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.#camera.fov / 2)) * BACKDROP_DISTANCE;
    const viewportWidth = viewportHeight * this.#camera.aspect;
    const scale = Math.max(viewportWidth / BACKDROP_ASPECT, viewportHeight);
    this.#backdrop.position.set(0, 0, -BACKDROP_DISTANCE);
    this.#backdrop.scale.set(scale * BACKDROP_ASPECT, scale, 1);
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

    this.#composer.render();
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

function createPlayfieldFloor(): THREE.Object3D {
  const geometry = new THREE.PlaneGeometry(arena.width, arena.depth);
  const material = new THREE.MeshBasicMaterial({
    color: 0x171027,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotateX(-Math.PI / 2);
  mesh.position.y = 0;
  return mesh;
}

function createArenaEdges(): THREE.LineSegments {
  const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(arena.width, arena.height, arena.depth));
  const color = new THREE.Color(0x9e8cff).multiplyScalar(2.2);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.78, toneMapped: false });
  const edges = new THREE.LineSegments(geometry, material);
  edges.position.y = arena.height / 2;
  return edges;
}

function createBarrierVolume(): THREE.Group {
  const halfWidth = arena.width / 2;
  const halfDepth = arena.depth / 2;
  const height = arena.height;
  const group = new THREE.Group();

  group.add(createWall(
    new THREE.BoxGeometry(0.05, height, arena.depth),
    new THREE.Vector3(-halfWidth, height / 2, 0),
    SIDE_WALL_TINT,
  ));
  group.add(createWall(
    new THREE.BoxGeometry(0.05, height, arena.depth),
    new THREE.Vector3(halfWidth, height / 2, 0),
    SIDE_WALL_TINT,
  ));
  group.add(createWall(
    new THREE.BoxGeometry(arena.width, 0.05, arena.depth),
    new THREE.Vector3(0, height, 0),
    SIDE_WALL_TINT,
  ));
  group.add(createWall(
    new THREE.BoxGeometry(arena.width, height, 0.05),
    new THREE.Vector3(0, height / 2, -halfDepth),
    SIDE_WALL_TINT,
  ));

  return group;
}

function createWall(geometry: THREE.BoxGeometry, position: THREE.Vector3, tint: THREE.ColorRepresentation): THREE.Mesh {
  const material = new THREE.MeshPhysicalMaterial({
    color: tint,
    transparent: true,
    opacity: WALL_OPACITY,
    depthWrite: false,
    roughness: WALL_ROUGHNESS,
    metalness: 0,
    transmission: WALL_TRANSMISSION,
    thickness: WALL_THICKNESS,
    ior: WALL_IOR,
    clearcoat: WALL_CLEARCOAT,
    clearcoatRoughness: WALL_CLEARCOAT_ROUGHNESS,
    emissive: tint,
    emissiveIntensity: WALL_EMISSIVE_INTENSITY,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);

  return mesh;
}

function createPaddle(material: THREE.MeshStandardMaterial): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(paddle.visibleSize.x, paddle.visibleSize.y, paddle.visibleSize.z);
  const mesh = new THREE.Mesh(geometry, material);
  const edgeColor = material.color.clone().multiplyScalar(2.4);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: edgeColor, toneMapped: false, transparent: true, opacity: 0.9 }),
  );
  mesh.add(edges);

  return mesh;
}

function createPaddleMaterial(color: THREE.ColorRepresentation): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity: 0.66,
    depthWrite: false,
    roughness: 0.22,
    metalness: 0,
    transmission: 0.42,
    thickness: 0.18,
    ior: 1.36,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
    emissive: color,
    emissiveIntensity: PADDLE_EMISSIVE_INTENSITY,
  });
}

function createBallHalo(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(ball.radius * 1.75, 20, 12);
  const material = new THREE.MeshBasicMaterial({
    color: 0x66cfff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geometry, material);
}

function createBallTrail(): THREE.Mesh[] {
  return Array.from({ length: TRAIL_LENGTH }, (_, index) => {
    const falloff = 1 - index / TRAIL_LENGTH;
    const geometry = new THREE.SphereGeometry(ball.radius, 16, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0x62cfff,
      transparent: true,
      opacity: falloff * 0.46,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
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
