import { describe, expect, it } from "vitest";
import { FIELD_CY, HOLD_TIME, OBSTACLE_CENTERS, WIN_SCORE } from "./constants";
import {
  allObstacles,
  obstacleAt,
  otherSide,
  returnToTitle,
  startMatch,
  titleState,
  winnerOf,
} from "./match";

describe("titleState", () => {
  it("opens on the title with every field at its stated value", () => {
    const state = titleState(true);
    expect(state).toMatchObject({
      screen: "title",
      mode: "solo",
      menuIndex: 0,
      titleIndex: 0,
      resumeScreen: "playing",
      score: { p1: 0, p2: 0 },
      winner: null,
      receiver: "left",
      ai: { tracking: true, movement: true },
      simTime: 0,
      muted: true,
      presses: [],
    });
    expect(state.paddles.left).toEqual({
      cy: FIELD_CY,
      vy: 0,
      driven: false,
      drivenVy: 0,
    });
    expect(state.paddles.right).toEqual({
      cy: FIELD_CY,
      vy: 0,
      driven: false,
      drivenVy: 0,
    });
    expect(state.ball).toMatchObject({
      held: true,
      holdTimer: HOLD_TIME,
      vx: 0,
      vy: 0,
      spin: 0,
      trail: [],
    });
    expect(state.obstacles).toEqual(allObstacles());
  });
});

describe("obstacles", () => {
  it("places each obstacle at its fixed center", () => {
    expect(obstacleAt(1)).toEqual({
      index: 1,
      cx: OBSTACLE_CENTERS[1].x,
      cy: OBSTACLE_CENTERS[1].y,
    });
    expect(allObstacles().map((o) => o.index)).toEqual([0, 1]);
  });

  it("refuses an index naming no obstacle", () => {
    expect(() => obstacleAt(2)).toThrow(RangeError);
    expect(() => obstacleAt(-1)).toThrow(RangeError);
  });
});

describe("startMatch", () => {
  it("starts a countdown in the mode asked for with everything reset", () => {
    const before = {
      ...titleState(false),
      screen: "matchover" as const,
      score: { p1: 11, p2: 3 },
      winner: "left" as const,
      receiver: "right" as const,
      titleIndex: 1,
      menuIndex: 1,
      simTime: 42,
      paddles: {
        left: { cy: 100, vy: 5, driven: true, drivenVy: 9 },
        right: { cy: 600, vy: -5, driven: false, drivenVy: 0 },
      },
    };
    const state = startMatch(before, "versus");
    expect(state).toMatchObject({
      mode: "versus",
      screen: "countdown",
      resumeScreen: "playing",
      menuIndex: 0,
      titleIndex: 1,
      score: { p1: 0, p2: 0 },
      winner: null,
      receiver: "left",
      simTime: 42,
    });
    expect(state.paddles.left).toEqual({
      cy: FIELD_CY,
      vy: 0,
      driven: true,
      drivenVy: 9,
    });
    expect(state.paddles.right.cy).toBe(FIELD_CY);
    expect(state.ball).toMatchObject({
      held: true,
      holdTimer: HOLD_TIME,
      trail: [],
    });
  });
});

describe("returnToTitle", () => {
  it("restores the title state but keeps titleIndex, simTime and muted", () => {
    const before = {
      ...titleState(true),
      screen: "paused" as const,
      mode: "versus" as const,
      titleIndex: 2,
      menuIndex: 1,
      simTime: 7,
      score: { p1: 4, p2: 2 },
      ai: { tracking: false, movement: false },
      obstacles: [],
      ball: null,
    };
    const state = returnToTitle(before);
    expect(state).toMatchObject({
      screen: "title",
      mode: "solo",
      titleIndex: 2,
      menuIndex: 2,
      simTime: 7,
      muted: true,
      score: { p1: 0, p2: 0 },
      ai: { tracking: true, movement: true },
    });
    expect(state.ball).not.toBeNull();
    expect(state.obstacles).toHaveLength(2);
  });
});

describe("winnerOf", () => {
  it("needs WIN_SCORE points and a lead of WIN_LEAD", () => {
    expect(winnerOf({ p1: WIN_SCORE, p2: 0 })).toBe("left");
    expect(winnerOf({ p1: 0, p2: WIN_SCORE })).toBe("right");
    expect(winnerOf({ p1: WIN_SCORE, p2: WIN_SCORE - 1 })).toBeNull();
    expect(winnerOf({ p1: 10, p2: 10 })).toBeNull();
    expect(winnerOf({ p1: 12, p2: 10 })).toBe("left");
    expect(winnerOf({ p1: 11, p2: 13 })).toBe("right");
    expect(winnerOf({ p1: 9, p2: 0 })).toBeNull();
  });
});

describe("otherSide", () => {
  it("flips the side", () => {
    expect(otherSide("left")).toBe("right");
    expect(otherSide("right")).toBe("left");
  });
});
