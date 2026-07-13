import * as THREE from "three";

export type GoalEffect = Readonly<{
  group: THREE.Group;
  trigger: (
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    nowSeconds: number,
  ) => void;
  update: (nowSeconds: number) => boolean;
}>;

const CYAN = new THREE.Color(0x55e7ff);
const MAGENTA = new THREE.Color(0xff55dd);
const FORWARD = new THREE.Vector3(0, 0, 1);
const EFFECT_DURATION_SECONDS = 0.5;

export function createGoalEffect(radius: number): GoalEffect {
  const root = new THREE.Group();
  root.visible = false;
  root.renderOrder = 4;

  const dust = createDustCloud(132, radius);
  root.add(dust.points);

  let startedAt = -Infinity;
  let trajectorySpeed = 4.5;

  return {
    group: root,
    trigger(position, velocity, nowSeconds) {
      root.visible = true;
      root.position.copy(position);
      const direction = velocity.lengthSq() > 0 ? velocity.clone().normalize() : FORWARD;
      root.quaternion.setFromUnitVectors(FORWARD, direction);
      startedAt = nowSeconds;
      trajectorySpeed = velocity.length();
    },
    update(nowSeconds) {
      const elapsed = nowSeconds - startedAt;
      if (elapsed < 0 || elapsed >= EFFECT_DURATION_SECONDS) {
        root.visible = false;
        return false;
      }

      const progress = THREE.MathUtils.clamp(
        elapsed / EFFECT_DURATION_SECONDS,
        0,
        1,
      );
      dust.update(
        progress,
        trajectorySpeed * progress * EFFECT_DURATION_SECONDS,
      );
      return true;
    },
  };
}

function createDustCloud(
  count: number,
  radius: number,
): Readonly<{
  points: THREE.Points;
  update: (progress: number, trajectoryTravel: number) => void;
}> {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const particleAlphas = new Float32Array(count);
  const pointSizes = new Float32Array(count);
  const basePointSizes = new Float32Array(count);
  const directions = Array.from({ length: count }, (_, index) => fibonacciDirection(index, count));
  const color = new THREE.Color();

  directions.forEach((direction, index) => {
    const tint = index % 18 === 0 ? new THREE.Color(0xffffff) : index % 2 === 0 ? CYAN : MAGENTA;
    color.copy(tint);
    colors.set([color.r, color.g, color.b], index * 3);
    basePointSizes[index] = 1.5 + hash(index, 13) * 3;
    pointSizes[index] = basePointSizes[index];
    particleAlphas[index] = 1;
    positions.set(
      [direction.x * radius * 0.82, direction.y * radius * 0.82, direction.z * radius * 0.82],
      index * 3,
    );
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("particleColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("particleAlpha", new THREE.BufferAttribute(particleAlphas, 1));
  geometry.setAttribute("pointSize", new THREE.BufferAttribute(pointSizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 1 } },
    vertexShader: `
      attribute float pointSize;
      attribute float particleAlpha;
      attribute vec3 particleColor;
      varying vec3 pointColor;
      varying float pointAlpha;
      void main() {
        pointColor = particleColor;
        pointAlpha = particleAlpha;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = pointSize;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec3 pointColor;
      varying float pointAlpha;
      void main() {
        float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
        float disc = 1.0 - smoothstep(0.18, 0.5, distanceFromCenter);
        float hotCore = 1.0 - smoothstep(0.0, 0.2, distanceFromCenter);
        gl_FragColor = vec4(
          pointColor * (0.48 + hotCore * 0.92),
          opacity * pointAlpha * disc * 0.88
        );
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);

  return {
    points,
    update(progress, trajectoryTravel) {
      const globalFade = 1 - smoothstep(0.72, 1, progress);
      directions.forEach((direction, index) => {
        const releaseAt = 0.04 + hash(index, 19) * 0.18;
        const local = remap(progress, releaseAt, 0.88);
        const drag = 0.6 + hash(index, 5) * 6.5;
        const curl = local * (3.2 + hash(index, 29) * 2.8) + index * 0.31;
        const radialTravel = radius * local * (0.65 + hash(index, 31) * 1.25);
        positions[index * 3] =
          direction.x * radius * 0.82 +
          direction.x * radialTravel +
          Math.cos(curl) * radius * local * 0.28;
        positions[index * 3 + 1] =
          direction.y * radius * 0.82 +
          direction.y * radialTravel +
          Math.sin(curl) * radius * local * 0.28;
        positions[index * 3 + 2] =
          trajectoryTravel +
          direction.z * radius * 0.82 -
          radius * easeOutCubic(local) * drag;
        particleAlphas[index] = globalFade;
        pointSizes[index] = basePointSizes[index] * (1 - local * 0.24);
      });
      geometry.getAttribute("position").needsUpdate = true;
      geometry.getAttribute("particleAlpha").needsUpdate = true;
      geometry.getAttribute("pointSize").needsUpdate = true;
    },
  };
}

function fibonacciDirection(index: number, count: number): THREE.Vector3 {
  const y = 1 - ((index + 0.5) / count) * 2;
  const radial = Math.sqrt(1 - y * y);
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  return new THREE.Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial);
}

function hash(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function remap(value: number, start: number, end: number): number {
  return THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
}

function smoothstep(start: number, end: number, value: number): number {
  const t = remap(value, start, end);
  return t * t * (3 - 2 * t);
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}
