// Engine-level scenarios: the real engine stepping the real game headlessly.

import { afterEach, describe, expect, it } from "vitest";
import { ConstantClock, TOUCH_LAYOUTS } from "@clockwyrks/simple-2d";
import {
  ACTIONS,
  BALL_R,
  CUES,
  FIELD_CX,
  FIELD_CY,
  FIELD_W,
  HOLD_TIME,
  LAYOUT,
  PADDLE_HALF,
  SERVE_ANGLE,
  P1_X1,
  P2_X0,
  PADDLE_SPEED,
  SPEED_CAP,
  WIN_SCORE,
} from "./constants";
import { BACKGROUND } from "./game";
import { createHarness, framesFor, type Harness } from "./testing/harness";

const live: Harness[] = [];

async function harness(stepMs?: number): Promise<Harness> {
  const h = await createHarness(
    stepMs === undefined ? undefined : new ConstantClock(stepMs),
  );
  live.push(h);
  return h;
}

afterEach(() => {
  for (const h of live.splice(0)) h.destroy();
});

describe("initialize", () => {
  it("opens on the title with the layout's vocabulary registered", async () => {
    const h = await harness();
    expect(h.snapshot()).toMatchObject({
      version: 1,
      screen: "title",
      mode: "solo",
      muted: false,
      simTime: 0,
    });
    expect([...ACTIONS]).toEqual(TOUCH_LAYOUTS[LAYOUT].actions);
    expect(BACKGROUND).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("registers diagnostic sources that read the current state", async () => {
    const h = await harness();
    const names = h.engine.diagnostics().map((d) => d.name);
    for (const name of [
      "screen",
      "mode",
      "score",
      "ball pos",
      "ball vel",
      "ball speed",
      "ball spin",
      "left paddle",
      "right paddle",
    ]) {
      expect(names).toContain(name);
    }
    h.pose((s) => h.debug.setBallVelocity(s, 3, 4));
    h.pose((s) => h.debug.setPaddleDriven(s, "left", true));
    const readings = Object.fromEntries(
      h.engine.diagnostics().map((d) => [d.name, d.value]),
    );
    expect(readings["ball speed"]).toBe("5.0");
    expect(readings["left paddle"]).toContain("driven");
    h.pose((s) => h.debug.clearWorld(s));
    const cleared = Object.fromEntries(
      h.engine.diagnostics().map((d) => [d.name, d.value]),
    );
    expect(cleared["ball pos"]).toBe("-");
    expect(h.engine.diagnostics().every((d) => d.error === undefined)).toBe(
      true,
    );
  });
});

describe("the keyboard", () => {
  it("starts a solo match from the title with Enter and pauses with P", async () => {
    const h = await harness();
    h.tap("Enter");
    await h.advance(1);
    expect(h.snapshot()).toMatchObject({
      screen: "countdown",
      mode: "solo",
      titleIndex: 0,
    });
    h.tap("KeyP");
    await h.advance(1);
    expect(h.snapshot()).toMatchObject({
      screen: "paused",
      resumeScreen: "countdown",
      menuIndex: 0,
    });
    h.tap("KeyP");
    await h.advance(1);
    expect(h.snapshot().screen).toBe("countdown");
  });

  it("opens and leaves the pause menu on a single Escape each", async () => {
    const h = await harness();
    h.tap("Space");
    await h.advance(1);
    h.tap("Escape");
    await h.advance(1);
    expect(h.snapshot().screen).toBe("paused");
    await h.advance(3);
    expect(h.snapshot().screen).toBe("paused");
    h.tap("Escape");
    await h.advance(1);
    expect(h.snapshot().screen).toBe("countdown");
  });

  it("moves the title selection with either player's keys and remembers it", async () => {
    const h = await harness();
    h.tap("ArrowDown");
    await h.advance(1);
    expect(h.snapshot().menuIndex).toBe(1);
    h.tap("KeyS");
    await h.advance(1);
    expect(h.snapshot().menuIndex).toBe(2);
    h.tap("Enter");
    await h.advance(1);
    expect(h.snapshot()).toMatchObject({
      screen: "howto",
      menuIndex: 0,
      titleIndex: 2,
    });
    h.tap("Escape");
    await h.advance(1);
    expect(h.snapshot()).toMatchObject({
      screen: "title",
      menuIndex: 2,
      titleIndex: 2,
    });
  });

  it("moves the paddles while a key is held", async () => {
    const h = await harness();
    h.pose((s) => h.debug.setMode(s, "versus"));
    h.pose((s) => h.debug.setScreen(s, "playing"));
    h.keyDown("KeyW");
    h.keyDown("ArrowDown");
    await h.advance(6);
    const after = h.snapshot();
    expect(after.paddles.left.cy).toBeCloseTo(FIELD_CY - PADDLE_SPEED * 0.1, 3);
    expect(after.paddles.left.vy).toBe(-PADDLE_SPEED);
    expect(after.paddles.right.cy).toBeCloseTo(
      FIELD_CY + PADDLE_SPEED * 0.1,
      3,
    );
    h.keyUp("KeyW");
    h.keyUp("ArrowDown");
    await h.advance(1);
    expect(h.snapshot().paddles.left.vy).toBe(0);
  });

  it("toggles the mute bit from any screen and mirrors it", async () => {
    const h = await harness();
    h.tap("KeyM");
    await h.advance(1);
    expect(h.snapshot().muted).toBe(true);
    h.tap("Enter");
    await h.advance(1);
    h.tap("KeyM");
    await h.advance(1);
    expect(h.snapshot()).toMatchObject({ screen: "countdown", muted: false });
  });

  it("lets a pose set the mute bit the runtime then follows", async () => {
    const h = await harness();
    h.pose((s) => h.debug.setMuted(s, true));
    expect(h.snapshot().muted).toBe(true);
    const gains: number[] = [];
    h.engine.events.on("cue:played", (e) => gains.push(e.gain));
    h.pose((s) => h.debug.setScreen(s, "playing"));
    h.pose((s) => h.debug.setBallPosition(s, FIELD_W - 2, 300));
    h.pose((s) => h.debug.setBallVelocity(s, 900, 0));
    await h.advance(1);
    expect(h.snapshot().muted).toBe(true);
    expect(gains).toEqual([0]);
    h.tap("KeyM");
    await h.advance(1);
    expect(h.snapshot().muted).toBe(false);
  });
});

describe("the pointer", () => {
  it("confirms a menu item with a press and release inside its region", async () => {
    const h = await harness();
    const rect = h.debug.menuItemRect(h.state, 1);
    expect(rect).not.toBeNull();
    if (rect === null) return;
    h.pointer("pointermove", rect.x + 10, rect.y + 10);
    await h.advance(1);
    expect(h.snapshot().menuIndex).toBe(1);
    h.pointer("pointerdown", rect.x + 10, rect.y + 10);
    await h.advance(2);
    h.pointer("pointerup", rect.x + rect.w - 5, rect.y + rect.h - 5);
    await h.advance(1);
    expect(h.snapshot()).toMatchObject({
      screen: "countdown",
      mode: "versus",
      titleIndex: 1,
    });
  });

  it("confirms nothing when the release lands outside the press's region", async () => {
    const h = await harness();
    const a = h.debug.menuItemRect(h.state, 0);
    const b = h.debug.menuItemRect(h.state, 2);
    if (a === null || b === null) throw new Error("no rects");
    h.pointer("pointerdown", a.x + 5, a.y + 5);
    await h.advance(1);
    h.pointer("pointermove", b.x + 5, b.y + 5);
    h.pointer("pointerup", b.x + 5, b.y + 5);
    await h.advance(1);
    expect(h.snapshot()).toMatchObject({ screen: "title", menuIndex: 2 });
  });

  it("drives the pause menu with a touch tap", async () => {
    const h = await harness();
    h.tap("Enter");
    await h.advance(1);
    h.tap("KeyP");
    await h.advance(1);
    const quit = h.debug.menuItemRect(h.state, 2);
    if (quit === null) throw new Error("no rect");
    h.pointer("pointerdown", quit.x + 20, quit.y + 20, {
      device: "touch",
      id: 11,
    });
    await h.advance(2);
    h.pointer("pointerup", quit.x + 20, quit.y + 20, {
      device: "touch",
      id: 11,
    });
    await h.advance(1);
    expect(h.snapshot().screen).toBe("title");
  });
});

describe("a match", () => {
  it("serves after the hold, the AI returns it, and cues play on their frames", async () => {
    const h = await harness();
    h.tap("Enter");
    await h.advance(1);
    // The serve leaves at SERVE_ANGLE toward the left paddle: park that paddle
    // where the ball arrives so a stationary paddle returns it straight.
    h.pose((s) => h.debug.setBallServeSign(s, 1));
    h.pose((s) => h.debug.setPaddleDriven(s, "left", true));
    // Offsetting the paddle a little sends the return up at -15 degrees,
    // between obstacle A and obstacle B, so the AI gets to meet it.
    const arrival =
      FIELD_CY + (FIELD_CX - P1_X1 - BALL_R) * Math.tan(SERVE_ANGLE);
    const offset = (PADDLE_HALF * 15) / 55;
    h.pose((s) => h.debug.setPaddleCy(s, "left", arrival + offset));
    await h.advance(framesFor(HOLD_TIME));
    expect(h.snapshot().screen).toBe("playing");
    expect(h.snapshot().ball?.held).toBe(false);
    await h.advance(framesFor(3.8));
    expect(
      h.cues.filter((c) => c === CUES.paddleHit).length,
    ).toBeGreaterThanOrEqual(2);
    expect(h.cues).not.toContain(CUES.obstacleBounce);
    const snap = h.snapshot();
    expect(snap.score).toEqual({ p1: 0, p2: 0 });
    expect(snap.ball?.trail.length).toBeGreaterThan(1);
    expect(snap.paddles.right.cy).not.toBe(FIELD_CY);
  });

  it("scores, re-serves toward the side scored on, and ends on the win rule", async () => {
    const h = await harness();
    h.pose((s) => h.debug.setMode(s, "versus"));
    h.pose((s) => h.debug.setScreen(s, "playing"));
    h.pose((s) => h.debug.setScore(s, WIN_SCORE - 1, 0));
    h.pose((s) => h.debug.setBallHeld(s, false));
    h.pose((s) => h.debug.setBallPosition(s, FIELD_W - BALL_R - 20, 200));
    h.pose((s) => h.debug.setBallVelocity(s, 900, 0));
    await h.advance(3);
    expect(h.cues.filter((c) => c === CUES.score)).toHaveLength(1);
    expect(h.snapshot()).toMatchObject({
      screen: "matchover",
      winner: "left",
      score: { p1: WIN_SCORE, p2: 0 },
      menuIndex: 0,
    });
    h.tap("Enter");
    await h.advance(1);
    expect(h.snapshot()).toMatchObject({
      screen: "countdown",
      mode: "versus",
      score: { p1: 0, p2: 0 },
      winner: null,
      receiver: "left",
    });
  });

  it("a point short of the win parks the ball and serves toward the loser", async () => {
    const h = await harness();
    h.pose((s) => h.debug.setMode(s, "versus"));
    h.pose((s) => h.debug.setScreen(s, "playing"));
    h.pose((s) => h.debug.setBallHeld(s, false));
    h.pose((s) => h.debug.setBallPosition(s, BALL_R + 20, 500));
    h.pose((s) => h.debug.setBallVelocity(s, -900, 0));
    await h.advance(3);
    const snap = h.snapshot();
    expect(snap).toMatchObject({
      screen: "countdown",
      receiver: "left",
      score: { p1: 0, p2: 1 },
    });
    expect(snap.ball).toMatchObject({
      x: FIELD_CX,
      y: FIELD_CY,
      held: true,
      vx: 0,
      vy: 0,
    });
    await h.advance(framesFor(HOLD_TIME) + 1);
    expect(h.snapshot().screen).toBe("playing");
    expect(h.snapshot().ball?.vx).toBeLessThan(0);
  });

  it("serves on the frame a posed hold timer of zero is advanced", async () => {
    const h = await harness();
    h.pose((s) => h.debug.setScreen(s, "countdown"));
    h.pose((s) => h.debug.setBallServeSign(s, -1));
    h.pose((s) => h.debug.setBallHoldTimer(s, 0));
    await h.advance(1);
    const ball = h.snapshot().ball;
    expect(h.snapshot().screen).toBe("playing");
    expect(ball?.vy).toBeLessThan(0);
    expect(ball?.serveSign).toBe(-1);
  });

  it("keeps the paddles, the ball, and the timer frozen while paused", async () => {
    const h = await harness();
    h.tap("Enter");
    await h.advance(5);
    const before = h.snapshot();
    h.tap("KeyP");
    await h.advance(1);
    h.keyDown("KeyW");
    await h.advance(10);
    const during = h.snapshot();
    expect(during.ball?.holdTimer).toBe(before.ball?.holdTimer);
    expect(during.paddles).toEqual(before.paddles);
    expect(during.simTime).toBeGreaterThan(before.simTime);
  });

  it("leaves an absent ball out of the frame and a cleared field empty", async () => {
    const h = await harness();
    h.pose((s) => h.debug.setScreen(s, "playing"));
    h.pose((s) => h.debug.clearWorld(s));
    await h.advance(30);
    expect(h.snapshot()).toMatchObject({
      ball: null,
      obstacles: [],
      screen: "playing",
      score: { p1: 0, p2: 0 },
    });
    expect(h.cues).toEqual([]);
    h.pose((s) => h.debug.spawnBall(s));
    h.pose((s) => h.debug.spawnObstacle(s, 0));
    expect(h.snapshot().obstacles.map((o) => o.index)).toEqual([0]);
  });

  it("bounces the ball off an obstacle with the obstacle cue", async () => {
    const h = await harness();
    h.pose((s) => h.debug.setScreen(s, "playing"));
    h.pose((s) => h.debug.setBallHeld(s, false));
    h.pose((s) => h.debug.setBallPosition(s, 440, 220));
    h.pose((s) => h.debug.setBallVelocity(s, 600, 0));
    await h.advance(6);
    expect(h.cues).toContain(CUES.obstacleBounce);
    expect(h.snapshot().ball?.vx).toBeLessThan(0);
  });
});

/** The same rally under one step size, read back as what happened. */
async function rally(stepMs: number): Promise<{
  hits: number;
  walls: number;
  score: { p1: number; p2: number };
  speed: number;
  vx: number;
  vy: number;
  time: number;
}> {
  const h = await harness(stepMs);
  h.pose((s) => h.debug.setMode(s, "versus"));
  h.pose((s) => h.debug.setScreen(s, "playing"));
  h.pose((s) => h.debug.setPaddleDriven(s, "left", true));
  h.pose((s) => h.debug.setPaddleDriven(s, "right", true));
  h.pose((s) => h.debug.setPaddleCy(s, "left", 320));
  h.pose((s) => h.debug.setPaddleCy(s, "right", 400));
  h.pose((s) => h.debug.setBallHeld(s, false));
  h.pose((s) => h.debug.setBallPosition(s, 640, 360));
  h.pose((s) => h.debug.setBallVelocity(s, -600, 40));
  h.pose((s) => h.debug.setBallSpin(s, 300));
  const start = h.snapshot().simTime;
  let last = h.snapshot();
  while (last.screen === "playing" && last.simTime - start < 6) {
    await h.advance(1);
    last = h.snapshot();
  }
  const ball = last.ball;
  return {
    hits: h.cues.filter((c) => c === CUES.paddleHit).length,
    walls: h.cues.filter((c) => c === CUES.wallBounce).length,
    score: last.score,
    speed: ball?.speed ?? 0,
    vx: ball?.vx ?? 0,
    vy: ball?.vy ?? 0,
    time: last.simTime - start,
  };
}

describe("delta-time independence", () => {
  it("plays the same rally out under 2 ms and 16 ms frames", async () => {
    const fine = await rally(2);
    const coarse = await rally(16);
    expect(coarse.hits).toBe(fine.hits);
    expect(coarse.walls).toBe(fine.walls);
    expect(coarse.score).toEqual(fine.score);
    expect(Math.abs(coarse.speed - fine.speed)).toBeLessThan(10);
    expect(Math.sign(coarse.vx)).toBe(Math.sign(fine.vx));
    expect(Math.abs(coarse.time - fine.time) / fine.time).toBeLessThan(0.08);
    expect(fine.hits).toBeGreaterThan(0);
  });
});

describe("the ball stays on the field", () => {
  it("never leaves the walls or enters a paddle at the speed cap", async () => {
    const h = await harness(16);
    h.pose((s) => h.debug.setMode(s, "versus"));
    h.pose((s) => h.debug.setScreen(s, "playing"));
    h.pose((s) => h.debug.setPaddleDriven(s, "left", true));
    h.pose((s) => h.debug.setPaddleDriven(s, "right", true));
    h.pose((s) => h.debug.setBallHeld(s, false));
    h.pose((s) =>
      h.debug.setBallVelocity(
        s,
        SPEED_CAP * Math.cos(0.9),
        SPEED_CAP * Math.sin(0.9),
      ),
    );
    for (let i = 0; i < 240 && h.snapshot().screen === "playing"; i++) {
      await h.advance(1);
      const ball = h.snapshot().ball;
      if (ball === null) throw new Error("no ball");
      expect(ball.y).toBeGreaterThanOrEqual(BALL_R - 1e-6);
      expect(ball.y).toBeLessThanOrEqual(720 - BALL_R + 1e-6);
      const paddles = h.snapshot().paddles;
      const besideLeft =
        Math.abs(ball.y - paddles.left.cy) < PADDLE_HALF + BALL_R;
      const besideRight =
        Math.abs(ball.y - paddles.right.cy) < PADDLE_HALF + BALL_R;
      if (
        ball.x > P1_X1 - 8 &&
        ball.x < P2_X0 + 8 &&
        besideLeft &&
        besideRight
      ) {
        expect(ball.x).toBeGreaterThanOrEqual(P1_X1 + BALL_R - 1e-6);
        expect(ball.x).toBeLessThanOrEqual(P2_X0 - BALL_R + 1e-6);
      }
      expect(ball.speed).toBeLessThanOrEqual(SPEED_CAP + 1e-6);
    }
  });
});

describe("rendering through the engine", () => {
  it("draws the field each frame and records its draw commands", async () => {
    const h = await harness();
    h.tap("Enter");
    await h.advance(1);
    expect(h.pixel(P1_X1 - 8, FIELD_CY).slice(0, 3)).toEqual([
      0x45, 0xe0, 0xff,
    ]);
    h.engine.startRecording();
    await h.advance(2);
    const recording = h.engine.stopRecording();
    expect(recording.frames).toHaveLength(2);
    expect(
      recording.ops.some((op) => op.op === "call" && op.method === "fillText"),
    ).toBe(true);
  });
});
