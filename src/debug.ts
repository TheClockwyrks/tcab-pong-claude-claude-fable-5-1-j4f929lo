// The debug and automation surface (specs/instrumentation.md). Every pose
// builds the next state from the one it is handed; every reading reports what
// it read. A pose with nothing to act on fails loudly.

import { CAROM_DEBUG_VERSION, OBSTACLE_CENTERS } from "./constants";
import { parkedBall } from "./ball";
import type {
  BallState,
  CaromDebugApi,
  CaromSnapshot,
  CaromState,
  CaromView,
  Mode,
  Screen,
  Side,
} from "./game";
import { obstacleAt, titleState } from "./match";
import { menuItemRect } from "./menus";
import { drawServeSign } from "./random";

const SCREENS: readonly Screen[] = [
  "title",
  "howto",
  "countdown",
  "playing",
  "paused",
  "matchover",
];
const MODES: readonly Mode[] = ["solo", "versus"];
const SIDES: readonly Side[] = ["left", "right"];

function oneOf<T extends string>(
  values: readonly T[],
  value: T,
  what: string,
): T {
  if (!values.includes(value)) {
    throw new RangeError(`Carom: "${String(value)}" is not a ${what}`);
  }
  return value;
}

function finite(value: number, what: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Carom: ${what} must be finite, got ${String(value)}`);
  }
  return value;
}

/** The ball on the field, or a loud failure when there is none. */
function requireBall(state: CaromView): BallState {
  if (state.ball === null) {
    throw new Error("Carom: no ball is on the field to pose");
  }
  return state.ball;
}

function withBall(state: CaromView, ball: BallState): CaromState {
  return { ...state, ball };
}

function withPaddle(
  state: CaromView,
  side: Side,
  change: Partial<CaromState["paddles"]["left"]>,
): CaromState {
  const which = oneOf(SIDES, side, "side");
  return {
    ...state,
    paddles: {
      ...state.paddles,
      [which]: { ...state.paddles[which], ...change },
    },
  };
}

export function snapshotOf(state: CaromView): CaromSnapshot {
  const { ball } = state;
  return {
    version: CAROM_DEBUG_VERSION,
    screen: state.screen,
    mode: state.mode,
    menuIndex: state.menuIndex,
    titleIndex: state.titleIndex,
    resumeScreen: state.resumeScreen,
    score: { p1: state.score.p1, p2: state.score.p2 },
    winner: state.winner,
    muted: state.muted,
    paddles: {
      left: { ...state.paddles.left },
      right: { ...state.paddles.right },
    },
    ai: { ...state.ai },
    receiver: state.receiver,
    ball:
      ball === null
        ? null
        : {
            x: ball.x,
            y: ball.y,
            vx: ball.vx,
            vy: ball.vy,
            speed: Math.hypot(ball.vx, ball.vy),
            spin: ball.spin,
            held: ball.held,
            holdTimer: ball.holdTimer,
            serveSign: ball.serveSign,
            trail: ball.trail.map((s) => ({ ...s })),
          },
    obstacles: state.obstacles.map((o) => ({ ...o })),
    simTime: state.simTime,
  };
}

export function createDebugApi(): CaromDebugApi {
  return {
    version: CAROM_DEBUG_VERSION,

    clearWorld: (s) => ({ ...s, ball: null, obstacles: [] }),
    spawnBall: (s) => withBall(s, parkedBall()),
    spawnObstacle: (s, index) => {
      const obstacle = obstacleAt(index);
      const others = s.obstacles.filter((o) => o.index !== index);
      return {
        ...s,
        obstacles: [...others, obstacle].sort((a, b) => a.index - b.index),
      };
    },
    reset: (s) => titleState(s.muted),
    // Every reading is worked out at the read, so there is nothing to bring
    // back into agreement: the state comes back as it was.
    reconcile: (s) => ({ ...s }),

    setScreen: (s, screen) => ({
      ...s,
      screen: oneOf(SCREENS, screen, "screen"),
    }),
    setMode: (s, mode) => ({ ...s, mode: oneOf(MODES, mode, "mode") }),
    setMenuIndex: (s, index) => ({
      ...s,
      menuIndex: finite(index, "menuIndex"),
    }),
    setTitleIndex: (s, index) => ({
      ...s,
      titleIndex: finite(index, "titleIndex"),
    }),
    setResumeScreen: (s, screen) => ({
      ...s,
      resumeScreen: oneOf(["countdown", "playing"], screen, "resume screen"),
    }),

    setScore: (s, p1, p2) => ({
      ...s,
      score: { p1: finite(p1, "p1"), p2: finite(p2, "p2") },
    }),
    setWinner: (s, side) => ({
      ...s,
      winner: side === null ? null : oneOf(SIDES, side, "side"),
    }),
    setReceiver: (s, side) => ({ ...s, receiver: oneOf(SIDES, side, "side") }),

    setPaddleCy: (s, side, cy) => withPaddle(s, side, { cy: finite(cy, "cy") }),
    setPaddleVy: (s, side, vy) =>
      withPaddle(s, side, { drivenVy: finite(vy, "vy") }),
    setPaddleDriven: (s, side, driven) => withPaddle(s, side, { driven }),

    setBallPosition: (s, x, y) =>
      withBall(s, { ...requireBall(s), x: finite(x, "x"), y: finite(y, "y") }),
    setBallVelocity: (s, vx, vy) =>
      withBall(s, {
        ...requireBall(s),
        vx: finite(vx, "vx"),
        vy: finite(vy, "vy"),
      }),
    setBallSpin: (s, spin) =>
      withBall(s, { ...requireBall(s), spin: finite(spin, "spin") }),
    setBallHeld: (s, held) => withBall(s, { ...requireBall(s), held }),
    setBallHoldTimer: (s, seconds) =>
      withBall(s, {
        ...requireBall(s),
        holdTimer: finite(seconds, "holdTimer"),
      }),
    setBallServeSign: (s, sign) => {
      if (sign !== 1 && sign !== -1) {
        throw new RangeError(
          `Carom: serveSign must be 1 or -1, got ${String(sign)}`,
        );
      }
      return withBall(s, { ...requireBall(s), serveSign: sign });
    },
    drawBallServeSign: (s) =>
      withBall(s, { ...requireBall(s), serveSign: drawServeSign() }),

    setAiTracking: (s, enabled) => ({
      ...s,
      ai: { ...s.ai, tracking: enabled },
    }),
    setAiMovement: (s, enabled) => ({
      ...s,
      ai: { ...s.ai, movement: enabled },
    }),

    setMuted: (s, muted) => ({ ...s, muted }),

    snapshot: snapshotOf,
    menuItemRect: (s, index) => menuItemRect(s.screen, index),
  };
}

/** The obstacle indices the surface accepts, for callers that enumerate them. */
export const OBSTACLE_INDICES: readonly number[] = OBSTACLE_CENTERS.map(
  (_, index) => index,
);
