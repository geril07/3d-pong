# Tune Minimalist Scene Depth and Glow

Status: ready-for-agent

## What to build

After stripping the debug-style helpers, verify the scene still reads depth and paddle/ball position without wireframe cues. If the scene feels flat or positional play becomes hard to read, tune the existing lighting and materials to compensate.

Candidate adjustments (apply only what is needed for readability):

- Tune fog near/far range so the far paddle and ball stay readable while depth is still perceivable.
- Tune paddle emissive intensity so paddles read clearly against the dark background.
- Tune ball emissive and trail opacity so direction and speed stay readable.
- Add a subtle floor depth cue only if needed (e.g. a faint ground glow or horizon line), without adding particles.

Do not add menus, audio, particles, or camera shake.

## Acceptance criteria

- [ ] A manual browser playtest confirms both player and opponent paddles are easy to locate against the background.
- [ ] Ball position and direction are readable at both near and far ends of the arena.
- [ ] Depth between player and opponent sides is still perceivable without the wireframe box.
- [ ] No new helper borders or grid lines are reintroduced.
- [ ] `npm run build` and `npm run typecheck` pass with no new errors.
- [ ] Any tuned values remain configurable via existing config or constants.

## Blocked by

- .scratch/better-scene/issues/01-strip-debug-style-scene-helpers.md
