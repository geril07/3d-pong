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
const BALL_EMISSIVE_COLOR = 0x001122;
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
  readonly #playerPaddleMaterial: THREE.MeshBasicMaterial;
  readonly #opponentPaddleMaterial: THREE.MeshBasicMaterial;
  readonly #ball: THREE.Mesh;
  readonly #playerPaddle: THREE.Mesh;
  readonly #opponentPaddle: THREE.Mesh;
  #trail: THREE.Mesh[];
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
    this.#playerPaddle = createPaddle(this.#playerPaddleMaterial, 0.3);
    this.#scene.add(this.#playerPaddle);

    this.#opponentPaddleMaterial = createPaddleMaterial(0xff5edb);
    this.#opponentPaddle = createPaddle(this.#opponentPaddleMaterial, 0.4);
    this.#scene.add(this.#opponentPaddle);

    const ballGeometry = new THREE.SphereGeometry(ball.radius, 24, 16);
    this.#ball = new THREE.Mesh(
      ballGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x075b73,
        emissive: BALL_EMISSIVE_COLOR,
        transparent: true,
      }),
    );
    this.#ball.renderOrder = 1;
    this.#scene.add(this.#ball);
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
  glowOpacity: number,
): THREE.Mesh {
  const geometry = new RoundedBoxGeometry(
    paddle.visibleSize.x,
    paddle.visibleSize.y,
    paddle.visibleSize.z,
    3,
    Math.min(paddle.visibleSize.x, paddle.visibleSize.y) * 0.08,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.add(createPaddleRim(material.color, glowOpacity));

  return mesh;
}

function createPaddleRim(color: THREE.Color, glowOpacity: number): THREE.Mesh {
  const glowWidth = 0.14;
  const planeSize = new THREE.Vector2(
    paddle.visibleSize.x + glowWidth * 2,
    paddle.visibleSize.y + glowWidth * 2,
  );
  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: color },
      planeSize: { value: planeSize },
      boxHalfSize: {
        value: new THREE.Vector2(
          paddle.visibleSize.x / 2,
          paddle.visibleSize.y / 2,
        ),
      },
      radius: {
        value: Math.min(paddle.visibleSize.x, paddle.visibleSize.y) * 0.08,
      },
      coreWidth: { value: 0.018 },
      glowWidth: { value: glowWidth },
      glowOpacity: { value: glowOpacity },
    },
    vertexShader: `
      uniform vec2 planeSize;
      varying vec2 positionOnPlane;

      void main() {
        positionOnPlane = (uv - 0.5) * planeSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform vec2 boxHalfSize;
      uniform float radius;
      uniform float coreWidth;
      uniform float glowWidth;
      uniform float glowOpacity;
      varying vec2 positionOnPlane;

      float roundedBoxDistance(vec2 point, vec2 halfSize, float cornerRadius) {
        vec2 offset = abs(point) - halfSize + cornerRadius;
        return min(max(offset.x, offset.y), 0.0)
          + length(max(offset, 0.0)) - cornerRadius;
      }

      void main() {
        float edgeDistance = abs(roundedBoxDistance(positionOnPlane, boxHalfSize, radius));
        float smoothing = max(fwidth(edgeDistance), 0.0005);
        float core = 1.0 - smoothstep(coreWidth - smoothing, coreWidth + smoothing, edgeDistance);
        float glow = 1.0 - smoothstep(coreWidth, glowWidth, edgeDistance);
        float alpha = max(core * 0.92, glow * glow * glowOpacity);

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const rim = new THREE.Mesh(
    new THREE.PlaneGeometry(planeSize.x, planeSize.y),
    material,
  );
  rim.position.z = paddle.visibleSize.z / 2 + 0.001;
  rim.renderOrder = 10;
  return rim;
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
