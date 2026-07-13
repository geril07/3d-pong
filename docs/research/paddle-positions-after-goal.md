# Paddle positions after a goal

Date: 2026-07-13

Status: implemented decision — paddle simulation continues across ordinary
goals; the bot changes its target to the centre during the serve delay.

## Question

What currently resets when a point is scored, and what would be required to
keep the paddles where they were instead?

## Short answer

The reset is simulation-level, not a rendering effect. Every score enters
`applyScore`, which unconditionally creates both paddles at the centre of their
configured movement areas. It also resets the player target, the bot target,
both paddle velocities, and the ball. The renderer simply copies the resulting
snapshot positions into the two meshes, so there is no separate visual reset
to disable.

The selected behavior is continuation rather than preservation: the scoring
transition carries the post-movement paddles and their velocities forward.
The player's target continues to follow input. The bot keeps its physical
state but switches its control target to the centre of its movement area and
moves there normally during the serve delay.

## Current score flow

1. `stepGame` advances the player target and player paddle before it checks for
   a goal ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L368-L372)).
2. While running, it also advances the bot paddle and ball, resolves paddle
   collisions, and asks `getScoreEvent` whether the integrated ball crossed a
   scoring plane ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L375-L387)).
3. If a score exists, `stepGame` calls `applyScore(state, scoreEvent, dt,
   config)` with the **old `state`**, not the newly moved `playerPaddle` or
   `botStep.paddle` ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L387-L391)).
   Consequently, even movement in the scoring frame is thrown away.
4. `applyScore` enters `serve-delay` (or `match-over` at the target score),
   increments the score, records which side receives the next serve, and
   emits the score event ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L449-L484)).
5. The renderer copies `snapshot.playerPaddle.position` and
   `snapshot.opponentPaddle.position` to the meshes every frame
   ([`GameScene.ts`](../../src/rendering/GameScene.ts#L212-L224)). There is no
   independent paddle animation tied to a score event.

## Reset blast radius

`applyScore` currently replaces these fields:

| Field | Current score behavior | Why it matters if positions are preserved |
|---|---|---|
| `ball` | Replaced with `createResetBall(config)`, retaining only the existing radius ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L473-L476), [`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L513-L521)) | Independent of paddle placement; should still reset for a serve |
| `playerPaddle` | New `createPaddle(config.paddle.playerArea)` at movement-area centre, zero velocity ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L455-L456), [`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L535-L548)) | Visible snap of the player's paddle |
| `opponentPaddle` | New `createPaddle(config.paddle.opponentArea)` at centre, zero velocity ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L455-L456), [`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L535-L548)) | Visible snap of the opponent's paddle |
| `playerTarget` | Replaced with the new player paddle centre ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L477-L480)) | Must track a preserved player position, or the next input step can snap the paddle toward an old/new target |
| `bot` | Replaced with a centre target from `createBotState` ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L483), [`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L550-L557)) | Internal bot intent; mismatching it with a preserved paddle can create an immediate recentering drift after serve |
| `phase` / serve timing | `serve-delay`, timer reset to `config.serve.delaySeconds`; final point becomes `match-over` with timer `0` ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L461-L470)) | The serve pause is the natural window for holding paddles still |
| `nextServeToward` / `score` / `winner` | Updated from the score event ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L457-L472)) | Gameplay rules, not part of paddle placement |
| `events` | Replaced with `[scoreEvent]` ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L483-L484)) | Required by score feedback and goal-ball effect |
| `activeTimeSeconds` / `phaseBeforePause` | Advanced and updated for resume semantics ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L464-L468)) | Should remain unchanged by a paddle-preservation option |

The reset is symmetrical: both sides are always recreated, regardless of which
side scored or lost. The score event's `scoringSide` and `lostSide` only affect
score bookkeeping and serve direction ([`GameSimulation.ts`](../../src/simulation/GameSimulation.ts#L488-L510)).

## What happens during the serve delay

After the score, `stepServeDelay` continues to accept player input. The bot
moves toward its centre target through the normal bounded movement function
and bot speed limit. The scoring-frame velocities feed the existing smoothing
instead of being forced to zero. The same movement update runs on the frame
that starts the next serve.

## Selected behavior

`applyScore` receives the paddles and player target already produced by the
scoring simulation step. It resets the ball and rally bookkeeping but does not
recreate paddle state. The bot target alone is changed to the configured
movement-area centre.

During `serve-delay`, player input and player movement continue as before. The
bot travels from its scoring-frame position toward centre with its existing
velocity feeding normal smoothing. When the serve starts, ball tracking takes
over again. On the final point, `match-over` still stops simulation, leaving
both paddles at their last positions.

## Deterministic test seam

The existing test `resets the ball and both paddles after a score` constructs
non-centre paddle positions, velocities, and bot target, then asserts all of
them equal a fresh initial state ([`GameSimulation.test.ts`](../../src/simulation/GameSimulation.test.ts#L390-L426)).
That test is the exact contract to change if a preservation rule is selected.

A deterministic replacement asserts:

- the score still enters `serve-delay` and resets the ball;
- both paddle states equal the uninterrupted post-movement states at the crossing;
- `playerTarget` retains the scoring-frame input target;
- `bot.target` changes to the configured centre;
- the bot approaches that centre during the serve delay without forced velocity reset;
- the next serve still travels toward `scoreEvent.lostSide`.

No rendering test is needed to prove the reset itself: `GameScene` only mirrors
the simulation snapshot positions ([`GameScene.ts`](../../src/rendering/GameScene.ts#L216-L219)).

## Decision

Treat paddle state as continuous across ordinary goals. Reset only the rally;
return the bot to centre through simulation rather than teleportation. This
keeps the existing collision, scoring, serve, and renderer contracts while
removing the visible and mechanical interruption.
