import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { GameSnapshot } from "../simulation/GameRuntime";
import { DEFAULT_GAME_CONFIG } from "../simulation/GameSimulation";

const { arena, ball, paddle } = DEFAULT_GAME_CONFIG;
const SCENE_BACKGROUND_COLOR = 0x04050d;
const SCORE_FLASH_BACKGROUND_COLOR = 0x160b1f;
const FOG_NEAR = 12;
const FOG_FAR = 28;
const TRAIL_LENGTH = 9;
const TRAIL_BASE_OPACITY = 0.3;
const BALL_EMISSIVE_COLOR = 0x2f4f85;
const BALL_HIT_EMISSIVE_COLOR = 0x8fb9ff;
const PADDLE_EMISSIVE_INTENSITY = 0.2;
const PADDLE_HIT_EMISSIVE_INTENSITY = 0.82;

const OUTER_FLOOR_COLOR = 0x02040b;
const OUTER_FLOOR_ROUGHNESS = 0.42;
const OUTER_FLOOR_METALNESS = 0.88;
const OUTER_WALL_COLOR = 0x11172f;
const OUTER_WALL_OPACITY = 0.54;
const OUTER_WALL_ROUGHNESS = 0.82;

const PLATFORM_COLOR = 0x0c1325;
const PLATFORM_ROUGHNESS = 0.3;
const PLATFORM_METALNESS = 0.92;
const PLATFORM_GLOW_COLOR = 0xa643ff;
const PLATFORM_GLOW_OPACITY = 0.12;

const PLAYFIELD_FLOOR_COLOR = 0x0b1020;
const PLAYFIELD_FLOOR_ROUGHNESS = 0.28;
const PLAYFIELD_FLOOR_METALNESS = 1;

const WALL_OPACITY = 0.11;
const WALL_TRANSMISSION = 0.94;
const WALL_ROUGHNESS = 0.34;
const WALL_THICKNESS = 0.05;
const WALL_IOR = 1.36;
const WALL_CLEARCOAT = 0.72;
const WALL_CLEARCOAT_ROUGHNESS = 0.26;
const WALL_EMISSIVE_INTENSITY = 0.1;
const SIDE_WALL_TINT = 0x9186ff;
const ENVIRONMENT_EXPOSURE = 0.55;

const LIGHT_BAR_COLOR = 0xf15fff;
const LIGHT_BAR_SECONDARY_COLOR = 0x44d8ff;
const LIGHT_BAR_OPACITY = 0.95;
const LIGHT_BAR_GLOW_OPACITY = 0.16;

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
    this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.#scene = new THREE.Scene();
    this.#scene.fog = new THREE.Fog(SCENE_BACKGROUND_COLOR, FOG_NEAR, FOG_FAR);

    const pmremGenerator = new THREE.PMREMGenerator(this.#renderer);
    const envScene = new RoomEnvironment();
    const envMap = pmremGenerator.fromScene(envScene, ENVIRONMENT_EXPOSURE).texture;
    this.#scene.environment = envMap;
    pmremGenerator.dispose();
    envScene.dispose?.();

    this.#camera = new THREE.PerspectiveCamera(54, 1, 0.1, 70);
    this.#camera.position.set(0, 3.45, 10.4);
    this.#camera.lookAt(0, 1.38, -1.8);

    this.#scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    this.#scene.add(new THREE.HemisphereLight(0x7aafff, 0x05070d, 0.55));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(2.5, 5, 4);
    this.#scene.add(keyLight);

    const magentaLight = new THREE.PointLight(0xd856ff, 14, 22, 2);
    magentaLight.position.set(0, 5.1, -1.1);
    this.#scene.add(magentaLight);

    const cyanLight = new THREE.PointLight(0x54d8ff, 9, 18, 2);
    cyanLight.position.set(-4.6, 3.1, 2.4);
    this.#scene.add(cyanLight);

    const orangeLight = new THREE.PointLight(0xff9440, 8, 18, 2);
    orangeLight.position.set(4.6, 3.1, -2.4);
    this.#scene.add(orangeLight);

    this.#scene.add(createArenaShell());
    this.#scene.add(createArenaPlatform());
    this.#scene.add(createCeilingRig());
    this.#scene.add(createPlayfieldFloor());
    this.#scene.add(createBarrierVolume());

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

function createArenaShell(): THREE.Group {
  const outerWidth = arena.width * 4.6;
  const outerDepth = arena.depth * 4;
  const outerHeight = arena.height * 2.9;
  const halfWidth = outerWidth / 2;
  const halfDepth = outerDepth / 2;
  const halfHeight = outerHeight / 2;
  const group = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(outerWidth, outerDepth),
    new THREE.MeshStandardMaterial({
      color: OUTER_FLOOR_COLOR,
      metalness: OUTER_FLOOR_METALNESS,
      roughness: OUTER_FLOOR_ROUGHNESS,
    }),
  );
  floor.rotateX(-Math.PI / 2);
  floor.position.y = -0.18;
  group.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: OUTER_WALL_COLOR,
    transparent: true,
    opacity: OUTER_WALL_OPACITY,
    roughness: OUTER_WALL_ROUGHNESS,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(outerDepth, outerHeight), wallMaterial);
  leftWall.position.set(-halfWidth, halfHeight, 0);
  leftWall.rotation.y = Math.PI / 2;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(outerDepth, outerHeight), wallMaterial);
  rightWall.position.set(halfWidth, halfHeight, 0);
  rightWall.rotation.y = -Math.PI / 2;
  group.add(rightWall);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(outerWidth, outerHeight), wallMaterial);
  backWall.position.set(0, halfHeight, -halfDepth);
  group.add(backWall);

  group.add(createArenaBackdropGlow(new THREE.Vector3(0, 2.3, -halfDepth + 0.08), outerWidth * 0.68, outerHeight * 0.62, 0xe65cff, 0.2));
  group.add(createArenaBackdropGlow(new THREE.Vector3(-halfWidth + 0.08, 2.8, 0), outerDepth * 0.44, outerHeight * 0.54, 0x4ad7ff, 0.16, Math.PI / 2));
  group.add(createArenaBackdropGlow(new THREE.Vector3(halfWidth - 0.08, 2.8, -1.5), outerDepth * 0.44, outerHeight * 0.54, 0xff8f47, 0.12, -Math.PI / 2));

  const lightBarPositions = [
    new THREE.Vector3(-halfWidth + 1.2, 2.6, -8.4),
    new THREE.Vector3(-halfWidth + 1.2, 2.6, 0),
    new THREE.Vector3(-halfWidth + 1.2, 2.6, 8.4),
    new THREE.Vector3(halfWidth - 1.2, 2.6, -8.4),
    new THREE.Vector3(halfWidth - 1.2, 2.6, 0),
    new THREE.Vector3(halfWidth - 1.2, 2.6, 8.4),
  ];

  for (const [index, position] of lightBarPositions.entries()) {
    group.add(createLightBar(position, index % 2 === 0 ? LIGHT_BAR_SECONDARY_COLOR : LIGHT_BAR_COLOR));
  }

  return group;
}

function createArenaPlatform(): THREE.Group {
  const width = arena.width + 2.2;
  const depth = arena.depth + 2.8;
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.28, depth),
    new THREE.MeshStandardMaterial({
      color: PLATFORM_COLOR,
      metalness: PLATFORM_METALNESS,
      roughness: PLATFORM_ROUGHNESS,
    }),
  );
  base.position.y = -0.14;
  group.add(base);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(1.3, 1.75, 48),
    new THREE.MeshBasicMaterial({
      color: PLATFORM_GLOW_COLOR,
      transparent: true,
      opacity: PLATFORM_GLOW_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  halo.rotateX(-Math.PI / 2);
  halo.position.y = 0.021;
  group.add(halo);

  return group;
}

function createCeilingRig(): THREE.Group {
  const group = new THREE.Group();

  const hangPositions = [
    new THREE.Vector3(-1.75, arena.height + 1.2, -0.5),
    new THREE.Vector3(1.75, arena.height + 1.2, -0.5),
    new THREE.Vector3(0, arena.height + 1.2, -2.25),
    new THREE.Vector3(0, arena.height + 1.2, 1.25),
  ];

  for (const [index, position] of hangPositions.entries()) {
    group.add(createLightBar(position, index < 2 ? LIGHT_BAR_COLOR : LIGHT_BAR_SECONDARY_COLOR, 2.1, 0.055));
  }

  return group;
}

function createPlayfieldFloor(): THREE.Object3D {
  const geometry = new THREE.PlaneGeometry(arena.width, arena.depth);
  const material = new THREE.MeshStandardMaterial({
    color: PLAYFIELD_FLOOR_COLOR,
    metalness: PLAYFIELD_FLOOR_METALNESS,
    roughness: PLAYFIELD_FLOOR_ROUGHNESS,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotateX(-Math.PI / 2);
  mesh.position.y = 0;
  return mesh;
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

function createArenaBackdropGlow(
  position: THREE.Vector3,
  width: number,
  height: number,
  color: THREE.ColorRepresentation,
  opacity: number,
  rotationY = 0,
): THREE.Mesh {
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glow.position.copy(position);
  glow.rotation.y = rotationY;
  return glow;
}

function createLightBar(
  position: THREE.Vector3,
  color: THREE.ColorRepresentation,
  height = 3.8,
  width = 0.09,
): THREE.Group {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, width),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: LIGHT_BAR_OPACITY }),
  );
  core.position.copy(position);
  group.add(core);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 4.5, height * 1.05),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: LIGHT_BAR_GLOW_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  glow.position.copy(position);
  group.add(glow);

  return group;
}

function createPaddle(material: THREE.MeshStandardMaterial): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(paddle.visibleSize.x, paddle.visibleSize.y, paddle.visibleSize.z);

  return new THREE.Mesh(geometry, material);
}

function createPaddleMaterial(color: THREE.ColorRepresentation): THREE.MeshPhysicalMaterial {
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
