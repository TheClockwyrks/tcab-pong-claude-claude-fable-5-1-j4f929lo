// The circle against an axis-aligned rectangle rule (specs/balls.md), shared
// by the paddles and the obstacles.

import { BALL_R, type Rect } from "./constants";

export type Face = "left" | "right" | "top" | "bottom";

/** A ball resolved against a rectangle: the face it struck and where it ends. */
export interface Contact {
  readonly face: Face;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

/**
 * Resolve a ball of radius `BALL_R` at `(x, y)` against `rect`, or `null` when
 * the ball's center is not strictly inside the rectangle expanded by the
 * radius. The struck face is the one with the smallest penetration, the first
 * of left, right, top, bottom winning a tie; the ball is placed off that face
 * and the normal velocity component is reversed if it points into the face.
 */
export function resolveCircleRect(
  x: number,
  y: number,
  vx: number,
  vy: number,
  rect: Rect,
): Contact | null {
  const left = x - (rect.x0 - BALL_R);
  const right = rect.x1 + BALL_R - x;
  const top = y - (rect.y0 - BALL_R);
  const bottom = rect.y1 + BALL_R - y;
  if (left <= 0 || right <= 0 || top <= 0 || bottom <= 0) return null;

  const depth = Math.min(left, right, top, bottom);
  if (depth === left) {
    return { face: "left", x: rect.x0 - BALL_R, y, vx: vx > 0 ? -vx : vx, vy };
  }
  if (depth === right) {
    return { face: "right", x: rect.x1 + BALL_R, y, vx: vx < 0 ? -vx : vx, vy };
  }
  if (depth === top) {
    return { face: "top", x, y: rect.y0 - BALL_R, vx, vy: vy > 0 ? -vy : vy };
  }
  return { face: "bottom", x, y: rect.y1 + BALL_R, vx, vy: vy < 0 ? -vy : vy };
}
