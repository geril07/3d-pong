import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_CONFIG } from "../simulation/GameSimulation";
import { createPaddleMesh } from "./PaddleVisual";

describe("createPaddleMesh", () => {
  it("keeps both rendered paddles inside the arena at every movement-area corner", () => {
    const { arena, paddle } = DEFAULT_GAME_CONFIG;
    const arenaHalfWidth = arena.width / 2;
    const epsilon = 1e-6;
    const mesh = createPaddleMesh(paddle, 0xffffff, 0.4);

    for (const area of [paddle.playerArea, paddle.opponentArea]) {
      for (const x of [area.minX, area.maxX]) {
        for (const y of [area.minY, area.maxY]) {
          mesh.position.set(x, y, area.z);
          mesh.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(mesh);

          expect(bounds.min.x).toBeGreaterThanOrEqual(-arenaHalfWidth - epsilon);
          expect(bounds.max.x).toBeLessThanOrEqual(arenaHalfWidth + epsilon);
          expect(bounds.min.y).toBeGreaterThanOrEqual(-epsilon);
          expect(bounds.max.y).toBeLessThanOrEqual(arena.height + epsilon);
        }
      }
    }
  });
});
