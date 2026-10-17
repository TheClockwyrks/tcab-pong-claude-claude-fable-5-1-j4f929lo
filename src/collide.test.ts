import { describe, expect, it } from "vitest";
import { BALL_R, type Rect } from "./constants";
import { resolveCircleRect } from "./collide";

const rect: Rect = { x0: 100, y0: 100, x1: 120, y1: 240 };

describe("resolveCircleRect", () => {
  it("reports no contact when the center is outside the expanded rectangle", () => {
    expect(resolveCircleRect(100 - BALL_R, 170, 300, 0, rect)).toBeNull();
    expect(resolveCircleRect(50, 170, 300, 0, rect)).toBeNull();
    expect(resolveCircleRect(110, 100 - BALL_R, 0, 300, rect)).toBeNull();
  });

  it("strikes the left face, places the ball off it, and reverses an inward vx", () => {
    const contact = resolveCircleRect(100 - BALL_R + 2, 170, 300, 40, rect);
    expect(contact).toEqual({
      face: "left",
      x: 100 - BALL_R,
      y: 170,
      vx: -300,
      vy: 40,
    });
  });

  it("leaves a velocity that already points away from the face alone", () => {
    const contact = resolveCircleRect(100 - BALL_R + 2, 170, -300, 40, rect);
    expect(contact?.vx).toBe(-300);
  });

  it("strikes the right face", () => {
    const contact = resolveCircleRect(120 + BALL_R - 3, 170, -200, 0, rect);
    expect(contact).toMatchObject({ face: "right", x: 120 + BALL_R, vx: 200 });
  });

  it("strikes the top and bottom faces, reversing vy only when it points in", () => {
    const top = resolveCircleRect(110, 100 - BALL_R + 1, 50, 200, rect);
    expect(top).toMatchObject({
      face: "top",
      y: 100 - BALL_R,
      vx: 50,
      vy: -200,
    });
    const bottom = resolveCircleRect(110, 240 + BALL_R - 1, 50, -200, rect);
    expect(bottom).toMatchObject({ face: "bottom", y: 240 + BALL_R, vy: 200 });
    const away = resolveCircleRect(110, 240 + BALL_R - 1, 50, 200, rect);
    expect(away?.vy).toBe(200);
  });

  it("breaks a tie in the order left, right, top, bottom", () => {
    // Equal penetration on the left and top faces: left wins.
    const corner = resolveCircleRect(
      100 - BALL_R + 4,
      100 - BALL_R + 4,
      10,
      10,
      rect,
    );
    expect(corner?.face).toBe("left");
    // Equal on the right and bottom faces: right wins.
    const other = resolveCircleRect(
      120 + BALL_R - 4,
      240 + BALL_R - 4,
      -10,
      -10,
      rect,
    );
    expect(other?.face).toBe("right");
  });
});
