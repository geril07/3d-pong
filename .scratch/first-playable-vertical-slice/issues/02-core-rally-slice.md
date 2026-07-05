# Core Rally Slice

Status: resolved

## Parent

.scratch/first-playable-vertical-slice/PRD.md

## What to build

Add the first end-to-end rally path through the pure simulation core and renderer. The player paddle should move left/right and up/down inside the Paddle Movement Area from pointer-lock mouse input. The ball should move through a bounded 3D arena and bounce off side walls, floor, and ceiling using arcade reflection.

This slice should make the game visibly move and prove the core simulation/rendering seam, but it does not need scoring, paddle collision, Drag-Hit, or bot behavior yet.

## Acceptance criteria

- [ ] A pure simulation core owns game-state stepping independently of Three.js rendering.
- [ ] Rendering adapts simulation state into visible Three.js objects rather than owning gameplay rules.
- [ ] Pointer-lock mouse movement moves the player paddle left/right and up/down.
- [ ] The player paddle is clamped inside the Paddle Movement Area.
- [ ] The Paddle Movement Area has a subtle visible boundary or indicator.
- [ ] The ball moves in 3D across arena depth, width, and height.
- [ ] The ball bounces off side walls, floor, and ceiling.
- [ ] The ball uses zero-gravity arcade motion with straight-line paths between collisions.
- [ ] Automated tests cover ball stepping and side-wall/floor/ceiling bounce behavior in the pure simulation core.
- [ ] Automated tests cover player paddle clamping inside the Paddle Movement Area.

## Blocked by

- .scratch/first-playable-vertical-slice/issues/01-playable-boot-slice.md

## Answer

Implemented: Pure `GameSimulation` + `stepGame` with zero Three.js dependency. Pointer-lock mouse → paddle movement with clamping to movement area. Ball moves in 3D with arcade bounce off all walls/floor/ceiling. Automated tests cover ball stepping, bounces, and paddle clamping. Remaining: paddle movement area visual indicator (tracked in issue 06).
