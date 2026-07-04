# Scoring And Serve Slice

Status: ready-for-agent

## Parent

.scratch/first-playable-vertical-slice/PRD.md

## What to build

Add complete scoring and match flow to the playable rally. A point should be awarded when the ball crosses a Scoring Plane behind either side. After a score, the ball and both paddles reset, then the next serve starts automatically after a short delay toward the side that lost the previous point. The match ends at first to 5 points and can be restarted.

This slice should make the game loop complete enough to win, lose, and replay, even before paddle collision, Drag-Hit, and the bot are fully implemented.

## Acceptance criteria

- [ ] A Scoring Plane exists behind each side of the arena.
- [ ] A point is awarded only when the ball crosses a Scoring Plane.
- [ ] The score is visible in the gameplay UI.
- [ ] After each score, the ball and both paddles reset to fair starting positions.
- [ ] After reset, the next serve starts automatically after a short configured delay.
- [ ] The serve goes toward the side that lost the previous point.
- [ ] The first serve is deterministic or otherwise clearly defined.
- [ ] The match ends when either side reaches 5 points.
- [ ] The match-over state displays the winner and allows restart without reloading the page.
- [ ] Automated tests cover Scoring Plane crossing, score updates, reset behavior, serve delay, serve direction, match-over, and restart.

## Blocked by

- .scratch/first-playable-vertical-slice/issues/02-core-rally-slice.md
