# 3D Pong

Arcade-style 3D Pong built with `TypeScript`, `Vite`, and `three.js`.

## Features

- Mouse-controlled player paddle with pointer lock input
- 3D ball movement with wall, floor, and ceiling bounces
- Bot opponent
- Serve delay, scoring, and match restart flow
- Neon/glass arena presentation

## Controls

- Click the arena to capture the mouse
- Move the mouse to control the player paddle
- Press `Escape` to release mouse capture
- Press `R` to restart after match over

## Getting Started

Requirements:

- `npm`
- A modern browser with WebGL support

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Type-check the project:

```bash
npm run typecheck
```

Build for production:

```bash
npm run build
```

## Project Notes

- Core gameplay simulation lives in `src/simulation/`
- Rendering lives in `src/rendering/`
- Browser input handling lives in `src/browser/`
