import { describe, expect, it } from "vitest";
import {
  P1_X0,
  P1_X1,
  P2_X0,
  P2_X1,
  PADDLE_HALF,
  PADDLE_MAX_CY,
  PADDLE_MIN_CY,
} from "./constants";
import type { PaddleState } from "./game";
import {
  humanAxis,
  integratePaddle,
  paddleRect,
  type HeldMovement,
} from "./paddle";

const rest: PaddleState = { cy: 360, vy: 0, driven: false, drivenVy: 0 };

describe("integratePaddle", () => {
  it("moves at vy for dt and carries that vy", () => {
    const next = integratePaddle(rest, 720, 0.1);
    expect(next.cy).toBeCloseTo(432);
    expect(next.vy).toBe(720);
  });

  it("clamps to the field and reports the velocity actually travelled", () => {
    const near: PaddleState = { ...rest, cy: PADDLE_MAX_CY - 10 };
    const next = integratePaddle(near, 720, 0.1);
    expect(next.cy).toBe(PADDLE_MAX_CY);
    expect(next.vy).toBeCloseTo(100);
  });

  it("carries vy = 0 while pinned against a bound", () => {
    const pinned: PaddleState = { ...rest, cy: PADDLE_MIN_CY };
    const next = integratePaddle(pinned, -720, 0.016);
    expect(next.cy).toBe(PADDLE_MIN_CY);
    expect(next.vy).toBe(0);
  });

  it("keeps vy when dt is zero", () => {
    const outside: PaddleState = { ...rest, cy: 1000 };
    const next = integratePaddle(outside, 50, 0);
    expect(next.cy).toBe(PADDLE_MAX_CY);
    expect(next.vy).toBe(50);
  });

  it("keeps the driven fields as they were", () => {
    const driven: PaddleState = { ...rest, driven: true, drivenVy: -40 };
    expect(integratePaddle(driven, 10, 0.5)).toMatchObject({
      driven: true,
      drivenVy: -40,
    });
  });
});

describe("humanAxis", () => {
  const held = (h: Partial<HeldMovement>): HeldMovement => ({
    p1Up: 0,
    p1Down: 0,
    p2Up: 0,
    p2Down: 0,
    ...h,
  });

  it("drives the left paddle from all four actions in solo", () => {
    expect(humanAxis("solo", "left", held({ p1Up: 1 }))).toBe(-1);
    expect(humanAxis("solo", "left", held({ p2Down: 1 }))).toBe(1);
    expect(humanAxis("solo", "left", held({ p1Up: 1, p2Down: 1 }))).toBe(0);
    expect(humanAxis("solo", "left", held({ p1Up: 1, p2Up: 1 }))).toBe(-1);
  });

  it("gives the right paddle no human axis in solo", () => {
    expect(humanAxis("solo", "right", held({ p2Up: 1, p2Down: 0 }))).toBe(0);
  });

  it("keeps each player's actions to their own paddle in versus", () => {
    expect(humanAxis("versus", "left", held({ p1Down: 1, p2Up: 1 }))).toBe(1);
    expect(humanAxis("versus", "right", held({ p1Down: 1, p2Up: 1 }))).toBe(-1);
    expect(humanAxis("versus", "right", held({ p2Up: 1, p2Down: 1 }))).toBe(0);
  });
});

describe("paddleRect", () => {
  it("spans the fixed x range and the paddle's height about cy", () => {
    expect(paddleRect("left", 200)).toEqual({
      x0: P1_X0,
      x1: P1_X1,
      y0: 200 - PADDLE_HALF,
      y1: 200 + PADDLE_HALF,
    });
    expect(paddleRect("right", 500)).toEqual({
      x0: P2_X0,
      x1: P2_X1,
      y0: 500 - PADDLE_HALF,
      y1: 500 + PADDLE_HALF,
    });
  });
});
