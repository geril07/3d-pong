# Default Bot Slice

Status: ready-for-agent

## Parent

.scratch/first-playable-vertical-slice/PRD.md

## What to build

Add the Default Bot as the opponent for the first playable vertical slice. The bot should move inside its own Paddle Movement Area under the same movement constraints as the player, predict or choose an intercept target for the incoming ball, and return shots through the same paddle collision and Drag-Hit rules.

This slice should create a full player-vs-bot match. It should not add difficulty selection or multiple bot profiles, but bot behavior values should be configurable for later tuning.

## Acceptance criteria

- [ ] A bot paddle is visible on the opponent side.
- [ ] The bot moves left/right and up/down inside its Paddle Movement Area.
- [ ] The bot obeys configured movement speed limits and does not teleport.
- [ ] The bot tracks or predicts an intercept target for the ball.
- [ ] The bot can miss due to movement limits and configured error.
- [ ] The bot returns the ball through the same paddle collision rules as the player.
- [ ] Bot paddle velocity naturally influences outgoing ball velocity through the shared Drag-Hit rules.
- [ ] There is one Default Bot profile only; difficulty selection is not added.
- [ ] Bot speed, reaction/error behavior, and related tuning values are configurable.
- [ ] Automated tests cover bot movement limits, non-teleporting behavior, target tracking, and bot collision through shared rules.

## Blocked by

- .scratch/first-playable-vertical-slice/issues/03-scoring-and-serve-slice.md
- .scratch/first-playable-vertical-slice/issues/04-paddle-collision-and-drag-hit-slice.md
