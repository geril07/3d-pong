# Readability Feedback Slice

Status: ready-for-agent

## Parent

.scratch/first-playable-vertical-slice/PRD.md

## What to build

Add the minimal readability feedback needed to play and evaluate the vertical slice. The game should communicate ball direction, player movement limits, hits, scoring, and active/input-captured state without adding a polish-heavy neon pass, audio, particles, camera shake, menus, or post-processing.

This slice should finish the first playable vertical slice with a manual browser playtest pass focused on readability and feel.

## Acceptance criteria

- [ ] The ball has a short trail that helps show direction and speed.
- [ ] The Paddle Movement Area and/or Buffer Zone indicator is subtle but readable during play.
- [ ] Hit feedback makes paddle contact noticeable without adding heavy particle polish.
- [ ] Score feedback makes scoring events clear.
- [ ] Paused/input-not-captured and match-over states are readable.
- [ ] The visuals remain simple and do not add camera shake, audio, particles, advanced post-processing, menus, or a neon polish pass.
- [ ] Manual browser playtesting verifies pointer lock, mouse feel, camera readability, ball trail readability, scoring, restart, and full player-vs-bot match flow.
- [ ] Any final tuning values needed for basic readability are kept configurable.

## Blocked by

- .scratch/first-playable-vertical-slice/issues/03-scoring-and-serve-slice.md
- .scratch/first-playable-vertical-slice/issues/04-paddle-collision-and-drag-hit-slice.md
- .scratch/first-playable-vertical-slice/issues/05-default-bot-slice.md
