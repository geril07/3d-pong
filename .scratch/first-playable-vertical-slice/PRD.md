# PRD: First Playable Vertical Slice

Status: ready-for-agent

## Problem Statement

The project needs a small, playable version of 3D Pong Arena that proves the core game shape before adding menus, polish, difficulty levels, audio, or advanced mechanics. The rough sketch mixed two different mechanics: a separate charge-hit system and a physical Drag-Hit system. The first playable version needs one clear mechanic, one clear control model, and one testable simulation seam.

The player should be able to load the browser game, control a paddle with the mouse, return a bounded 3D ball against a bot, score points, and feel that paddle movement affects the return through Drag-Hits.

## Solution

Build a browser-playable vertical slice using direct Three.js rendering, TypeScript, manual physics, and a pure game simulation core.

The game boots directly into a player-vs-bot match. The player clicks the canvas to enter pointer lock, then moves the mouse to move the paddle left/right and up/down inside the Paddle Movement Area. The ball moves through a bounded 3D arena, bouncing off side walls, floor, and ceiling. A point is scored when the ball crosses the opponent's Scoring Plane.

The primary mechanic is Drag-Hit: paddle movement at the moment of contact influences outgoing ball speed and direction. There is no charge button, no charge meter, no stored power, and no forward/back paddle depth control in this first playable slice.

The first slice should prioritize readable gameplay over polish. It includes visible arena boundaries, visible paddle/ball objects, a subtle Paddle Movement Area indicator, a short ball trail, score display, restart, automatic serve/reset flow, and a Default Bot. It excludes main menus, difficulty selection, audio, spin, gravity, camera movement, and neon polish passes.

## User Stories

1. As a player, I want the game to load directly into a match, so that I can test the core loop immediately.
2. As a player, I want to click the canvas to capture mouse input, so that I can control the paddle without the cursor leaving the game area.
3. As a player, I want mouse movement to move the paddle left/right and up/down, so that I can defend a 2D area on my side of the arena.
4. As a player, I want the paddle to stay inside a visible allowed area, so that I understand my movement limits.
5. As a player, I want the paddle to respond directly to mouse movement, so that the game feels precise rather than floaty.
6. As a player, I want tiny accidental mouse jitter to be ignored or smoothed, so that small hand tremors do not create noisy paddle movement.
7. As a player, I want paddle speed to be capped, so that Drag-Hits are based on fair in-world paddle movement rather than input spikes.
8. As a player, I want the ball to travel through a 3D arena with width, height, and depth, so that the game feels meaningfully 3D.
9. As a player, I want the ball to bounce off side walls, floor, and ceiling, so that vertical and horizontal positioning matter.
10. As a player, I want the ball to move without gravity, so that the game stays arcade-readable and fast.
11. As a player, I want a stable camera behind my paddle, so that I can judge the ball's depth, height, and direction.
12. As a player, I want a short ball trail, so that I can read the ball's movement direction and speed.
13. As a player, I want the ball to bounce normally when my paddle is still, so that the baseline rule is easy to understand.
14. As a player, I want fast paddle movement at contact to create a stronger Drag-Hit, so that timing and motion feel rewarding.
15. As a player, I want edge contact on the paddle to change the return angle, so that positioning matters.
16. As a player, I want left/right paddle velocity to influence horizontal return direction, so that swiping can shape the shot.
17. As a player, I want up/down paddle velocity to influence vertical return direction, so that vertical movement can shape the shot.
18. As a player, I want the ball speed to be clamped, so that powerful hits do not make the game unplayable.
19. As a player, I want the paddle collision to be slightly forgiving, so that fast 3D play does not feel unfairly precise.
20. As a player, I want the forgiving hitbox to be configurable, so that the game can be tuned after playtesting.
21. As a player, I want the Buffer Zone to be a readable interaction aid rather than a wall, so that misses and hits feel honest.
22. As a player, I want a bot opponent that follows and returns the ball, so that I can play full rallies.
23. As a player, I want the bot to obey movement speed limits, so that it does not feel like it teleports or cheats.
24. As a player, I want the bot's paddle velocity to affect its hits naturally, so that both sides follow the same collision rules.
25. As a player, I want points to be scored only when the ball crosses a Scoring Plane behind a side, so that the fail condition is clear.
26. As a player, I want the ball and both paddles to reset after each point, so that each rally starts fairly.
27. As a player, I want the next serve to happen automatically after a short delay, so that the match keeps flowing.
28. As a player, I want the serve to go toward the side that lost the previous point, so that the reset feels intuitive.
29. As a player, I want the match to end at first to 5 points, so that the prototype has a complete win/loss loop.
30. As a player, I want to restart after a match ends, so that I can play again without reloading the page.
31. As a player, I want Escape or pointer-lock release to pause gameplay, so that the game does not continue while I cannot control the paddle.
32. As a developer, I want the game rules isolated from rendering, so that physics and scoring can be tested without a browser.
33. As a developer, I want Drag-Hit behavior tested through game state outcomes, so that future tuning does not accidentally reintroduce charge-hit behavior.
34. As a developer, I want tunable config values for speeds, hitbox forgiveness, bot behavior, serve delay, and scoring target, so that feel can be adjusted without restructuring the game.

## Implementation Decisions

- Use TypeScript with direct Three.js rendering.
- Use manual arcade physics instead of a physics engine.
- Use plain TypeScript modules/classes instead of an ECS or game framework.
- Keep a pure simulation core separate from rendering and browser input.
- The simulation core should expose one high-level seam: initialize game state, step by elapsed time plus input snapshot, and inspect resulting world state/events.
- Rendering should adapt simulation state into Three.js objects rather than owning gameplay rules.
- Browser input should adapt pointer-lock mouse movement into paddle movement input rather than directly mutating rendered objects.
- The first playable slice uses a fixed player Paddle Movement Area with left/right and up/down movement only.
- Forward/back paddle depth control is out of scope for the first playable slice.
- There is no separate charge input, charge meter, held power state, or release-timing mechanic.
- Drag-Hit power is based on actual in-world paddle velocity after smoothing, clamping, and movement bounds are applied.
- Paddle contact position provides the baseline return angle.
- Paddle left/right velocity adds horizontal influence to the outgoing ball velocity.
- Paddle up/down velocity adds vertical influence to the outgoing ball velocity.
- Paddle velocity magnitude can add a bounded speed bonus after an anti-jitter threshold.
- Ball speed must always be clamped between configured minimum and maximum speeds.
- Ball paths are straight between collisions.
- No spin, curved trajectories, gravity, lobs, or drop-shot physics are included.
- The arena is a bounded 3D box with side walls, floor, ceiling, and Scoring Planes behind each side.
- The ball bounces off side walls, floor, and ceiling using arcade reflection.
- A point is scored only when the ball crosses a Scoring Plane.
- The Buffer Zone is not a collider, wall, force field, auto-hit area, or auto-save area.
- Paddle collision uses the actual paddle collision volume, including a configurable Forgiving Hitbox that can be slightly larger than the visible mesh.
- The Forgiving Hitbox should remain small enough that misses still feel like misses.
- The player and bot follow symmetric collision and scoring rules.
- The Default Bot is the only bot profile in scope.
- The Default Bot should move toward a predicted/intercept target using limited speed, simple reaction behavior, and configurable error.
- The Default Bot should not teleport.
- Bot Drag-Hit influence should come naturally from bot paddle velocity and the shared collision rules.
- Difficulty selection is out of scope, but bot parameters should be configurable for later tuning.
- The app boots directly into gameplay instead of a main menu.
- The match target is first to 5 points.
- After each score, the ball and both paddles reset.
- After reset, the next serve starts automatically after a short delay.
- The serve goes toward the side that lost the previous point.
- The first serve may default toward the player side for deterministic startup.
- Gameplay state should include at least running, paused/input-not-captured, reset/serve delay, and match-over.
- Pointer lock is used for gameplay mouse input.
- Escape or pointer-lock loss pauses gameplay instead of allowing the simulation to continue uncontrolled.
- Keyboard paddle movement is out of scope for the first playable slice.
- Keyboard/input for restart and pause is allowed.
- The camera is fixed behind the player, slightly elevated, and aimed toward the bot side.
- Camera follow, camera rotation, player-controlled camera, and camera shake are out of scope.
- Readability visuals are in scope: visible arena bounds, visible paddles and ball, short ball trail, subtle Paddle Movement Area indicator, score UI, and simple hit/score feedback if cheap.
- Audio, particle polish, advanced post-processing, neon polish passes, menus, help screens, and settings screens are out of scope.

## Testing Decisions

- Automated tests should target the pure simulation core rather than Three.js rendering.
- Tests should assert externally visible game behavior: positions, velocities, scores, states, and emitted events.
- Tests should avoid asserting private helper details or exact internal implementation structure.
- Ball movement tests should verify frame stepping moves the ball according to velocity and elapsed time.
- Boundary tests should verify ball reflection from side walls, floor, and ceiling.
- Scoring tests should verify points are awarded only when the ball crosses the correct Scoring Plane.
- Reset tests should verify ball and both paddles reset after a score.
- Serve tests should verify automatic serve delay and serve direction after the previous point.
- Match tests should verify first-to-5 match completion and restart behavior.
- Paddle movement tests should verify clamping inside the Paddle Movement Area.
- Paddle velocity tests should verify velocity is derived from actual clamped/smoothed movement, not raw input spikes.
- Collision tests should verify normal bounce when paddle velocity is below the Drag-Hit threshold.
- Drag-Hit tests should verify paddle movement changes outgoing speed and direction within configured clamps.
- Forgiving Hitbox tests should verify configurable collision forgiveness without treating the Buffer Zone as a collider.
- Bot tests should verify the bot moves under speed limits and does not teleport.
- Bot collision tests should verify bot paddle velocity can influence outgoing ball velocity through the same rules as the player.
- Pause tests should verify simulation does not continue gameplay while input is not captured.
- Manual browser playtesting should cover pointer lock, mouse feel, camera readability, Three.js rendering, score display, restart, and overall fun.

## Out of Scope

- Separate charge-hit mechanic.
- Charge button.
- Charge meter.
- Stored power over time.
- Hold-to-power-up behavior.
- Forward/back player paddle depth control.
- Absorb/catch/stop-and-hit mechanic.
- Keyboard paddle movement.
- Difficulty selection.
- Multiple bot profiles.
- Main menu.
- Controls/help screen.
- Settings screen.
- Audio.
- Camera shake.
- Particle effects.
- Neon polish pass.
- Advanced post-processing.
- Spin or curved trajectories.
- Gravity.
- Realistic table tennis physics.
- Physics engine integration.
- Online multiplayer.
- Local multiplayer.
- Mobile touch controls.

## Further Notes

Use the domain glossary terms from the project context: Drag-Hit, Buffer Zone, Paddle Movement Area, Bounded 3D Ball Movement, Scoring Plane, and Forgiving Hitbox.

The rough sketch that preceded this PRD should not be treated as source of truth after this PRD exists. In particular, any charge-hit language from the sketch is superseded by Drag-Hit as defined here.
