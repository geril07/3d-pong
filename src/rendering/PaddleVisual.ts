import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PaddleConfig } from "../simulation/GameSimulation";

export function createPaddleMesh(
  paddle: Pick<PaddleConfig, "visibleSize" | "edgeGlowWidth">,
  color: THREE.ColorRepresentation,
  glowOpacity: number,
): THREE.Mesh {
  const geometry = new RoundedBoxGeometry(
    paddle.visibleSize.x,
    paddle.visibleSize.y,
    paddle.visibleSize.z,
    3,
    Math.min(paddle.visibleSize.x, paddle.visibleSize.y) * 0.08,
  );
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.add(createPaddleRim(paddle, material.color, glowOpacity));

  return mesh;
}

function createPaddleRim(
  paddle: Pick<PaddleConfig, "visibleSize" | "edgeGlowWidth">,
  color: THREE.Color,
  glowOpacity: number,
): THREE.Mesh {
  const glowWidth = paddle.edgeGlowWidth;
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
