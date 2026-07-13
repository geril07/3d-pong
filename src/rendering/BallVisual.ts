import * as THREE from "three";

export type BallVisual = Readonly<{
  ball: THREE.Group;
  trail: THREE.Group;
  update: (
    positions: readonly THREE.Vector3[],
    isTrailVisible: boolean,
    activeTimeSeconds: number,
  ) => void;
}>;

const CYAN = new THREE.Color(0x55e7ff);
const MAGENTA = new THREE.Color(0xff55dd);
const UP = new THREE.Vector3(0, 1, 0);
const TRAIL_SEGMENT_COUNT = 8;
const FRESNEL_VERTEX_SHADER = `
  varying vec3 objectPosition;
  varying vec3 viewNormal;
  varying vec3 viewDirection;

  void main() {
    objectPosition = position;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    viewNormal = normalize(normalMatrix * normal);
    viewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

export function createBallVisual(radius: number): BallVisual {
  const ball = new THREE.Group();
  const pearl = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.88, 28, 18),
    new THREE.MeshStandardMaterial({
      color: 0x01020a,
      emissive: 0x09031b,
      emissiveIntensity: 0.65,
      metalness: 0.62,
      roughness: 0.12,
    }),
  );
  const rim = createFresnelSphere(radius);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.12, 18, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  ball.add(pearl, rim, core);

  const trail = new THREE.Group();
  const wake = Array.from({ length: TRAIL_SEGMENT_COUNT }, (_, index) => {
    const falloff = 1 - index / TRAIL_SEGMENT_COUNT;
    const segment = createWakeSegment(falloff * 0.42);
    segment.visible = false;
    trail.add(segment);
    return segment;
  });

  return {
    ball,
    trail,
    update(positions, isTrailVisible, activeTimeSeconds) {
      rim.scale.setScalar(
        1 + Math.sin(activeTimeSeconds * 4.2) * 0.025,
      );
      wake.forEach((segment, index) => {
        const falloff = 1 - index / wake.length;
        updateWakeSegment(
          segment,
          positions[index],
          positions[index + 1],
          isTrailVisible,
          radius * (0.14 + falloff * 0.72),
        );
      });
    },
  };
}

function createFresnelSphere(radius: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 28, 18),
    new THREE.ShaderMaterial({
      uniforms: {
        leftColor: { value: new THREE.Color(0x4ce8ff) },
        rightColor: { value: new THREE.Color(0xff4edb) },
        opacity: { value: 1 },
      },
      vertexShader: FRESNEL_VERTEX_SHADER,
      fragmentShader: `
        uniform vec3 leftColor;
        uniform vec3 rightColor;
        uniform float opacity;
        varying vec3 objectPosition;
        varying vec3 viewNormal;
        varying vec3 viewDirection;

        void main() {
          float rim = pow(1.0 - abs(dot(normalize(viewNormal), normalize(viewDirection))), 2.4);
          float split = smoothstep(-0.12, 0.12, objectPosition.x);
          vec3 color = mix(leftColor, rightColor, split);
          float alpha = opacity * (0.08 + rim * 0.92);
          gl_FragColor = vec4(color * (0.72 + rim * 1.5), alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
}

function createWakeSegment(opacity: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1, 12, 1, true),
    new THREE.ShaderMaterial({
      uniforms: {
        leftColor: { value: CYAN },
        rightColor: { value: MAGENTA },
        opacity: { value: opacity },
      },
      vertexShader: FRESNEL_VERTEX_SHADER,
      fragmentShader: `
        uniform vec3 leftColor;
        uniform vec3 rightColor;
        uniform float opacity;
        varying vec3 objectPosition;
        varying vec3 viewNormal;
        varying vec3 viewDirection;

        void main() {
          float edge = pow(1.0 - abs(dot(normalize(viewNormal), normalize(viewDirection))), 2.0);
          float split = smoothstep(-0.45, 0.45, objectPosition.x);
          vec3 color = mix(leftColor, rightColor, split);
          gl_FragColor = vec4(color * (0.42 + edge), opacity * (0.08 + edge * 0.92));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
}

function updateWakeSegment(
  segment: THREE.Mesh,
  start: THREE.Vector3 | undefined,
  end: THREE.Vector3 | undefined,
  isVisible: boolean,
  thickness: number,
): void {
  segment.visible = isVisible && Boolean(start && end);
  if (!start || !end) return;

  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length === 0) {
    segment.visible = false;
    return;
  }

  segment.position.copy(start).add(end).multiplyScalar(0.5);
  segment.quaternion.setFromUnitVectors(UP, direction.normalize());
  segment.scale.set(thickness, length, thickness);
}
