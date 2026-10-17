import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_SPEED,
  BALL_R,
  CUES,
  FIELD_CY,
  FIELD_W,
  HOLD_TIME,
  P1_X1,
  PADDLE_MIN_CY,
  PADDLE_SPEED,
  SERVE_ANGLE,
  SERVE_SPEED,
  WIN_SCORE,
} from "./constants";
import type { BallState, CaromState } from "./game";
import { NO_INPUT, type FrameInput } from "./input";
import { startMatch, titleState } from "./match";
import { advance, stepFrame } from "./update";

const DT = 1 / 60;

function held(changes: Partial<FrameInput["held"]>): FrameInput {
  return { ...NO_INPUT, held: { ...NO_INPUT.held, ...changes } };
}

function countdown(mode: "solo" | "versus" = "solo"): CaromState {
  return startMatch(titleState(false), mode);
}

function flying(state: CaromState, ball: Partial<BallState>): CaromState {
  if (state.ball === null) throw new Error("no ball");
  return {
    ...state,
    screen: "playing",
    ball: { ...state.ball, held: false, holdTimer: 0, ...ball },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("simTime", () => {
  it("accumulates on every screen, the menus and the pause included", () => {
    for (const screen of ["title", "howto", "paused", "matchover"] as const) {
      const state = { ...titleState(false), screen, simTime: 1 };
      expect(stepFrame(state, NO_INPUT, 0.25).state.simTime).toBe(1.25);
    }
  });
});

describe("countdown", () => {
  it("counts the hold down and serves on the frame it elapses, toward the receiver", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    let state = countdown();
    const frames = Math.ceil(HOLD_TIME / DT);
    for (let i = 0; i < frames - 1; i++) {
      state = stepFrame(state, NO_INPUT, DT).state;
      expect(state.screen).toBe("countdown");
      expect(state.ball?.held).toBe(true);
    }
    const sign = state.ball?.serveSign ?? 0;
    state = stepFrame(state, NO_INPUT, DT).state;
    expect(state.screen).toBe("playing");
    expect(state.ball).toMatchObject({
      held: false,
      holdTimer: 0,
      x: 640,
      y: 360,
      trail: [],
    });
    expect(state.ball?.vx).toBeCloseTo(-SERVE_SPEED * Math.cos(SERVE_ANGLE));
    expect(state.ball?.vy).toBeCloseTo(
      sign * SERVE_SPEED * Math.sin(SERVE_ANGLE),
    );
  });

  it("does not advance the ball on the frame it is served", () => {
    const state = countdown();
    const served = advance(
      { ...state, ball: { ...(state.ball as BallState), holdTimer: 0.001 } },
      NO_INPUT.held,
      DT,
    ).state;
    expect(served.screen).toBe("playing");
    expect(served.ball).toMatchObject({ x: 640, y: 360 });
  });

  it("moves both paddles during the countdown, the AI heading home", () => {
    const state = countdown();
    const away = {
      ...state,
      paddles: { ...state.paddles, right: { ...state.paddles.right, cy: 600 } },
    };
    const next = advance(away, held({ p1Down: 1 }).held, DT).state;
    expect(next.paddles.left.cy).toBeCloseTo(FIELD_CY + PADDLE_SPEED * DT);
    expect(next.paddles.right.vy).toBe(-AI_SPEED);
  });

  it("records a trail sample on every countdown frame", () => {
    const state = countdown();
    const next = advance(state, NO_INPUT.held, DT).state;
    expect(next.ball?.trail).toEqual([{ x: 640, y: 360, t: state.simTime }]);
  });

  it("waits forever with no ball on the field", () => {
    const state = { ...countdown(), ball: null };
    const next = stepFrame(state, NO_INPUT, 5).state;
    expect(next.screen).toBe("countdown");
    expect(next.ball).toBeNull();
  });
});

describe("playing", () => {
  it("drives the human paddles from the held actions in each mode", () => {
    const solo = flying(countdown("solo"), {});
    const soloNext = advance(solo, held({ p2Up: 1 }).held, DT).state;
    expect(soloNext.paddles.left.cy).toBeCloseTo(FIELD_CY - PADDLE_SPEED * DT);
    const versus = flying(countdown("versus"), {});
    const versusNext = advance(
      versus,
      held({ p2Up: 1, p1Down: 1 }).held,
      DT,
    ).state;
    expect(versusNext.paddles.left.cy).toBeCloseTo(
      FIELD_CY + PADDLE_SPEED * DT,
    );
    expect(versusNext.paddles.right.cy).toBeCloseTo(
      FIELD_CY - PADDLE_SPEED * DT,
    );
  });

  it("moves a driven paddle at its drivenVy and ignores the player and the AI", () => {
    const state = flying(countdown("solo"), { vx: 400, y: 100 });
    const driven = {
      ...state,
      paddles: {
        left: { ...state.paddles.left, driven: true, drivenVy: -100 },
        right: { ...state.paddles.right, driven: true, drivenVy: 50 },
      },
    };
    const next = advance(driven, held({ p1Down: 1 }).held, DT).state;
    expect(next.paddles.left.cy).toBeCloseTo(FIELD_CY - 100 * DT);
    expect(next.paddles.left.vy).toBe(-100);
    expect(next.paddles.right.cy).toBeCloseTo(FIELD_CY + 50 * DT);
    expect(next.paddles.right.drivenVy).toBe(50);
  });

  it("pins a driven paddle at a bound with vy 0", () => {
    const state = flying(countdown("solo"), {});
    const driven = {
      ...state,
      paddles: {
        ...state.paddles,
        left: { cy: PADDLE_MIN_CY, vy: 0, driven: true, drivenVy: -300 },
      },
    };
    const next = advance(driven, NO_INPUT.held, DT).state;
    expect(next.paddles.left).toMatchObject({
      cy: PADDLE_MIN_CY,
      vy: 0,
      drivenVy: -300,
    });
  });

  it("advances the ball, appends the trail, and raises the paddle cue", () => {
    const state = flying(countdown("versus"), {
      x: P1_X1 + BALL_R + 4,
      y: FIELD_CY,
      vx: -400,
      vy: 0,
    });
    const result = advance(state, NO_INPUT.held, DT);
    expect(result.cues).toEqual([CUES.paddleHit]);
    expect(result.state.ball?.vx).toBeGreaterThan(0);
    expect(result.state.ball?.trail).toHaveLength(1);
  });

  it("scores for player one, parks the ball, and serves toward player two", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const state = flying(countdown("versus"), {
      x: FIELD_W - 2,
      y: 300,
      vx: 900,
      vy: 0,
      spin: 50,
    });
    const result = advance(state, NO_INPUT.held, DT);
    expect(result.cues).toEqual([CUES.score]);
    expect(result.state).toMatchObject({
      screen: "countdown",
      receiver: "right",
      score: { p1: 1, p2: 0 },
    });
    expect(result.state.ball).toEqual({
      x: 640,
      y: 360,
      vx: 0,
      vy: 0,
      spin: 0,
      held: true,
      holdTimer: HOLD_TIME,
      serveSign: 1,
      trail: [],
    });
  });

  it("scores for player two when the ball passes the left goal", () => {
    const state = flying(countdown("versus"), {
      x: 2,
      y: 300,
      vx: -900,
      vy: 0,
    });
    const next = advance(state, NO_INPUT.held, DT).state;
    expect(next).toMatchObject({
      screen: "countdown",
      receiver: "left",
      score: { p1: 0, p2: 1 },
    });
  });

  it("ends the match on the win rule, leaving the ball where it is", () => {
    const state = {
      ...flying(countdown("versus"), {
        x: FIELD_W - 2,
        y: 300,
        vx: 900,
        vy: 0,
      }),
      score: { p1: WIN_SCORE - 1, p2: 3 },
      menuIndex: 2,
    };
    const result = advance(state, NO_INPUT.held, DT);
    expect(result.state).toMatchObject({
      screen: "matchover",
      winner: "left",
      menuIndex: 0,
      score: { p1: WIN_SCORE, p2: 3 },
    });
    expect(result.state.ball?.held).toBe(false);
    expect(result.state.ball?.x).toBeGreaterThan(FIELD_W);
    expect(result.cues).toEqual([CUES.score]);
  });

  it("plays on at deuce until a two-point lead", () => {
    const state = {
      ...flying(countdown("versus"), {
        x: FIELD_W - 2,
        y: 300,
        vx: 900,
        vy: 0,
      }),
      score: { p1: 10, p2: 10 },
    };
    expect(advance(state, NO_INPUT.held, DT).state.screen).toBe("countdown");
    const lead = { ...state, score: { p1: 11, p2: 10 } };
    expect(advance(lead, NO_INPUT.held, DT).state).toMatchObject({
      screen: "matchover",
      winner: "left",
    });
  });

  it("skips the ball entirely when none is on the field", () => {
    const state = { ...flying(countdown("versus"), {}), ball: null };
    const result = advance(state, held({ p1Up: 1 }).held, DT);
    expect(result.state.ball).toBeNull();
    expect(result.cues).toEqual([]);
    expect(result.state.paddles.left.cy).toBeLessThan(FIELD_CY);
  });
});

describe("frozen screens", () => {
  it("advances nothing while paused or on a menu", () => {
    const base = flying(countdown("versus"), { vx: 400, vy: 0 });
    for (const screen of ["paused", "title", "howto", "matchover"] as const) {
      const state = { ...base, screen };
      const next = stepFrame(state, held({ p1Down: 1 }), DT).state;
      expect(next.ball).toEqual(base.ball);
      expect(next.paddles).toEqual(base.paddles);
    }
  });

  it("advances the screen the input left the game on", () => {
    const paused = {
      ...flying(countdown("versus"), { vx: 400, vy: 0 }),
      screen: "paused" as const,
      resumeScreen: "playing" as const,
    };
    const input: FrameInput = {
      ...NO_INPUT,
      edges: { ...NO_INPUT.edges, pause: true },
    };
    const resumed = stepFrame(paused, input, DT).state;
    expect(resumed.screen).toBe("playing");
    expect(resumed.ball?.x).toBeGreaterThan(640);
    const playing = flying(countdown("versus"), { vx: 400, vy: 0 });
    const pausedNow = stepFrame(playing, input, DT).state;
    expect(pausedNow.screen).toBe("paused");
    expect(pausedNow.ball?.x).toBe(640);
  });
});
