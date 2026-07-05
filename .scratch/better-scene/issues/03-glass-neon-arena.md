# Glass Neon Arena

Status: resolved

## What to build

Replace the empty void with a cohesive "glass neon arena" that gives real 3D bounding cues without reintroducing the debug wireframe cage. The design builds on the existing frosted-glass paddle identity and the minimalist neon palette already in the scene.

Three elements, all using three.js materials already imported and all values kept as named constants/config:

1. **Reflective floor** — a dark, near-mirror floor (MeshStandardMaterial, metalness ~1, roughness ~0.35) so the glowing paddles and ball reflect in it. Provides instant depth and a premium arena feel.

2. **Neon floor trim** — a thin glowing rectangle outlining the play area perimeter on the ground only (no verticals). Reads as a runway/arena boundary, not a debug cage.

3. **Frosted glass walls** — translucent side, ceiling, and back panels reusing the paddle's MeshPhysicalMaterial (transmission + clearcoat). The ball is visibly bounded in 3D; walls catch paddle glow. Matches the existing frosted-paddle identity.

This deliberately amends issue #01's "clean minimalist canvas with no hard borders" intent: we are adding a designed arena enclosure, not restoring the debug helpers.

Do not add menus, audio, particles, or camera shake. Do not reintroduce the GridHelper, the full 12-edge arena wireframe box, or the Paddle Movement Area line loops.

## Acceptance criteria

- [x] A reflective dark floor renders and visibly reflects the paddles and ball.
- [x] A thin neon perimeter trim renders on the ground outlining the play area (no vertical cage edges).
- [x] Frosted glass side, ceiling, and back wall panels render and catch paddle/ball glow.
- [x] The ball visibly bounces inside the bounded volume; depth between player and opponent is still perceivable.
- [x] No GridHelper, full arena wireframe box, or Paddle Movement Area line loops are reintroduced.
- [x] HTML overlays (score panel, status panel) are unchanged and still function.
- [x] `npm run build` and `npm run typecheck` pass with no new errors.
- [x] All new visual values are named constants at the top of GameScene and remain configurable.
- [x] No dead imports or orphaned helper functions are introduced.

## Blocked by

- .scratch/better-scene/issues/01-strip-debug-style-scene-helpers.md

## Comments

Implemented in `src/rendering/GameScene.ts` using three.js `Reflector` for the reflective floor, a `LineLoop` for the neon floor perimeter trim, and `MeshPhysicalMaterial` wall panels (sides, ceiling, back, front) reusing the frosted-glass vocabulary from the paddles. All values are named constants at the top of the file. Verified with `npm run typecheck`, `npm run build`, `npm test`, and a browser playtest at `http://127.0.0.1:5180/` (0 console errors; only expected GPU-stall warnings from the Reflector ReadPixels).