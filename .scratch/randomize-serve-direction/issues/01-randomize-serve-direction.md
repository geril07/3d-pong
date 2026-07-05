# Randomize Serve Direction

Status: ready-for-agent

## What to build

Make serve direction unpredictable by varying the ball's actual lateral/vertical serve vector while keeping the existing target-side rules. The first serve should still go toward the configured first side, and after scoring the next serve should still go toward the side that lost the previous point. Repeated serves toward the same side should not always travel along the same path, and the aim should use an offset away from center rather than picking only the four corner directions. The serve should still use the existing serve delay, reset, event, scoring, and match-over flow.

The implementation should be testable without flaky probability checks: randomness should be controllable or injectable enough for automated tests to force multiple lateral/vertical aim directions.

## Acceptance criteria

- [ ] The first serve still targets the configured first side.
- [ ] After each score, the next serve still targets the side that lost the previous point.
- [ ] Repeated serves toward the same side can produce different ball velocity `x`/`y` components beyond the four corner-sign variants.
- [ ] Randomized aim keeps a minimum offset away from center so serves do not become nearly straight.
- [ ] Serve delay, ball reset, paddle reset, scoring, match-over, and restart behavior continue to work.
- [ ] Serve events report the actual target side.
- [ ] Serve velocity points toward the reported target side and remains reachable under the current Paddle Movement Area and Bounded 3D Ball Movement rules.
- [ ] Automated tests cover multiple randomized aim directions without relying on chance.

## Blocked by

None - can start immediately
