# Playable Boot Slice

Status: ready-for-agent

## Parent

.scratch/first-playable-vertical-slice/PRD.md

## What to build

Build the initial browser app shell for the first playable vertical slice. The app should boot directly into gameplay, render a minimal Three.js scene from a fixed behind-player camera, capture pointer-lock mouse input from the canvas, and pause gameplay when input is not captured.

This slice should establish the runnable TypeScript/Three.js foundation and the top-level game state needed for later slices, without implementing full ball physics, scoring, Drag-Hit, or bot behavior yet.

## Acceptance criteria

- [ ] The project can be installed and run locally as a browser app.
- [ ] The app boots directly into a gameplay view rather than a main menu.
- [ ] A minimal Three.js scene renders in the browser.
- [ ] The camera is fixed behind the player side, slightly elevated, and aimed toward the opponent side.
- [ ] Clicking the canvas requests pointer lock for gameplay input.
- [ ] Escape or pointer-lock loss puts the game into a paused/input-not-captured state.
- [ ] The simulation does not continue active gameplay while input is not captured.
- [ ] There is a minimal visible indication of paused/input-not-captured state.
- [ ] The implementation leaves a clear seam for a pure simulation core to be added in later slices.

## Blocked by

None - can start immediately
