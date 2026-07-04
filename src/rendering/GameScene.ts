import * as THREE from "three";
import type { GameSnapshot } from "../simulation/GameRuntime";

const arena = {
  width: 6,
  height: 3.2,
  depth: 8,
};

export class GameScene {
  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene: THREE.Scene;
  readonly #camera: THREE.PerspectiveCamera;
  readonly #ball: THREE.Mesh;
  readonly #playerPaddle: THREE.Mesh;

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
    this.#scene.add(createPaddleMovementArea());

    this.#playerPaddle = createPaddle(0x45d7ff);
    this.#playerPaddle.position.set(0, 1.45, arena.depth / 2 - 0.25);
    this.#scene.add(this.#playerPaddle);

    const opponentPaddle = createPaddle(0xff9d38);
    opponentPaddle.position.set(0, 1.45, -arena.depth / 2 + 0.25);
    this.#scene.add(opponentPaddle);

    const ballGeometry = new THREE.SphereGeometry(0.13, 24, 16);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f7ff, emissive: 0x1d2746 });
    this.#ball = new THREE.Mesh(ballGeometry, ballMaterial);
    this.#ball.position.set(0, 1.45, 0);
    this.#scene.add(this.#ball);

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
    const time = snapshot.activeTimeSeconds;
    this.#ball.position.x = Math.sin(time * 0.9) * 0.35;
    this.#ball.position.y = 1.45 + Math.sin(time * 1.7) * 0.08;
    this.#ball.rotation.y = time * 1.5;

    const isCaptured = snapshot.phase === "running";
    this.#playerPaddle.scale.setScalar(isCaptured ? 1 : 0.96);

    this.#renderer.render(this.#scene, this.#camera);
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

function createPaddleMovementArea(): THREE.LineLoop {
  const z = arena.depth / 2 - 0.22;
  const minX = -2.2;
  const maxX = 2.2;
  const minY = 0.45;
  const maxY = 2.55;

  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(minX, minY, z),
    new THREE.Vector3(maxX, minY, z),
    new THREE.Vector3(maxX, maxY, z),
    new THREE.Vector3(minX, maxY, z),
  ]);
  const material = new THREE.LineBasicMaterial({ color: 0x45d7ff, transparent: true, opacity: 0.4 });

  return new THREE.LineLoop(geometry, material);
}

function createPaddle(color: THREE.ColorRepresentation): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(0.9, 0.6, 0.12);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.1 });

  return new THREE.Mesh(geometry, material);
}
