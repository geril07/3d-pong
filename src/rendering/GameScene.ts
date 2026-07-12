import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
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
const WALL_OPACITY = 0.03;
const SIDE_WALL_TINT = 0x9186ff;
const WALL_GEOMETRY_THICKNESS = 0.0375;
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
  readonly #playerPaddleMaterial: THREE.MeshBasicMaterial;
  readonly #opponentPaddleMaterial: THREE.MeshBasicMaterial;
  readonly #ball: THREE.Mesh;
  readonly #playerPaddle: THREE.Mesh;
  readonly #opponentPaddle: THREE.Mesh;
  #trail: THREE.Mesh[];
  #trailPositions: THREE.Vector3[] = [];
  #lastTrailPosition: THREE.Vector3 | null = null;
  #hitFlashUntilSeconds = 0;
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
    this.#camera.position.set(0, 4.05, 11.1);
    this.#camera.lookAt(0, 1.8, -1.6);

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

    this.#scene.add(createPlayfieldFloor());
    this.#scene.add(createBarrierVolume());
    this.#scene.add(createArenaFrame());

    this.#playerPaddleMaterial = createPaddleMaterial(0x45d7ff);
    this.#playerPaddle = createPaddle(this.#playerPaddleMaterial, 1.45);
    this.#scene.add(this.#playerPaddle);

    this.#opponentPaddleMaterial = createPaddleMaterial(0xff5edb);
    this.#opponentPaddle = createPaddle(this.#opponentPaddleMaterial, 2.8);
    this.#scene.add(this.#opponentPaddle);

    const ballGeometry = new THREE.SphereGeometry(ball.radius, 24, 16);
    this.#ballMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f7ff,
      emissive: BALL_EMISSIVE_COLOR,
    });
    this.#ball = new THREE.Mesh(ballGeometry, this.#ballMaterial);
    this.#scene.add(this.#ball);
    this.#ball.add(createBallHalo());
    this.#trail = createBallTrail();

    for (const trailPart of this.#trail) {
      this.#scene.add(trailPart);
    }

    const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      samples: 4,
      type: THREE.HalfFloatType,
    });
    this.#composer = new EffectComposer(this.#renderer, renderTarget);
    this.#composer.addPass(new RenderPass(this.#scene, this.#camera));
    this.#composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(1, 1), 0.72, 0.48, 0.72),
    );
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

    const viewportHeight =
      2 *
      Math.tan(THREE.MathUtils.degToRad(this.#camera.fov / 2)) *
      BACKDROP_DISTANCE;
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
    const isGameplayActive =
      snapshot.phase === "running" || snapshot.phase === "serve-delay";

    this.#renderer.setClearColor(
      isScoreFlashActive
        ? SCORE_FLASH_BACKGROUND_COLOR
        : SCENE_BACKGROUND_COLOR,
      1,
    );
    this.#ball.scale.setScalar(isHitFlashActive ? 1.24 : 1);
    this.#ballMaterial.emissive.setHex(
      isHitFlashActive ? BALL_HIT_EMISSIVE_COLOR : BALL_EMISSIVE_COLOR,
    );
    this.#playerPaddle.scale.setScalar(isGameplayActive ? 1 : 0.96);

    this.#composer.render();
  }

  #updateFeedback(snapshot: GameSnapshot): void {
    const nowSeconds = performance.now() / 1000;

    for (const event of snapshot.events) {
      if (event.type === "paddle-hit") {
        this.#hitFlashUntilSeconds = nowSeconds + 0.14;
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

    if (
      !this.#lastTrailPosition ||
      currentPosition.distanceTo(this.#lastTrailPosition) > 0.025
    ) {
      this.#trailPositions.unshift(currentPosition.clone());
      this.#trailPositions = this.#trailPositions.slice(0, TRAIL_LENGTH);
      this.#lastTrailPosition = currentPosition;
    }

    for (let index = 0; index < this.#trail.length; index += 1) {
      const trailPart = this.#trail[index];
      const trailPosition = this.#trailPositions[index];

      trailPart.visible =
        Boolean(trailPosition) && snapshot.phase !== "serve-delay";

      if (trailPosition) {
        trailPart.position.copy(trailPosition);
      }
    }
  }
}

function createPlayfieldFloor(): THREE.Object3D {
  const geometry = new THREE.PlaneGeometry(arena.width, arena.depth);
  const material = new THREE.MeshBasicMaterial({
    color: 0x554778,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotateX(-Math.PI / 2);
  mesh.position.y = 0;
  return mesh;
}

function createArenaFrame(): THREE.Group {
  const group = new THREE.Group();
  const halfWidth = arena.width / 2;
  const halfDepth = arena.depth / 2;
  const corners = [
    new THREE.Vector3(-halfWidth, 0, -halfDepth),
    new THREE.Vector3(halfWidth, 0, -halfDepth),
    new THREE.Vector3(halfWidth, 0, halfDepth),
    new THREE.Vector3(-halfWidth, 0, halfDepth),
    new THREE.Vector3(-halfWidth, arena.height, -halfDepth),
    new THREE.Vector3(halfWidth, arena.height, -halfDepth),
    new THREE.Vector3(halfWidth, arena.height, halfDepth),
    new THREE.Vector3(-halfWidth, arena.height, halfDepth),
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  const railMaterial = new THREE.MeshBasicMaterial({
    color: 0x8179ad,
    transparent: true,
    opacity: 0.76,
  });

  for (const [startIndex, endIndex] of edges) {
    group.add(createRail(corners[startIndex], corners[endIndex], railMaterial));
  }

  return group;
}

function createRail(
  start: THREE.Vector3,
  end: THREE.Vector3,
  material: THREE.Material,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(end, start);
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, direction.length(), 0.035),
    material,
  );
  rail.position.copy(start).add(end).multiplyScalar(0.5);
  rail.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return rail;
}

function createBarrierVolume(): THREE.Group {
  const halfWidth = arena.width / 2;
  const halfDepth = arena.depth / 2;
  const height = arena.height;
  const group = new THREE.Group();

  group.add(
    createWall(
      new THREE.BoxGeometry(WALL_GEOMETRY_THICKNESS, height, arena.depth),
      new THREE.Vector3(-halfWidth, height / 2, 0),
      SIDE_WALL_TINT,
    ),
  );
  group.add(
    createWall(
      new THREE.BoxGeometry(WALL_GEOMETRY_THICKNESS, height, arena.depth),
      new THREE.Vector3(halfWidth, height / 2, 0),
      SIDE_WALL_TINT,
    ),
  );
  group.add(
    createWall(
      new THREE.BoxGeometry(arena.width, WALL_GEOMETRY_THICKNESS, arena.depth),
      new THREE.Vector3(0, height, 0),
      SIDE_WALL_TINT,
    ),
  );
  group.add(
    createWall(
      new THREE.BoxGeometry(arena.width, height, WALL_GEOMETRY_THICKNESS),
      new THREE.Vector3(0, height / 2, -halfDepth),
      SIDE_WALL_TINT,
    ),
  );

  return group;
}

function createWall(
  geometry: THREE.BoxGeometry,
  position: THREE.Vector3,
  tint: THREE.ColorRepresentation,
): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    color: tint,
    transparent: true,
    opacity: WALL_OPACITY,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);

  return mesh;
}

function createPaddle(
  material: THREE.MeshBasicMaterial,
  rimIntensity: number,
): THREE.Mesh {
  const geometry = new RoundedBoxGeometry(
    paddle.visibleSize.x,
    paddle.visibleSize.y,
    paddle.visibleSize.z,
    3,
    Math.min(paddle.visibleSize.x, paddle.visibleSize.y) * 0.08,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.add(createPaddleRim(material.color, rimIntensity));

  const pane = new THREE.Mesh(
    new RoundedBoxGeometry(
      paddle.visibleSize.x * 0.84,
      paddle.visibleSize.y * 0.78,
      paddle.visibleSize.z * 0.34,
      2,
      Math.min(paddle.visibleSize.x, paddle.visibleSize.y) * 0.04,
    ),
    new THREE.MeshBasicMaterial({
      color: material.color,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
    }),
  );
  mesh.add(pane);

  return mesh;
}

function createPaddleRim(color: THREE.Color, intensity: number): THREE.Group {
  const group = new THREE.Group();
  const thickness =
    Math.min(paddle.visibleSize.x, paddle.visibleSize.y) * 0.055;
  const depth = paddle.visibleSize.z * 1.08;
  const material = new THREE.MeshBasicMaterial({
    color: color.clone().multiplyScalar(intensity),
    transparent: true,
    opacity: 0.82,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const horizontalGeometry = new RoundedBoxGeometry(
    paddle.visibleSize.x,
    thickness,
    depth,
    2,
    thickness * 0.4,
  );
  const verticalGeometry = new RoundedBoxGeometry(
    thickness,
    paddle.visibleSize.y - thickness * 2,
    depth,
    2,
    thickness * 0.4,
  );

  for (const y of [
    -(paddle.visibleSize.y - thickness) / 2,
    (paddle.visibleSize.y - thickness) / 2,
  ]) {
    const rail = new THREE.Mesh(horizontalGeometry, material);
    rail.position.y = y;
    rail.renderOrder = 10;
    group.add(rail);
  }

  for (const x of [
    -(paddle.visibleSize.x - thickness) / 2,
    (paddle.visibleSize.x - thickness) / 2,
  ]) {
    const rail = new THREE.Mesh(verticalGeometry, material);
    rail.position.x = x;
    rail.renderOrder = 10;
    group.add(rail);
  }

  return group;
}

function createPaddleMaterial(
  color: THREE.ColorRepresentation,
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
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
