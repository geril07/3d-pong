# Strip Debug-Style Scene Helpers

Status: ready-for-agent

## What to build

Remove the debug/readability helper visuals from the 3D scene so only the gameplay-relevant objects remain: frosted glass paddles, ball with trail, and fog for depth. The scene should no longer show the floor grid, the arena wireframe box, or the Paddle Movement Area line loops.

The frosted glass paddles already provide enough visual identity and glow, so the movement area rectangles are redundant clutter. After this slice, the scene is a clean minimalist neon canvas with no hard wireframe borders.

Do not add menus, audio, particles, or camera shake.

## Acceptance criteria

- [ ] The floor grid no longer renders in the scene.
- [ ] The arena wireframe box no longer renders in the scene.
- [ ] The Paddle Movement Area line loops no longer render for either player or opponent.
- [ ] Frosted glass paddles, ball, and ball trail still render and animate correctly.
- [ ] Fog still provides depth cues.
- [ ] HTML overlays (score panel, status panel) are unchanged and still function.
- [ ] `npm run build` and `npm run typecheck` pass with no new errors.
- [ ] No dead imports or orphaned helper functions remain from the removed visuals.

## Blocked by

- None - can start immediately
