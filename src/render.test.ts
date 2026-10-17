import { describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import {
  FIELD_CX,
  FIELD_CY,
  FIELD_H,
  FIELD_W,
  OBSTACLE_CENTERS,
  P1_X0,
  P2_X0,
} from "./constants";
import { BACKGROUND, type CaromState, type Screen } from "./game";
import { startMatch, titleState } from "./match";
import {
  COLORS,
  HOWTO_LINES,
  modeLabel,
  renderFrame,
  winnerLabel,
} from "./render";

function hex(color: string): readonly number[] {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
}

function draw(state: CaromState): (x: number, y: number) => readonly number[] {
  const canvas = createCanvas(FIELD_W, FIELD_H);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  renderFrame(state, ctx);
  return (x, y) =>
    Array.from(canvas.getContext("2d").getImageData(x, y, 1, 1).data).slice(
      0,
      3,
    );
}

function playing(): CaromState {
  const state = startMatch(titleState(false), "versus");
  if (state.ball === null) throw new Error("no ball");
  return {
    ...state,
    screen: "playing",
    ball: {
      ...state.ball,
      held: false,
      x: 400,
      y: 300,
      vx: 500,
      vy: 100,
      spin: 400,
      trail: [
        { x: 340, y: 288, t: 0.9 },
        { x: 370, y: 294, t: 0.95 },
        { x: 400, y: 300, t: 1 },
      ],
    },
  };
}

describe("renderFrame", () => {
  it("draws every screen without throwing", () => {
    const screens: Screen[] = [
      "title",
      "howto",
      "countdown",
      "playing",
      "paused",
      "matchover",
    ];
    for (const screen of screens) {
      expect(() =>
        draw({ ...playing(), screen, winner: "right" }),
      ).not.toThrow();
    }
    expect(() =>
      draw({ ...playing(), screen: "matchover", winner: "left" }),
    ).not.toThrow();
    expect(() =>
      draw({ ...playing(), screen: "matchover", winner: null }),
    ).not.toThrow();
    expect(() =>
      draw({ ...playing(), ball: null, obstacles: [], muted: true }),
    ).not.toThrow();
    expect(() =>
      draw({ ...playing(), screen: "countdown", ball: null }),
    ).not.toThrow();
  });

  it("paints the paddles, the ball, and the obstacles in their own colors", () => {
    const state = playing();
    const at = draw(state);
    expect(at(P1_X0 + 8, FIELD_CY)).toEqual(hex(COLORS.left));
    expect(at(P2_X0 + 8, FIELD_CY)).toEqual(hex(COLORS.right));
    expect(at(400, 300)).toEqual(hex(COLORS.ball));
    expect(at(OBSTACLE_CENTERS[0].x, OBSTACLE_CENTERS[0].y)).toEqual(
      hex(COLORS.obstacle),
    );
    expect(at(OBSTACLE_CENTERS[1].x, OBSTACLE_CENTERS[1].y)).toEqual(
      hex(COLORS.obstacle),
    );
    expect(at(200, 600)).toEqual(hex(BACKGROUND));
  });

  it("draws the trail behind a moving ball", () => {
    const at = draw(playing());
    const onTrail = at(355, 291);
    expect(onTrail).not.toEqual(hex(BACKGROUND));
    const still = {
      ...playing(),
      ball: {
        ...(playing().ball as NonNullable<CaromState["ball"]>),
        trail: [],
      },
    };
    expect(draw(still)(355, 291)).toEqual(hex(BACKGROUND));
  });

  it("highlights the selected menu item on the title", () => {
    const state = { ...titleState(false), menuIndex: 1 };
    const at = draw(state);
    expect(at(FIELD_CX - 170, 420 + 70)).toEqual(hex(COLORS.highlight));
    expect(at(FIELD_CX - 170, 420)).not.toEqual(hex(COLORS.highlight));
  });

  it("names the mode and the winner", () => {
    expect(modeLabel({ ...titleState(false), mode: "solo" })).toContain("SOLO");
    expect(modeLabel({ ...titleState(false), mode: "versus" })).toContain(
      "VERSUS",
    );
    expect(winnerLabel({ ...titleState(false), winner: "left" })).toContain(
      "ONE",
    );
    expect(
      winnerLabel({ ...titleState(false), winner: "right", mode: "versus" }),
    ).toContain("TWO");
    expect(
      winnerLabel({ ...titleState(false), winner: "right", mode: "solo" }),
    ).toContain("MACHINE");
    expect(winnerLabel(titleState(false))).toBe("MATCH OVER");
    expect(HOWTO_LINES.join(" ")).toMatch(/SPIN/);
    expect(HOWTO_LINES.join(" ")).toMatch(/BANK/);
  });
});
