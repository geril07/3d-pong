# Randomize Serve Direction

Status: ready-for-agent

## What to build

Make serve direction unpredictable by choosing whether each serve goes toward the player or the bot when a new serve is prepared. This includes the first serve of a match and serves after scoring. The serve should still use the existing serve delay, reset, event, scoring, and match-over flow.

The implementation should be testable without flaky probability checks: randomness should be controllable or injectable enough for automated tests to force both directions.

## Acceptance criteria

- [ ] The first serve direction can be either player or bot based on randomized selection.
- [ ] After each score, the next serve direction is randomized rather than always targeting the side that lost the point.
- [ ] Serve delay, ball reset, paddle reset, scoring, match-over, and restart behavior continue to work.
- [ ] Serve events report the actual randomized target side.
- [ ] Serve velocity points toward the reported target side and remains reachable under the current Paddle Movement Area and Bounded 3D Ball Movement rules.
- [ ] Automated tests cover both randomized serve directions without relying on chance.
- [ ] Existing deterministic tests that assumed the losing side receives the next serve are updated to the new behavior.

## Blocked by

None - can start immediately
