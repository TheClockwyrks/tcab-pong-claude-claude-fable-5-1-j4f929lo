// The ball: parking, serving, the sub-stepped physics with its collisions,
// the trail, and the goal test (specs/balls.md).

import {
  BALL_R,
  FIELD_CX,
  FIELD_CY,
  FIELD_H,
  FIELD_W,
  HOLD_TIME,
  MAX_BOUNCE_ANGLE,
  MAX_SUBSTEP,
  OBSTACLES,
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
  type Rect,
} from "./constants";
import { resolveCircleRect } from "./collide";
import type { BallState, ObstacleState, PaddleState, Side } from "./game";
import { clamp } from "./math";
import { paddleRect } from "./paddle";
import { drawServeSign } from "./random";

/** The events one frame of ball physics raised, each once however many sub-steps raised it. */
export interface BallEvents {
  readonly paddleHit: boolean;
  readonly wallBounce: boolean;
  readonly obstacleBounce: boolean;
}

/** A ball parked at its home point: held, waiting, with a fresh serve sign. */
export function parkedBall(): BallState {
  return {
    x: FIELD_CX,
    y: FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: HOLD_TIME,
    serveSign: drawServeSign(),
    trail: [],
  };
}

/** Serve a waiting ball toward `receiver`, leaving its serve sign as it is. */
export function serveBall(ball: BallState, receiver: Side): BallState {
  const dir = receiver === "left" ? -1 : 1;
  return {
    ...ball,
    held: false,
    holdTimer: 0,
    vx: dir * SERVE_SPEED * Math.cos(SERVE_ANGLE),
    vy: ball.serveSign * SERVE_SPEED * Math.sin(SERVE_ANGLE),
    trail: [],
  };
}

/** Append a trail sample at the ball's position and drop the ones that expired. */
export function appendTrail(ball: BallState, simTime: number): BallState {
  const kept = ball.trail.filter((s) => simTime - s.t <= TRAIL_TIME);
  return { ...ball, trail: [...kept, { x: ball.x, y: ball.y, t: simTime }] };
}

/** The side that scored, once the ball has passed a goal, or `null`. */
export function scorerOf(ball: BallState): Side | null {
  if (ball.x - BALL_R > FIELD_W) return "left";
  if (ball.x + BALL_R < 0) return "right";
  return null;
}

interface Paddles {
  readonly left: PaddleState;
  readonly right: PaddleState;
}

/** The ball's velocity rotated by `angle` radians, positive clockwise on screen. */
function rotate(vx: number, vy: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [vx * c - vy * s, vx * s + vy * c];
}

/**
 * Advance a flying ball by `dt` seconds through the sub-steps the spec fixes,
 * resolving the walls, both paddles, and every present obstacle in order.
 */
export function stepBall(
  ball: BallState,
  paddles: Paddles,
  obstacles: readonly ObstacleState[],
  dt: number,
): { readonly ball: BallState; readonly events: BallEvents } {
  let { x, y, vx, vy, spin } = ball;
  let paddleHit = false;
  let wallBounce = false;
  let obstacleBounce = false;

  const startSpeed = Math.hypot(vx, vy);
  const n = Math.max(1, Math.ceil((startSpeed * dt) / MAX_SUBSTEP));
  const h = dt / n;
  const decay = Math.pow(0.5, h / SPIN_HALFLIFE);
  const sides: readonly Side[] = ["left", "right"];
  const rects: readonly Rect[] = obstacles.map((o) => OBSTACLES[o.index]);

  for (let step = 0; step < n; step++) {
    const speed = Math.hypot(vx, vy);
    if (speed > 0) [vx, vy] = rotate(vx, vy, (spin / speed) * h);
    spin *= decay;
    x += vx * h;
    y += vy * h;

    if (y - BALL_R < 0 && vy < 0) {
      y = BALL_R;
      vy = -vy;
      wallBounce = true;
    } else if (y + BALL_R > FIELD_H && vy > 0) {
      y = FIELD_H - BALL_R;
      vy = -vy;
      wallBounce = true;
    }

    for (const side of sides) {
      const paddle = paddles[side];
      const contact = resolveCircleRect(
        x,
        y,
        vx,
        vy,
        paddleRect(side, paddle.cy),
      );
      if (contact === null) continue;
      if (contact.face === "left" || contact.face === "right") {
        const offset = clamp((y - paddle.cy) / PADDLE_HALF, -1, 1);
        const theta = offset * MAX_BOUNCE_ANGLE;
        const outSpeed = Math.min(Math.hypot(vx, vy) * SPEED_MULT, SPEED_CAP);
        const dir = side === "left" ? 1 : -1;
        vx = dir * outSpeed * Math.cos(theta);
        vy = outSpeed * Math.sin(theta);
        spin = clamp(
          spin + paddle.vy * SPIN_FROM_PADDLE,
          -SPIN_CLAMP,
          SPIN_CLAMP,
        );
        x = side === "left" ? P1_X1 + BALL_R : P2_X0 - BALL_R;
        paddleHit = true;
      } else {
        ({ x, y, vx, vy } = contact);
        wallBounce = true;
      }
    }

    for (const rect of rects) {
      const contact = resolveCircleRect(x, y, vx, vy, rect);
      if (contact === null) continue;
      ({ x, y, vx, vy } = contact);
      obstacleBounce = true;
    }
  }

  return {
    ball: { ...ball, x, y, vx, vy, spin },
    events: { paddleHit, wallBounce, obstacleBounce },
  };
}
