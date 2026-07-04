import * as THREE from "three";
import type { GameSnapshot } from "../simulation/GameRuntime";
import { DEFAULT_GAME_CONFIG, type MovementArea } from "../simulation/GameSimulation";

const { arena, ball, collision, paddle } = DEFAULT_GAME_CONFIG;
const TRAIL_LENGTH = 9;

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
    this.#renderer.setClearColor(0x050711, 1);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.#scene = new THREE.Scene();
    this.#scene.fog = new THREE.Fog(0x050711, 9, 18);

    this.#camera = new THREE.PerspectiveCamera(56, 1, 0.1, 50);
    this.#camera.position.set(0, 2.7, 7.8);
    this.#camera.lookAt(0, 1.45, -2.5);

    this.#scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(2.5, 5, 4);
    this.#scene.add(keyLight);

    this.#scene.add(createArenaBounds());
    this.#scene.add(createFloorGrid());
    this.#scene.add(createPaddleMovementArea(paddle.playerArea, 0x45d7ff, 0.38));
    this.#scene.add(createPaddleMovementArea(paddle.opponentArea, 0xff9d38, 0.24));

    this.#playerPaddleMaterial = createPaddleMaterial(0x45d7ff);
    this.#playerPaddle = createPaddle(this.#playerPaddleMaterial);
    this.#playerPaddle.add(createBufferZoneIndicator(0x45d7ff, -paddle.visibleSize.z));
    this.#scene.add(this.#playerPaddle);

    this.#opponentPaddleMaterial = createPaddleMaterial(0xff9d38);
    this.#opponentPaddle = createPaddle(this.#opponentPaddleMaterial);
    this.#opponentPaddle.add(createBufferZoneIndicator(0xff9d38, paddle.visibleSize.z));
    this.#scene.add(this.#opponentPaddle);

    const ballGeometry = new THREE.SphereGeometry(ball.radius, 24, 16);
    this.#ballMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f7ff, emissive: 0x1d2746 });
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

    this.#renderer.setClearColor(isScoreFlashActive ? 0x0c1224 : 0x050711, 1);
    this.#ball.scale.setScalar(isHitFlashActive ? 1.24 : 1);
    this.#ballMaterial.emissive.setHex(isHitFlashActive ? 0x8fb9ff : 0x1d2746);
    this.#playerPaddle.scale.setScalar(isGameplayActive ? 1 : 0.96);
    this.#playerPaddleMaterial.emissive.setHex(isHitFlashActive && this.#lastHitSide === "player" ? 0x164960 : 0x000000);
    this.#opponentPaddleMaterial.emissive.setHex(
      isHitFlashActive && this.#lastHitSide === "opponent" ? 0x5a2d08 : 0x000000,
    );

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

function createArenaBounds(): THREE.LineSegments {
  const halfWidth = arena.width / 2;
  const halfDepth = arena.depth / 2;
  const floor = 0;
  const ceiling = arena.height;
  const corners = [
    new THREE.Vector3(-halfWidth, floor, -halfDepth),
    new THREE.Vector3(halfWidth, floor, -halfDepth),
    new THREE.Vector3(halfWidth, floor, halfDepth),
    new THREE.Vector3(-halfWidth, floor, halfDepth),
    new THREE.Vector3(-halfWidth, ceiling, -halfDepth),
    new THREE.Vector3(halfWidth, ceiling, -halfDepth),
    new THREE.Vector3(halfWidth, ceiling, halfDepth),
    new THREE.Vector3(-halfWidth, ceiling, halfDepth),
  ];

  const edges = [
    corners[0],
    corners[1],
    corners[1],
    corners[2],
    corners[2],
    corners[3],
    corners[3],
    corners[0],
    corners[4],
    corners[5],
    corners[5],
    corners[6],
    corners[6],
    corners[7],
    corners[7],
    corners[4],
    corners[0],
    corners[4],
    corners[1],
    corners[5],
    corners[2],
    corners[6],
    corners[3],
    corners[7],
  ];

  const geometry = new THREE.BufferGeometry().setFromPoints(edges);
  const material = new THREE.LineBasicMaterial({ color: 0x2f90ff, transparent: true, opacity: 0.55 });

  return new THREE.LineSegments(geometry, material);
}

function createFloorGrid(): THREE.GridHelper {
  const grid = new THREE.GridHelper(arena.depth, 8, 0x285c9a, 0x132c4c);
  grid.position.y = 0.01;
  grid.scale.x = arena.width / arena.depth;
  return grid;
}

function createPaddleMovementArea(
  area: MovementArea,
  color: THREE.ColorRepresentation,
  opacity: number,
): THREE.LineLoop {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(area.minX, area.minY, area.z),
    new THREE.Vector3(area.maxX, area.minY, area.z),
    new THREE.Vector3(area.maxX, area.maxY, area.z),
    new THREE.Vector3(area.minX, area.maxY, area.z),
  ]);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });

  return new THREE.LineLoop(geometry, material);
}

function createBufferZoneIndicator(color: THREE.ColorRepresentation, zOffset: number): THREE.LineLoop {
  const halfWidth = paddle.visibleSize.x / 2 + collision.forgivingHitbox.x + collision.bufferZone.x;
  const halfHeight = paddle.visibleSize.y / 2 + collision.forgivingHitbox.y + collision.bufferZone.y;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfWidth, -halfHeight, zOffset),
    new THREE.Vector3(halfWidth, -halfHeight, zOffset),
    new THREE.Vector3(halfWidth, halfHeight, zOffset),
    new THREE.Vector3(-halfWidth, halfHeight, zOffset),
  ]);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.18 });

  return new THREE.LineLoop(geometry, material);
}

function createPaddle(material: THREE.MeshStandardMaterial): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(paddle.visibleSize.x, paddle.visibleSize.y, paddle.visibleSize.z);

  return new THREE.Mesh(geometry, material);
}

function createPaddleMaterial(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.1 });
}

function createBallTrail(): THREE.Mesh[] {
  return Array.from({ length: TRAIL_LENGTH }, (_, index) => {
    const falloff = 1 - index / TRAIL_LENGTH;
    const geometry = new THREE.SphereGeometry(ball.radius, 16, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0x9cc9ff,
      transparent: true,
      opacity: falloff * 0.24,
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
