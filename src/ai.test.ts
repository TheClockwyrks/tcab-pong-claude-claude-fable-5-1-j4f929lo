import { describe, expect, it } from "vitest";
import {
  AI_DEADZONE,
  AI_HOME_DEADZONE,
  AI_HOME_Y,
  AI_REACT,
  AI_SPEED,
} from "./constants";
import { aiVelocity } from "./ai";
import type { CaromState } from "./game";
import { titleState } from "./match";

function playing(
  changes: Partial<CaromState>,
  rightCy = 360,
  ball = { vx: 300, vy: -100, y: 500 },
): CaromState {
  const base = titleState(false);
  return {
    ...base,
    screen: "playing",
    paddles: { ...base.paddles, right: { ...base.paddles.right, cy: rightCy } },
    ball: base.ball === null ? null : { ...base.ball, ...ball, held: false },
    ...changes,
  };
}

describe("aiVelocity", () => {
  const dt = 1 / 60;

  it("tracks the ball's predicted position when it travels toward the AI", () => {
    const state = playing({});
    const target = 500 - -100 * AI_REACT;
    expect(aiVelocity(state, dt)).toBe(Math.sign(target - 360) * AI_SPEED);
  });

  it("returns home while the ball travels away", () => {
    const state = playing({}, 500, { vx: -300, vy: 0, y: 100 });
    expect(aiVelocity(state, dt)).toBe(-AI_SPEED);
  });

  it("returns home during the countdown whatever the ball does", () => {
    const state = { ...playing({}, 500), screen: "countdown" as const };
    expect(aiVelocity(state, dt)).toBe(-AI_SPEED);
  });

  it("stops inside the defending dead zone and the home dead zone", () => {
    const near = playing({}, 500 - -100 * AI_REACT + AI_DEADZONE);
    expect(aiVelocity(near, dt)).toBe(0);
    const home = playing({}, AI_HOME_Y + AI_HOME_DEADZONE, {
      vx: -1,
      vy: 0,
      y: 0,
    });
    expect(aiVelocity(home, dt)).toBe(0);
    const justOut = playing({}, AI_HOME_Y + AI_HOME_DEADZONE + 1, {
      vx: -1,
      vy: 0,
      y: 0,
    });
    expect(aiVelocity(justOut, dt)).toBeCloseTo(-Math.min(AI_SPEED, 19 / dt));
  });

  it("never overshoots: speed is bounded by the distance over dt", () => {
    const state = playing({}, 365, { vx: 300, vy: 0, y: 380 });
    expect(aiVelocity(state, 0.1)).toBeCloseTo(150);
  });

  it("falls back to top speed when dt is zero", () => {
    const state = playing({}, 100);
    expect(aiVelocity(state, 0)).toBe(AI_SPEED);
  });

  it("heads home with tracking off and holds still with movement off", () => {
    const blind = playing({ ai: { tracking: false, movement: true } }, 500);
    expect(aiVelocity(blind, dt)).toBe(-AI_SPEED);
    const still = playing({ ai: { tracking: true, movement: false } }, 500);
    expect(aiVelocity(still, dt)).toBe(0);
  });

  it("heads home with no ball on the field", () => {
    const empty = playing({ ball: null }, 200);
    expect(aiVelocity(empty, dt)).toBe(AI_SPEED);
  });
});
