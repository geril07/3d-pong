import * as THREE from "three";
import type { ArenaConfig } from "../simulation/GameSimulation";

const RAIL_CORE_THICKNESS = 0.008;
const BLOOM_MASK_THICKNESS = 0.05;
const LEFT_RAIL_COLOR = new THREE.Color(0x42e8ff);
const RIGHT_RAIL_COLOR = new THREE.Color(0xff4edb);
const BLOOM_MASK_LUMINANCE = 0.84;
export const ARENA_BLOOM_LAYER = 1;

export function createArenaRoom(arena: ArenaConfig): THREE.Group {
  const room = new THREE.Group();
  room.add(createFloor(arena));
  room.add(createGlassVolume(arena));
  room.add(createFrame(arena));
  return room;
}

function createFloor(arena: ArenaConfig): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      leftColor: { value: LEFT_RAIL_COLOR },
      rightColor: { value: RIGHT_RAIL_COLOR },
      gridScale: { value: new THREE.Vector2(10, 12) },
      baseColor: { value: new THREE.Color(0.012, 0.016, 0.052) },
      baseAlpha: { value: 0.3 },
      lineColorMix: { value: 0.24 },
      lineAlpha: { value: 0.14 },
      farVisibility: { value: 0.3 },
      fadeLineColor: { value: 1 },
    },
    vertexShader: `
      varying vec2 floorUv;

      void main() {
        floorUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 leftColor;
      uniform vec3 rightColor;
      uniform vec2 gridScale;
      uniform vec3 baseColor;
      uniform float baseAlpha;
      uniform float lineColorMix;
      uniform float lineAlpha;
      uniform float farVisibility;
      uniform float fadeLineColor;
      varying vec2 floorUv;

      void main() {
        vec2 gridCoordinate = floorUv * gridScale;
        vec2 derivativeWidth = max(fwidth(gridCoordinate), vec2(0.0001));
        vec2 gridDistance = abs(fract(gridCoordinate - 0.5) - 0.5) / derivativeWidth;
        float gridLine = 1.0 - min(min(gridDistance.x, gridDistance.y), 1.0);
        float distanceFade = mix(1.0, farVisibility, smoothstep(0.12, 1.0, floorUv.y));
        float colorVisibility = mix(1.0, distanceFade, fadeLineColor);
        vec3 gridColor = mix(leftColor, rightColor, floorUv.x);
        vec3 color = mix(baseColor, gridColor, gridLine * lineColorMix * colorVisibility);
        float alpha = baseAlpha + gridLine * lineAlpha * distanceFade;

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(arena.width, arena.depth),
    material,
  );
  floor.rotateX(-Math.PI / 2);
  return floor;
}

function createGlassVolume(arena: ArenaConfig): THREE.Group {
  const halfWidth = arena.width / 2;
  const halfDepth = arena.depth / 2;
  const group = new THREE.Group();

  group.add(
    createGlassPlane(
      arena.depth,
      arena.height,
      new THREE.Vector3(-halfWidth, arena.height / 2, 0),
      new THREE.Euler(0, Math.PI / 2, 0),
      0x164d70,
    ),
    createGlassPlane(
      arena.depth,
      arena.height,
      new THREE.Vector3(halfWidth, arena.height / 2, 0),
      new THREE.Euler(0, Math.PI / 2, 0),
      0x69205e,
    ),
    createGlassPlane(
      arena.width,
      arena.depth,
      new THREE.Vector3(0, arena.height, 0),
      new THREE.Euler(Math.PI / 2, 0, 0),
      0x37245f,
    ),
    createGlassPlane(
      arena.width,
      arena.height,
      new THREE.Vector3(0, arena.height / 2, -halfDepth),
      new THREE.Euler(0, 0, 0),
      0x201b4d,
    ),
  );

  return group;
}

function createGlassPanel(
  geometry: THREE.BufferGeometry,
  position: THREE.Vector3,
  tint: THREE.ColorRepresentation,
): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tint: { value: new THREE.Color(tint) },
      faceAlpha: { value: 0.045 },
      edgeAlpha: { value: 0.11 },
    },
    vertexShader: `
      varying vec3 viewNormal;
      varying vec3 viewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        viewNormal = normalize(normalMatrix * normal);
        viewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 tint;
      uniform float faceAlpha;
      uniform float edgeAlpha;
      varying vec3 viewNormal;
      varying vec3 viewDirection;

      void main() {
        float facing = abs(dot(normalize(viewNormal), normalize(viewDirection)));
        float edge = pow(1.0 - facing, 1.8);
        float alpha = mix(faceAlpha, edgeAlpha, edge);
        vec3 color = mix(tint * 0.62, tint, edge);

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const panel = new THREE.Mesh(geometry, material);
  panel.position.copy(position);
  return panel;
}

function createGlassPlane(
  width: number,
  height: number,
  position: THREE.Vector3,
  rotation: THREE.Euler,
  tint: THREE.ColorRepresentation,
): THREE.Mesh {
  const plane = createGlassPanel(
    new THREE.PlaneGeometry(width, height),
    position,
    tint,
  );
  plane.rotation.copy(rotation);
  return plane;
}

function createFrame(arena: ArenaConfig): THREE.Group {
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
  ] as const;
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.25, 1.25, 1.25),
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false,
  });
  const bloomMaskMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    depthWrite: false,
    toneMapped: false,
  });
  const group = new THREE.Group();

  for (const [startIndex, endIndex] of edges) {
    const start = corners[startIndex];
    const end = corners[endIndex];
    const startColor = colorAtX(start.x, arena.width);
    const endColor = colorAtX(end.x, arena.width);
    group.add(
      createRail(
        start,
        end,
        RAIL_CORE_THICKNESS,
        startColor,
        endColor,
        coreMaterial,
      ),
    );
    const bloomMask = createRail(
      start,
      end,
      BLOOM_MASK_THICKNESS,
      normalizeBloomColor(startColor),
      normalizeBloomColor(endColor),
      bloomMaskMaterial,
    );
    bloomMask.layers.set(ARENA_BLOOM_LAYER);
    group.add(bloomMask);
  }

  // ponytail: renderOrder goes on each rail, not the Group. The Group's
  // renderOrder cascades to children as groupOrder (the primary sort key
  // in three.js), which would push the rails above the paddle rim
  // (renderOrder 10) and paint them over the paddle's border.
  return group;
}

function createRail(
  start: THREE.Vector3,
  end: THREE.Vector3,
  thickness: number,
  startColor: THREE.Color,
  endColor: THREE.Color,
  material: THREE.Material,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.BoxGeometry(thickness, length, thickness);
  const positions = geometry.getAttribute("position");
  const colors: number[] = [];
  const color = new THREE.Color();

  for (let index = 0; index < positions.count; index += 1) {
    const interpolation = positions.getY(index) / length + 0.5;
    color.lerpColors(startColor, endColor, interpolation);
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const rail = new THREE.Mesh(geometry, material);
  rail.renderOrder = 5;
  rail.position.copy(start).add(end).multiplyScalar(0.5);
  rail.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return rail;
}

function colorAtX(x: number, arenaWidth: number): THREE.Color {
  const interpolation = THREE.MathUtils.clamp(x / arenaWidth + 0.5, 0, 1);
  return new THREE.Color().lerpColors(
    LEFT_RAIL_COLOR,
    RIGHT_RAIL_COLOR,
    interpolation,
  );
}

function normalizeBloomColor(color: THREE.Color): THREE.Color {
  const luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  return color.clone().multiplyScalar(BLOOM_MASK_LUMINANCE / luminance);
}
