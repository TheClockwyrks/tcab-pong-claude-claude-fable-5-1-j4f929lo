// The paddles: their rectangles, the human movement rule, and the one
// integration every mover of a paddle shares (specs/playfield.md).

import {
  P1_X0,
  P1_X1,
  P2_X0,
  P2_X1,
  PADDLE_HALF,
  PADDLE_MAX_CY,
  PADDLE_MIN_CY,
  type Rect,
} from "./constants";
import type { Mode, PaddleState, Side } from "./game";
import { clamp } from "./math";

/** The movement actions held this frame, each `1` while held and `0` otherwise. */
export interface HeldMovement {
  readonly p1Up: number;
  readonly p1Down: number;
  readonly p2Up: number;
  readonly p2Down: number;
}

/** The axis-aligned rectangle a paddle occupies at center `cy`. */
export function paddleRect(side: Side, cy: number): Rect {
  return {
    x0: side === "left" ? P1_X0 : P2_X0,
    x1: side === "left" ? P1_X1 : P2_X1,
    y0: cy - PADDLE_HALF,
    y1: cy + PADDLE_HALF,
  };
}

/**
 * The movement axis a human player drives `side` with: `down - up`, each `1`
 * while held. In Solo all four movement actions drive the left paddle; in
 * Versus each player's pair drives their own.
 */
export function humanAxis(mode: Mode, side: Side, held: HeldMovement): number {
  if (mode === "solo") {
    if (side === "right") return 0;
    const up = held.p1Up || held.p2Up ? 1 : 0;
    const down = held.p1Down || held.p2Down ? 1 : 0;
    return down - up;
  }
  return side === "left" ? held.p1Down - held.p1Up : held.p2Down - held.p2Up;
}

/**
 * Move a paddle at `vy` for `dt` seconds, clamped to the field. When the clamp
 * changed the result, the paddle's `vy` becomes the velocity it actually
 * travelled at, so a paddle pinned against a bound carries `vy = 0`.
 */
export function integratePaddle(
  paddle: PaddleState,
  vy: number,
  dt: number,
): PaddleState {
  const raw = paddle.cy + vy * dt;
  const next = clamp(raw, PADDLE_MIN_CY, PADDLE_MAX_CY);
  const actual = next !== raw && dt > 0 ? (next - paddle.cy) / dt : vy;
  return { ...paddle, cy: next, vy: actual };
}
