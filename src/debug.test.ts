import { afterEach, describe, expect, it, vi } from "vitest";
import { CAROM_DEBUG_VERSION, HOLD_TIME, OBSTACLE_CENTERS } from "./constants";
import { createDebugApi, OBSTACLE_INDICES } from "./debug";
import type { CaromState } from "./game";
import { startMatch, titleState } from "./match";
import { menuItemRect } from "./menus";

const debug = createDebugApi();
const title = titleState(false);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the world", () => {
  it("clears and respawns the ball and the obstacles", () => {
    const empty = debug.clearWorld(title);
    expect(empty.ball).toBeNull();
    expect(empty.obstacles).toEqual([]);
    expect(empty.paddles).toEqual(title.paddles);
    expect(debug.snapshot(empty)).toMatchObject({ ball: null, obstacles: [] });

    const withBall = debug.spawnBall(empty);
    expect(withBall.ball).toMatchObject({
      x: 640,
      y: 360,
      held: true,
      holdTimer: HOLD_TIME,
      vx: 0,
      vy: 0,
      spin: 0,
      trail: [],
    });

    const one = debug.spawnObstacle(empty, 1);
    expect(one.obstacles).toEqual([
      { index: 1, cx: OBSTACLE_CENTERS[1].x, cy: OBSTACLE_CENTERS[1].y },
    ]);
    const both = debug.spawnObstacle(one, 0);
    expect(both.obstacles.map((o) => o.index)).toEqual([0, 1]);
    const again = debug.spawnObstacle(both, 0);
    expect(again.obstacles).toHaveLength(2);
    expect(OBSTACLE_INDICES).toEqual([0, 1]);
  });

  it("refuses an obstacle index naming no obstacle", () => {
    expect(() => debug.spawnObstacle(title, 2)).toThrow(RangeError);
  });

  it("spawning a ball that is already present re-parks it", () => {
    const moved = debug.setBallPosition(title, 100, 100);
    expect(debug.spawnBall(moved).ball).toMatchObject({ x: 640, y: 360 });
  });

  it("resets to the title screen, keeping only the mute bit", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    const messy: CaromState = {
      ...startMatch(title, "versus"),
      screen: "paused",
      titleIndex: 2,
      simTime: 9,
      muted: true,
      ai: { tracking: false, movement: false },
      paddles: {
        left: { cy: 10, vy: 1, driven: true, drivenVy: 5 },
        right: { cy: 20, vy: 2, driven: true, drivenVy: 6 },
      },
    };
    const reset = debug.reset(messy);
    expect(reset).toEqual({ ...titleState(true), muted: true });
    expect(reset.simTime).toBe(0);
    expect(reset.titleIndex).toBe(0);
    expect(reset.paddles.left.driven).toBe(false);
  });

  it("reconciles to an equal state", () => {
    const posed = debug.setBallVelocity(title, 3, 4);
    const once = debug.reconcile(posed);
    expect(once).toEqual(posed);
    expect(debug.reconcile(once)).toEqual(once);
    expect(debug.snapshot(once).ball?.speed).toBe(5);
  });
});

describe("screens and menus", () => {
  it("sets each field alone", () => {
    const state = { ...title, menuIndex: 1, score: { p1: 2, p2: 3 } };
    expect(debug.setScreen(state, "paused")).toMatchObject({
      screen: "paused",
      menuIndex: 1,
      score: { p1: 2, p2: 3 },
    });
    expect(debug.setMode(state, "versus").mode).toBe("versus");
    expect(debug.setMenuIndex(state, 2).menuIndex).toBe(2);
    expect(debug.setTitleIndex(state, 2).titleIndex).toBe(2);
    expect(debug.setResumeScreen(state, "countdown").resumeScreen).toBe(
      "countdown",
    );
  });

  it("refuses names outside the vocabulary", () => {
    expect(() => debug.setScreen(title, "lobby" as never)).toThrow(RangeError);
    expect(() => debug.setMode(title, "coop" as never)).toThrow(RangeError);
    expect(() => debug.setResumeScreen(title, "title" as never)).toThrow(
      RangeError,
    );
    expect(() => debug.setMenuIndex(title, Number.NaN)).toThrow(RangeError);
  });
});

describe("match state", () => {
  it("sets the scores, the winner, and the receiver", () => {
    expect(debug.setScore(title, 5, 7).score).toEqual({ p1: 5, p2: 7 });
    expect(debug.setWinner(title, "right").winner).toBe("right");
    expect(
      debug.setWinner(debug.setWinner(title, "left"), null).winner,
    ).toBeNull();
    expect(debug.setReceiver(title, "right").receiver).toBe("right");
    expect(() => debug.setReceiver(title, "middle" as never)).toThrow(
      RangeError,
    );
    expect(() => debug.setWinner(title, "middle" as never)).toThrow(RangeError);
  });
});

describe("paddles", () => {
  it("poses one paddle's field alone", () => {
    const cy = debug.setPaddleCy(title, "left", 123);
    expect(cy.paddles.left.cy).toBe(123);
    expect(cy.paddles.right).toEqual(title.paddles.right);
    const vy = debug.setPaddleVy(title, "right", -80);
    expect(vy.paddles.right).toMatchObject({ drivenVy: -80, vy: 0 });
    const driven = debug.setPaddleDriven(title, "right", true);
    expect(driven.paddles.right.driven).toBe(true);
    expect(driven.paddles.left.driven).toBe(false);
    expect(() => debug.setPaddleCy(title, "up" as never, 1)).toThrow(
      RangeError,
    );
    expect(() =>
      debug.setPaddleCy(title, "left", Number.POSITIVE_INFINITY),
    ).toThrow(RangeError);
  });
});

describe("the ball", () => {
  it("poses each of the ball's fields and reads them back", () => {
    let state = debug.setBallPosition(title, 100, 200);
    state = debug.setBallVelocity(state, 300, -400);
    state = debug.setBallSpin(state, 250);
    state = debug.setBallHeld(state, false);
    state = debug.setBallHoldTimer(state, 0.25);
    state = debug.setBallServeSign(state, -1);
    expect(debug.snapshot(state).ball).toEqual({
      x: 100,
      y: 200,
      vx: 300,
      vy: -400,
      speed: 500,
      spin: 250,
      held: false,
      holdTimer: 0.25,
      serveSign: -1,
      trail: [],
    });
  });

  it("draws the serve sign afresh and changes nothing else", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const state = debug.setBallServeSign(title, 1);
    const drawn = debug.drawBallServeSign(state);
    expect(drawn.ball?.serveSign).toBe(-1);
    expect({ ...drawn.ball, serveSign: 1 }).toEqual(state.ball);
  });

  it("refuses a serve sign outside 1 and -1", () => {
    expect(() => debug.setBallServeSign(title, 0 as never)).toThrow(RangeError);
  });

  it("fails loudly while no ball is on the field", () => {
    const empty = debug.clearWorld(title);
    expect(() => debug.setBallPosition(empty, 1, 1)).toThrow(/no ball/);
    expect(() => debug.setBallVelocity(empty, 1, 1)).toThrow(/no ball/);
    expect(() => debug.setBallSpin(empty, 1)).toThrow(/no ball/);
    expect(() => debug.setBallHeld(empty, true)).toThrow(/no ball/);
    expect(() => debug.setBallHoldTimer(empty, 1)).toThrow(/no ball/);
    expect(() => debug.setBallServeSign(empty, 1)).toThrow(/no ball/);
    expect(() => debug.drawBallServeSign(empty)).toThrow(/no ball/);
  });
});

describe("the AI and audio", () => {
  it("gates each faculty on its own", () => {
    expect(debug.setAiTracking(title, false).ai).toEqual({
      tracking: false,
      movement: true,
    });
    expect(debug.setAiMovement(title, false).ai).toEqual({
      tracking: true,
      movement: false,
    });
  });

  it("sets the mute bit the snapshot reports", () => {
    expect(debug.snapshot(debug.setMuted(title, true)).muted).toBe(true);
    expect(debug.reset(debug.setMuted(title, true)).muted).toBe(true);
  });
});

describe("readings", () => {
  it("reports the whole declared state", () => {
    const state = { ...startMatch(title, "versus"), simTime: 3.5 };
    const snapshot = debug.snapshot(state);
    expect(snapshot).toMatchObject({
      version: CAROM_DEBUG_VERSION,
      screen: "countdown",
      mode: "versus",
      menuIndex: 0,
      titleIndex: 0,
      resumeScreen: "playing",
      score: { p1: 0, p2: 0 },
      winner: null,
      muted: false,
      paddles: {
        left: { cy: 360, vy: 0, drivenVy: 0, driven: false },
        right: { cy: 360, vy: 0, drivenVy: 0, driven: false },
      },
      ai: { tracking: true, movement: true },
      receiver: "left",
      simTime: 3.5,
    });
    expect(snapshot.obstacles).toEqual(state.obstacles);
    expect(snapshot.ball?.trail).toEqual([]);
    expect(Object.keys(snapshot)).not.toContain("presses");
  });

  it("copies rather than exposes the state's arrays", () => {
    const snapshot = debug.snapshot(title);
    expect(snapshot.obstacles).not.toBe(title.obstacles);
    expect(snapshot.ball?.trail).not.toBe(title.ball?.trail);
  });

  it("reports menu item regions for the current screen", () => {
    expect(debug.menuItemRect(title, 1)).toEqual(menuItemRect("title", 1));
    expect(debug.menuItemRect({ ...title, screen: "playing" }, 0)).toBeNull();
    expect(debug.menuItemRect({ ...title, screen: "countdown" }, 0)).toBeNull();
    expect(debug.menuItemRect(title, 3)).toBeNull();
    expect(
      debug.menuItemRect({ ...title, screen: "matchover" }, 1),
    ).toMatchObject({ w: expect.any(Number), h: expect.any(Number) });
  });
});
