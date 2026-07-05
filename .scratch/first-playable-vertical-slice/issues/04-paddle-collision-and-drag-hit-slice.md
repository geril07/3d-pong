# Paddle Collision And Drag-Hit Slice

Status: resolved

## Parent

.scratch/first-playable-vertical-slice/PRD.md

## What to build

Add paddle collision and the Drag-Hit mechanic. Paddle collision should use the visible paddle plus a configurable Forgiving Hitbox. When the ball hits a paddle, contact position provides the baseline return angle. Actual in-world paddle velocity after smoothing, clamping, and bounds are applied should influence outgoing ball speed and direction. There must be no charge button, charge meter, stored power, or hold-to-power-up behavior.

This slice should make player returns feel skill-based through paddle movement while keeping the Buffer Zone honest: it may help readability, but it is not a collider, wall, force field, auto-hit area, or auto-save area.

## Acceptance criteria

- [ ] The ball bounces off the player paddle.
- [ ] Paddle collision uses a configurable Forgiving Hitbox that can be slightly larger than the visible paddle mesh.
- [ ] The Forgiving Hitbox remains separate from the Buffer Zone.
- [ ] The Buffer Zone does not collide with, stop, redirect, or save the ball.
- [ ] Paddle contact position changes the baseline return angle.
- [ ] Paddle left/right velocity influences horizontal outgoing direction.
- [ ] Paddle up/down velocity influences vertical outgoing direction.
- [ ] Paddle velocity can add bounded Drag-Hit speed after an anti-jitter threshold.
- [ ] Drag-Hit uses actual paddle velocity after smoothing, clamping, and movement bounds, not raw mouse delta spikes.
- [ ] Ball speed is always clamped between configured minimum and maximum speeds after paddle collision.
- [ ] The implementation contains no separate charge-hit input, charge meter, stored power, or release-timing mechanic.
- [ ] Automated tests cover normal bounce, contact-position angle changes, Drag-Hit speed/direction influence, anti-jitter behavior, speed clamps, Forgiving Hitbox behavior, and Buffer Zone non-collision.

## Blocked by

- .scratch/first-playable-vertical-slice/issues/02-core-rally-slice.md

## Answer

Implemented: Ball bounces off paddles, configurable Forgiving Hitbox, Buffer Zone is non-collider, contact-position angle changes, Drag-Hit from smoothed/clamped paddle velocity (x and y influence, anti-jitter threshold, speed bonus), speed clamping between min/max. Zero charge-hit code. Full automated tests.
