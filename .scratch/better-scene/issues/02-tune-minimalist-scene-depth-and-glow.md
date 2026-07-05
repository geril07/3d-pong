# Tune Minimalist Scene Depth and Glow

Status: resolved

## What to build

After stripping the debug-style helpers, verify the scene still reads depth and paddle/ball position without wireframe cues. If the scene feels flat or positional play becomes hard to read, tune the existing lighting and materials to compensate.

Candidate adjustments (apply only what is needed for readability):

- Tune fog near/far range so the far paddle and ball stay readable while depth is still perceivable.
- Tune paddle emissive intensity so paddles read clearly against the dark background.
- Tune ball emissive and trail opacity so direction and speed stay readable.
- Add a subtle floor depth cue only if needed (e.g. a faint ground glow or horizon line), without adding particles.

Do not add menus, audio, particles, or camera shake.

## Acceptance criteria

- [x] A manual browser playtest confirms both player and opponent paddles are easy to locate against the background.
- [x] Ball position and direction are readable at both near and far ends of the arena.
- [x] Depth between player and opponent sides is still perceivable without the wireframe box.
- [x] No new helper borders or grid lines are reintroduced.
- [x] `npm run build` and `npm run typecheck` pass with no new errors.
- [x] Any tuned values remain configurable via existing config or constants.

## Blocked by

- .scratch/better-scene/issues/01-strip-debug-style-scene-helpers.md

## Comments

Implemented in `src/rendering/GameScene.ts` by tuning existing rendering constants: fog range, paddle emissive intensity, ball emissive color, hit flash intensity, and trail opacity. Browser playtest confirmed the minimalist scene keeps readable paddle/ball positions without reintroducing borders, grids, particles, menus, audio, or camera shake.
