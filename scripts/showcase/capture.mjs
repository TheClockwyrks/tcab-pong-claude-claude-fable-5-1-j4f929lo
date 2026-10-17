/* global process, URL, window, console, Buffer */
// Captures the showcase media into `showcase/`: screenshots of the running
// game and a gzipped replay of a rally, both taken from the real build served
// by the Vite dev server (`npm run dev`) at the harness page.
//
//   node scripts/showcase/capture.mjs [http://localhost:5173]

import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const out = new URL("../../showcase/", import.meta.url);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
await page.goto(`${base}/scripts/showcase/harness.html`);
await page.evaluate(() => window.carom.ready);

/** Run `script` inside the page with the engine and its debug surface in scope. */
const drive = (script, arg) =>
  page.evaluate(
    async ([body, value]) => {
      const { engine } = window.carom;
      const debug = engine.debug;
      const pose = (fn) => engine.apply((s) => fn(debug, s));
      const snap = () => debug.snapshot(engine.state);
      const fn = new Function(
        "engine",
        "debug",
        "pose",
        "snap",
        "arg",
        `return (async () => { ${body} })();`,
      );
      return fn(engine, debug, pose, snap, value);
    },
    [script, arg ?? null],
  );

const shoot = async (name) => {
  const buffer = await page.locator("#stage").screenshot({ type: "png" });
  writeFileSync(new URL(name, out), buffer);
  console.log("wrote", name);
};

// A rally with both paddles under the script's control. Each paddle tracks the
// ball and swipes through the contact to put spin on it, so the flight curves
// and banks off the obstacles. Runs `frames` frames and returns what happened.
const RALLY = `
  const { AI, frames, record, shots } = arg;
  const R = 11, H = 720;
  // Where the ball's y will be after eta seconds, reflecting off the walls.
  const arrivalY = (y, vy, eta) => {
    let py = y + vy * eta;
    const span = H - 2 * R;
    py = ((py - R) % (2 * span) + 2 * span) % (2 * span);
    return (py > span ? 2 * span - py : py) + R;
  };
  if (record) engine.startRecording();
  for (let i = 0; i < frames; i++) {
    const s = snap();
    if (s.screen === "playing" && s.ball && !s.ball.held) {
      const ball = s.ball;
      for (const side of ["left", "right"]) {
        const paddle = s.paddles[side];
        const toward = side === "left" ? ball.vx < 0 : ball.vx > 0;
        const faceX = side === "left" ? 75 : 1205;
        const eta = toward ? Math.abs((ball.x - faceX) / ball.vx) : 9;
        const aim = AI[side] * 22;
        const target = toward ? arrivalY(ball.y, ball.vy, eta) - aim : 360;
        const diff = target - paddle.cy;
        let vy = Math.abs(diff) < 4 ? 0 : Math.sign(diff) * Math.min(700, Math.abs(diff) * 60);
        // Swipe through the contact for spin: a short, firm stroke.
        if (toward && eta < 0.07) vy = AI[side] * 420;
        pose((d, st) => d.setPaddleVy(st, side, vy));
      }
    }
    await engine.advance(1);
    const after = snap();
    if (shots && after.ball && after.screen === "playing") {
      const b = after.ball;
      if (Math.abs(b.spin) > 150 && b.x > 330 && b.x < 950 && b.trail.length > 6 && b.speed > 600) {
        return { frame: i, snap: after };
      }
    }
  }
  const rec = record ? engine.stopRecording() : null;
  return { frames: rec ? rec.frames.length : 0, recording: rec, snap: snap() };
`;

const SETUP = `
  pose((d, s) => d.reset(s));
  pose((d, s) => d.setMode(s, "versus"));
  pose((d, s) => d.setScreen(s, "countdown"));
  pose((d, s) => d.setPaddleDriven(s, "left", true));
  pose((d, s) => d.setPaddleDriven(s, "right", true));
  pose((d, s) => d.setBallServeSign(s, 1));
  pose((d, s) => d.setBallHoldTimer(s, 0.001));
  pose((d, s) => d.setScore(s, 6, 5));
  await engine.advance(1);
`;

// 1. The title screen.
await drive(`pose((d, s) => d.reset(s)); await engine.advance(2);`);
await shoot("title.png");

// 2. A live rally, caught mid-curve.
await drive(SETUP);
const shot = await drive(RALLY, {
  AI: { left: 1, right: -1 },
  frames: 1500,
  shots: true,
});
console.log("rally shot at frame", shot.frame, "spin", shot.snap?.ball?.spin);
await shoot("rally.png");

// 3. The replay: a few seconds of a fresh rally.
await drive(SETUP);
await drive(RALLY, { AI: { left: 1, right: -1 }, frames: 30, shots: false });
const replay = await drive(RALLY, {
  AI: { left: -1, right: 1 },
  frames: 420,
  record: true,
  shots: false,
});
console.log(
  "recorded",
  replay.frames,
  "frames; final",
  JSON.stringify(replay.snap.score),
  replay.snap.screen,
);
const json = JSON.stringify(replay.recording);
writeFileSync(
  new URL("rally.json.gz", out),
  gzipSync(Buffer.from(json), { level: 9 }),
);
console.log("wrote rally.json.gz", json.length, "bytes raw");

await browser.close();
