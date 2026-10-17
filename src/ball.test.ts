import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BALL_R,
  FIELD_CX,
  FIELD_CY,
  FIELD_H,
  FIELD_W,
  HOLD_TIME,
  MAX_BOUNCE_ANGLE,
  MAX_SUBSTEP,
  OBSTACLE_CENTERS,
  OBSTACLE_HW,
  P1_X1,
  P2_X0,
  PADDLE_HALF,
  SERVE_ANGLE,
  SERVE_SPEED,
  SPEED_CAP,
  SPEED_MULT,
  SPIN_CLAMP,
  SPIN_FROM_PADDLE,
  SPIN_HALFLIFE,
  TRAIL_TIME,
} from "./constants";
import { appendTrail, parkedBall, scorerOf, serveBall, stepBall } from "./ball";
import type { BallState, PaddleState } from "./game";
import { allObstacles } from "./match";

const rest: PaddleState = { cy: FIELD_CY, vy: 0, driven: false, drivenVy: 0 };
const paddles = { left: rest, right: rest };
const obstacles = allObstacles();

function flying(changes: Partial<BallState>): BallState {
  return { ...parkedBall(), held: false, holdTimer: 0, ...changes };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parkedBall", () => {
  it("waits at the home point with a fresh serve sign", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    expect(parkedBall()).toEqual({
      x: FIELD_CX,
      y: FIELD_CY,
      vx: 0,
      vy: 0,
      spin: 0,
      held: true,
      holdTimer: HOLD_TIME,
      serveSign: 1,
      trail: [],
    });
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    expect(parkedBall().serveSign).toBe(-1);
  });
});

describe("serveBall", () => {
  it("leaves toward the receiver at the serve speed and angle", () => {
    const ball = { ...parkedBall(), serveSign: -1 as const };
    const left = serveBall(ball, "left");
    expect(left.vx).toBeCloseTo(-SERVE_SPEED * Math.cos(SERVE_ANGLE));
    expect(left.vy).toBeCloseTo(-SERVE_SPEED * Math.sin(SERVE_ANGLE));
    expect(left.held).toBe(false);
    expect(left.holdTimer).toBe(0);
    expect(left.trail).toEqual([]);
    expect(left.serveSign).toBe(-1);
    const right = serveBall({ ...ball, serveSign: 1 }, "right");
    expect(right.vx).toBeCloseTo(SERVE_SPEED * Math.cos(SERVE_ANGLE));
    expect(right.vy).toBeCloseTo(SERVE_SPEED * Math.sin(SERVE_ANGLE));
  });
});

describe("appendTrail", () => {
  it("appends the ball's position and drops samples older than TRAIL_TIME", () => {
    const ball = flying({
      x: 10,
      y: 20,
      trail: [
        { x: 1, y: 1, t: 1 },
        { x: 2, y: 2, t: 1.1 },
      ],
    });
    const next = appendTrail(ball, 1.1 + TRAIL_TIME + 0.001);
    expect(next.trail).toEqual([{ x: 10, y: 20, t: 1.1 + TRAIL_TIME + 0.001 }]);
    const kept = appendTrail(ball, 1.1 + TRAIL_TIME);
    expect(kept.trail).toHaveLength(2);
  });
});

describe("scorerOf", () => {
  it("scores for the side the ball passed", () => {
    expect(scorerOf(flying({ x: FIELD_W + BALL_R + 1 }))).toBe("left");
    expect(scorerOf(flying({ x: -BALL_R - 1 }))).toBe("right");
    expect(scorerOf(flying({ x: FIELD_W + BALL_R }))).toBeNull();
    expect(scorerOf(flying({ x: FIELD_CX }))).toBeNull();
  });
});

describe("stepBall", () => {
  it("advances a straight ball and raises nothing", () => {
    const { ball, events } = stepBall(
      flying({ vx: 300, vy: 60 }),
      paddles,
      obstacles,
      0.1,
    );
    expect(ball.x).toBeCloseTo(FIELD_CX + 30);
    expect(ball.y).toBeCloseTo(FIELD_CY + 6);
    expect(events).toEqual({
      paddleHit: false,
      wallBounce: false,
      obstacleBounce: false,
    });
  });

  it("reflects off the top and bottom walls without changing speed or spin", () => {
    const top = stepBall(
      flying({ x: 300, y: BALL_R + 2, vx: 100, vy: -400, spin: 50 }),
      paddles,
      obstacles,
      0.02,
    );
    expect(top.events.wallBounce).toBe(true);
    expect(top.ball.vy).toBeGreaterThan(0);
    expect(Math.hypot(top.ball.vx, top.ball.vy)).toBeCloseTo(
      Math.hypot(100, 400),
      6,
    );
    expect(top.ball.y).toBeGreaterThanOrEqual(BALL_R);
    const bottom = stepBall(
      flying({ x: 300, y: FIELD_H - BALL_R - 2, vx: 100, vy: 400 }),
      paddles,
      obstacles,
      0.02,
    );
    expect(bottom.events.wallBounce).toBe(true);
    expect(bottom.ball.vy).toBeLessThan(0);
    expect(bottom.ball.y).toBeLessThanOrEqual(FIELD_H - BALL_R);
  });

  it("bounces off the left paddle by the contact point, faster, toward the right", () => {
    const start = flying({
      x: P1_X1 + BALL_R + 5,
      y: FIELD_CY + PADDLE_HALF / 2,
      vx: -500,
      vy: 0,
    });
    const { ball, events } = stepBall(start, paddles, obstacles, 0.02);
    expect(events.paddleHit).toBe(true);
    const speed = 500 * SPEED_MULT;
    const theta = 0.5 * MAX_BOUNCE_ANGLE;
    expect(ball.vx).toBeCloseTo(speed * Math.cos(theta), 6);
    expect(ball.vy).toBeCloseTo(speed * Math.sin(theta), 6);
    expect(ball.x).toBeGreaterThanOrEqual(P1_X1 + BALL_R);
    expect(ball.spin).toBe(0);
  });

  it("bounces off the right paddle toward the left and caps the speed", () => {
    const start = flying({
      x: P2_X0 - BALL_R - 5,
      y: FIELD_CY,
      vx: 970,
      vy: 0,
    });
    const { ball, events } = stepBall(start, paddles, obstacles, 0.01);
    expect(events.paddleHit).toBe(true);
    expect(ball.vx).toBeCloseTo(-SPEED_CAP, 6);
    expect(ball.vy).toBeCloseTo(0, 6);
  });

  it("clamps the contact offset at the paddle's edges", () => {
    const start = flying({
      x: P1_X1 + BALL_R + 2,
      y: FIELD_CY - PADDLE_HALF - 5,
      vx: -300,
      vy: 0,
    });
    const { ball } = stepBall(start, paddles, obstacles, 0.01);
    const angle = Math.atan2(ball.vy, ball.vx);
    expect(angle).toBeCloseTo(-MAX_BOUNCE_ANGLE, 6);
  });

  it("adds spin from the striking paddle's velocity, clamped", () => {
    const moving = { left: { ...rest, vy: 400 }, right: rest };
    const start = flying({
      x: P1_X1 + BALL_R + 2,
      y: FIELD_CY,
      vx: -300,
      vy: 0,
    });
    const hit = stepBall(start, moving, obstacles, 0.01);
    expect(hit.ball.spin).toBeCloseTo(400 * SPIN_FROM_PADDLE, 3);
    const fast = { left: { ...rest, vy: -5000 }, right: rest };
    const clamped = stepBall(start, fast, obstacles, 0.01);
    expect(clamped.ball.spin).toBeCloseTo(-SPIN_CLAMP, 3);
  });

  it("treats a paddle end cap like a wall", () => {
    const start = flying({
      x: P1_X1 - 4,
      y: FIELD_CY - PADDLE_HALF - BALL_R - 2,
      vx: 0,
      vy: 300,
      spin: 20,
    });
    const { ball, events } = stepBall(start, paddles, obstacles, 0.02);
    expect(events.wallBounce).toBe(true);
    expect(events.paddleHit).toBe(false);
    expect(ball.vy).toBeLessThan(0);
    expect(Math.abs(ball.vy)).toBeCloseTo(300, 6);
    expect(ball.y).toBeLessThanOrEqual(FIELD_CY - PADDLE_HALF - BALL_R);
  });

  it("bounces off an obstacle leaving speed and spin unchanged", () => {
    const a = OBSTACLE_CENTERS[0];
    const start = flying({
      x: a.x - OBSTACLE_HW - BALL_R - 3,
      y: a.y,
      vx: 400,
      vy: 0,
      spin: 100,
    });
    const { ball, events } = stepBall(start, paddles, obstacles, 0.02);
    expect(events.obstacleBounce).toBe(true);
    expect(ball.vx).toBeLessThan(0);
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(400, 6);
    expect(ball.spin).toBeCloseTo(100 * Math.pow(0.5, 0.02 / SPIN_HALFLIFE), 6);
    expect(ball.x).toBeLessThanOrEqual(a.x - OBSTACLE_HW - BALL_R);
  });

  it("ignores an obstacle that is absent", () => {
    const a = OBSTACLE_CENTERS[0];
    const start = flying({
      x: a.x - OBSTACLE_HW - BALL_R - 3,
      y: a.y,
      vx: 400,
      vy: 0,
    });
    const { ball, events } = stepBall(start, paddles, [], 0.02);
    expect(events.obstacleBounce).toBe(false);
    expect(ball.vx).toBe(400);
  });

  it("turns the velocity clockwise under positive spin and decays the spin", () => {
    const dt = 0.5;
    const { ball } = stepBall(
      flying({ vx: 400, vy: 0, spin: 200 }),
      paddles,
      [],
      dt,
    );
    expect(ball.vy).toBeGreaterThan(0);
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(400, 6);
    expect(ball.spin).toBeCloseTo(200 * Math.pow(0.5, dt / SPIN_HALFLIFE), 6);
    const other = stepBall(
      flying({ vx: 400, vy: 0, spin: -200 }),
      paddles,
      [],
      dt,
    );
    expect(other.ball.vy).toBeLessThan(0);
  });

  it("skips the spin turn at zero speed", () => {
    const { ball } = stepBall(
      flying({ vx: 0, vy: 0, spin: 500 }),
      paddles,
      obstacles,
      0.1,
    );
    expect(ball).toMatchObject({ x: FIELD_CX, y: FIELD_CY, vx: 0, vy: 0 });
  });

  it("cuts a frame into sub-steps of at most MAX_SUBSTEP units", () => {
    const start = flying({ x: 200, y: 360, vx: SPEED_CAP, vy: 0 });
    const dt = 0.016;
    const n = Math.max(1, Math.ceil((SPEED_CAP * dt) / MAX_SUBSTEP));
    const { ball } = stepBall(start, paddles, [], dt);
    expect(ball.x).toBeCloseTo(200 + SPEED_CAP * (dt / n) * n, 6);
    expect(n).toBeGreaterThan(1);
  });

  it("never tunnels through a paddle at the speed cap", () => {
    let ball = flying({ x: FIELD_CX, y: FIELD_CY, vx: SPEED_CAP, vy: 0 });
    for (let i = 0; i < 60; i++) {
      ball = stepBall(ball, paddles, [], 0.016).ball;
      expect(ball.x).toBeLessThanOrEqual(P2_X0 - BALL_R + 1e-9);
      expect(ball.x).toBeGreaterThanOrEqual(P1_X1 + BALL_R - 1e-9);
    }
  });
});
