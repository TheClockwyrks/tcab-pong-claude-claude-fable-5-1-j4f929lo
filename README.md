# Carom

Carom is a top-down paddle duel that runs entirely in the browser. Two paddles
face each other across a dark field while a ball ricochets between them, off the
top and bottom walls, and off a pair of obstacles standing mid-field. A player
scores when the ball passes the far edge behind their opponent's paddle; first
to 11 wins, leading by 2.

Carom's defining mechanic is **spin**: the motion of a paddle at the moment it
strikes the ball curves the ball's flight afterward. Strike while moving down
and the ball bends clockwise; strike while moving up and it bends the other way.
Spin fades over a second or so, and it survives wall and obstacle bounces, so a
curving ball can bank off an obstacle and around the other paddle.

Two ways to play:

- **Solo**: you take the left paddle against a machine opponent on the right.
- **Versus**: two players share one keyboard, player one on the left and player
  two on the right.

The game is built on the Simple 2D engine, which owns the frame loop, the
canvas fit, input, audio, and the debug overlay. Everything is drawn in code;
the build ships no art or audio files and fetches nothing at runtime.

## Controls

| Action                    | Keys                   |
| ------------------------- | ---------------------- |
| Player one (left) up/down | `W` / `S`              |
| Player two (right) up/down | `↑` / `↓`             |
| Confirm a menu item       | `Enter` or `Space`     |
| Back                      | `Escape`               |
| Pause / resume            | `P` or `Escape`        |
| Mute                      | `M`                    |
| Debug overlay             | `` ` `` (backtick)     |

In Solo, both pairs of movement keys drive the left paddle. Menus also take the
mouse and touch: hover or tap an item to select it, and press and release on it
to confirm. On a touchscreen the engine draws on-screen sliders for each paddle
and buttons for the menu actions.

## Install

```sh
npm ci
```

## Run in development

```sh
npm run dev
```

Vite serves the game with hot reload and prints the local URL.

## Production build

```sh
npm run build
```

This type-checks the project and emits the static site into `dist/`, with
`index.html` at its root. The directory runs as-is from any static file
server; `npm run preview` serves it locally for a final check.

## Checks and tests

```sh
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run format      # prettier --check
npm test            # vitest, with coverage over src/
```

The tests run in Node with no browser: they stand the real engine up over a
Node canvas and a constant clock, drive the game through its keyboard, pointer,
and debug surface, and read the outcome back from the state.

## Project layout

| Path                   | Holds                                                     |
| ---------------------- | --------------------------------------------------------- |
| `src/game.ts`          | The state types, the debug surface type, and the `game`.  |
| `src/ball.ts`          | Parking, serving, the sub-stepped physics, and the goals. |
| `src/paddle.ts`        | The paddle rectangles and the shared paddle integration.  |
| `src/ai.ts`            | The Solo opponent.                                        |
| `src/collide.ts`       | The circle against axis-aligned rectangle rule.           |
| `src/match.ts`         | Starting a match, returning to the title, the win rule.   |
| `src/menus.ts`         | Menu layout and keyboard, pointer, and touch navigation.  |
| `src/update.ts`        | The per-frame update.                                     |
| `src/render.ts`        | Everything drawn.                                         |
| `src/debug.ts`         | The debug and automation surface.                         |
| `src/constants.ts`     | Every figure the specification fixes (supplied).          |
| `src/main.ts`          | The entry point (supplied).                               |
| `src/testing/`         | The headless engine harness the tests use.                |
| `specs/`               | The specification.                                        |
| `engine/`              | The engine's documentation.                               |
| `showcase/`            | The store-page description, carousel, and media.          |
| `scripts/showcase/`    | The Playwright capture that produced the showcase media.  |

## Showcase

`showcase/` holds the store-page description, the carousel manifest, and the
media they name. To regenerate the media, start the dev server and run:

```sh
node scripts/showcase/capture.mjs http://localhost:5173
```
