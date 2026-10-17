// Carom — the game: the state it holds, the debug surface that poses and reads
// that state, and the three functions the Simple 2D engine drives.
//
// This module is the composition root. The simulation lives in the modules
// beside it (`ball.ts`, `paddle.ts`, `ai.ts`, `match.ts`, `menus.ts`,
// `update.ts`), the debug surface in `debug.ts`, and the drawing in `render.ts`.
// Nothing in the simulation reads from the renderer.

import type {
  Game,
  InitApi,
  RenderApi,
  UpdateApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import { ACTIONS, BINDINGS, CUES } from "./constants";
import { createDebugApi } from "./debug";
import { registerDiagnostics } from "./diagnostics";
import { titleState } from "./match";
import { renderFrame } from "./render";
import { updateFrame } from "./update";

// ---- State (specs/state.md) ----------------------------------------------

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
}

/**
 * A pointer or touch press that landed on a menu and has not lifted yet.
 *
 * A menu confirm needs both of its edges inside one item's region, and the two
 * edges usually arrive on different frames, so the landing has to be remembered
 * between them. `index` is the item the press landed on, or `-1` for a press
 * that landed outside every item. This is input bookkeeping rather than game
 * state: a lift always clears it, and a reset drops it with everything else.
 */
export interface MenuPress {
  readonly id: number;
  readonly screen: Screen;
  readonly index: number;
}

export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];

  readonly simTime: number;
  readonly muted: boolean;

  /** Pending menu presses; see {@link MenuPress}. */
  readonly presses: readonly MenuPress[];
}

/** The read-only view every reader of the state is handed. */
export type CaromView = DeepReadonly<CaromState>;

// ---- Debug surface (specs/instrumentation.md) ----------------------------

export interface MenuRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface PaddleSnapshot {
  readonly cy: number;
  readonly vy: number;
  readonly drivenVy: number;
  readonly driven: boolean;
}

export interface BallSnapshot {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly speed: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface CaromSnapshot {
  readonly version: number;
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";
  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;
  readonly muted: boolean;
  readonly paddles: {
    readonly left: PaddleSnapshot;
    readonly right: PaddleSnapshot;
  };
  readonly ai: AiState;
  readonly receiver: Side;
  readonly ball: BallSnapshot | null;
  readonly obstacles: readonly ObstacleState[];
  readonly simTime: number;
}

/**
 * The debug and automation surface. Every operation takes the current state
 * first; a pose returns the next state and a reading returns what it read.
 */
export interface CaromDebugApi {
  readonly version: number;

  clearWorld(state: CaromView): CaromState;
  spawnBall(state: CaromView): CaromState;
  spawnObstacle(state: CaromView, index: number): CaromState;
  reset(state: CaromView): CaromState;
  reconcile(state: CaromView): CaromState;

  setScreen(state: CaromView, screen: Screen): CaromState;
  setMode(state: CaromView, mode: Mode): CaromState;
  setMenuIndex(state: CaromView, index: number): CaromState;
  setTitleIndex(state: CaromView, index: number): CaromState;
  setResumeScreen(
    state: CaromView,
    screen: "countdown" | "playing",
  ): CaromState;

  setScore(state: CaromView, p1: number, p2: number): CaromState;
  setWinner(state: CaromView, side: Side | null): CaromState;
  setReceiver(state: CaromView, side: Side): CaromState;

  setPaddleCy(state: CaromView, side: Side, cy: number): CaromState;
  setPaddleVy(state: CaromView, side: Side, vy: number): CaromState;
  setPaddleDriven(state: CaromView, side: Side, driven: boolean): CaromState;

  setBallPosition(state: CaromView, x: number, y: number): CaromState;
  setBallVelocity(state: CaromView, vx: number, vy: number): CaromState;
  setBallSpin(state: CaromView, spin: number): CaromState;
  setBallHeld(state: CaromView, held: boolean): CaromState;
  setBallHoldTimer(state: CaromView, seconds: number): CaromState;
  setBallServeSign(state: CaromView, sign: 1 | -1): CaromState;
  drawBallServeSign(state: CaromView): CaromState;

  setAiTracking(state: CaromView, enabled: boolean): CaromState;
  setAiMovement(state: CaromView, enabled: boolean): CaromState;

  setMuted(state: CaromView, muted: boolean): CaromState;

  snapshot(state: CaromView): CaromSnapshot;
  menuItemRect(state: CaromView, index: number): MenuRect | null;
}

// ---- The game ------------------------------------------------------------

/**
 * The field background, a CSS color string. `src/main.ts` hands it to the
 * engine as the color the canvas is cleared to each frame, so the letterbox
 * bars around the field match the field itself.
 */
export const BACKGROUND = "#0b1020";

export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api: InitApi<CaromState>): [CaromState, CaromDebugApi] {
    for (const name of ACTIONS) {
      api.input.register(name, { keys: [...BINDINGS[name]] });
    }

    api.audio.define(CUES.paddleHit, {
      wave: "square",
      freq: 440,
      freqTo: 660,
      gain: 0.18,
      durationMs: 70,
    });
    api.audio.define(CUES.wallBounce, {
      wave: "triangle",
      freq: 330,
      freqTo: 260,
      gain: 0.16,
      durationMs: 55,
    });
    api.audio.define(CUES.obstacleBounce, {
      wave: "sawtooth",
      freq: 220,
      freqTo: 180,
      gain: 0.14,
      durationMs: 80,
    });
    api.audio.define(CUES.score, {
      wave: "sine",
      freq: 880,
      freqTo: 440,
      gain: 0.2,
      durationMs: 260,
    });

    registerDiagnostics(api);

    return [titleState(false), createDebugApi()];
  },

  update(state: CaromView, api: UpdateApi, dt: number): CaromState {
    return updateFrame(state, api, dt);
  },

  render(state: CaromView, api: RenderApi): void {
    renderFrame(state, api.ctx);
  },
};
