// Drawing (specs/overview.md, specs/ui.md). Everything is drawn in logical
// units through the context the engine prepared; nothing here touches the
// state or the canvas element.

import {
  BALL_R,
  FIELD_CX,
  FIELD_CY,
  FIELD_H,
  FIELD_W,
  NET_X,
  OBSTACLE_H,
  OBSTACLE_W,
  P1_X0,
  P2_X0,
  PADDLE_H,
  PADDLE_HALF,
  PADDLE_W,
  SPIN_CLAMP,
  TITLE_TEXT,
  WIN_LEAD,
  WIN_SCORE,
} from "./constants";
import type { CaromView, MenuRect, Screen, Side } from "./game";
import { menuItemRect, menuItems } from "./menus";

// ---- Palette -------------------------------------------------------------

export const COLORS = {
  text: "#eef1ff",
  dim: "#8c95bd",
  net: "#2f3b63",
  edge: "#1a2242",
  left: "#45e0ff",
  right: "#ff7a59",
  ball: "#ffe66d",
  obstacle: "#b06bff",
  highlight: "#ffe66d",
  highlightText: "#161a2e",
  overlay: "rgba(8, 11, 24, 0.66)",
} as const;

const FONT_FAMILY =
  "'Segoe UI', 'Helvetica Neue', system-ui, 'DejaVu Sans', sans-serif";

function font(size: number, weight = 700): string {
  return `${String(weight)} ${String(size)}px ${FONT_FAMILY}`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function text(
  ctx: CanvasRenderingContext2D,
  copy: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "center",
  weight = 700,
): void {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(copy, x, y);
}

// ---- The field -----------------------------------------------------------

function drawNet(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = COLORS.net;
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 16]);
  ctx.beginPath();
  ctx.moveTo(NET_X, 8);
  ctx.lineTo(NET_X, FIELD_H - 8);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, FIELD_W - 2, FIELD_H - 2);
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.save();
  ctx.globalAlpha *= 0.18;
  ctx.fillStyle = color;
  roundedRect(ctx, x - 6, y - 6, w + 12, h + 12, r + 6);
  ctx.fill();
  ctx.restore();
}

function drawPaddle(
  ctx: CanvasRenderingContext2D,
  side: Side,
  cy: number,
): void {
  const x = side === "left" ? P1_X0 : P2_X0;
  const y = cy - PADDLE_HALF;
  const color = side === "left" ? COLORS.left : COLORS.right;
  drawGlow(ctx, color, x, y, PADDLE_W, PADDLE_H, 8);
  ctx.fillStyle = color;
  roundedRect(ctx, x, y, PADDLE_W, PADDLE_H, 8);
  ctx.fill();
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
): void {
  const x = cx - OBSTACLE_W / 2;
  const y = cy - OBSTACLE_H / 2;
  drawGlow(ctx, COLORS.obstacle, x, y, OBSTACLE_W, OBSTACLE_H, 10);
  ctx.fillStyle = COLORS.obstacle;
  roundedRect(ctx, x, y, OBSTACLE_W, OBSTACLE_H, 10);
  ctx.fill();
}

function drawTrail(ctx: CanvasRenderingContext2D, state: CaromView): void {
  const ball = state.ball;
  if (ball === null || ball.trail.length < 2) return;
  const samples = ball.trail;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = COLORS.ball;
  const last = samples.length - 1;
  for (let i = 1; i <= last; i++) {
    const from = samples[i - 1];
    const to = samples[i];
    const fade = i / last;
    ctx.globalAlpha = 0.05 + 0.45 * fade;
    ctx.lineWidth = 2 + (BALL_R * 2 - 4) * fade;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, state: CaromView): void {
  const ball = state.ball;
  if (ball === null) return;
  drawTrail(ctx, state);

  ctx.save();
  ctx.globalAlpha *= 0.22;
  ctx.fillStyle = COLORS.ball;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R + 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = COLORS.ball;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();

  // A ring arc whose length follows the spin's magnitude and whose direction
  // follows its sign, so a curving ball reads as curving.
  const amount = Math.min(1, Math.abs(ball.spin) / SPIN_CLAMP);
  if (amount > 0.02) {
    ctx.save();
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha *= 0.85;
    ctx.beginPath();
    const sweep = amount * Math.PI * 1.6;
    const start = -Math.PI / 2;
    ctx.arc(ball.x, ball.y, BALL_R + 5, start, start + sweep, ball.spin < 0);
    ctx.stroke();
    ctx.restore();
  }
}

/** The field and everything on it, at the current global alpha. */
function drawField(ctx: CanvasRenderingContext2D, state: CaromView): void {
  drawNet(ctx);
  for (const obstacle of state.obstacles) {
    drawObstacle(ctx, obstacle.cx, obstacle.cy);
  }
  drawPaddle(ctx, "left", state.paddles.left.cy);
  drawPaddle(ctx, "right", state.paddles.right.cy);
  drawBall(ctx, state);
}

// ---- Match chrome --------------------------------------------------------

export function modeLabel(state: CaromView): string {
  return state.mode === "solo"
    ? "SOLO  ·  YOU vs THE MACHINE"
    : "VERSUS  ·  P1 vs P2";
}

function drawScores(ctx: CanvasRenderingContext2D, state: CaromView): void {
  text(
    ctx,
    String(state.score.p1),
    FIELD_CX - 70,
    64,
    64,
    COLORS.left,
    "right",
  );
  text(
    ctx,
    String(state.score.p2),
    FIELD_CX + 70,
    64,
    64,
    COLORS.right,
    "left",
  );
  text(
    ctx,
    modeLabel(state),
    FIELD_CX,
    FIELD_H - 24,
    18,
    COLORS.dim,
    "center",
    600,
  );
  if (state.muted)
    text(ctx, "MUTED", FIELD_W - 24, 24, 16, COLORS.dim, "right", 600);
}

function drawCountdown(ctx: CanvasRenderingContext2D, state: CaromView): void {
  const ball = state.ball;
  if (ball === null) return;
  const toward = state.receiver === "left" ? "P1" : "P2";
  text(
    ctx,
    `SERVING TO ${toward}`,
    FIELD_CX,
    FIELD_CY - 96,
    22,
    COLORS.dim,
    "center",
    600,
  );
  const remaining = Math.max(0, ball.holdTimer);
  const count = Math.max(1, Math.ceil(remaining));
  ctx.save();
  ctx.globalAlpha = 0.25 + 0.75 * (remaining - Math.floor(remaining) || 1);
  text(ctx, String(count), FIELD_CX, FIELD_CY - 50, 56, COLORS.text);
  ctx.restore();
}

// ---- Menus ---------------------------------------------------------------

function drawMenu(ctx: CanvasRenderingContext2D, state: CaromView): void {
  const items = menuItems(state.screen);
  if (items === null) return;
  items.forEach((item, index) => {
    const rect: MenuRect | null = menuItemRect(state.screen, index);
    if (rect === null) return;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    if (index === state.menuIndex) {
      ctx.fillStyle = COLORS.highlight;
      roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2);
      ctx.fill();
      text(ctx, item, cx, cy, 26, COLORS.highlightText);
    } else {
      ctx.strokeStyle = COLORS.net;
      ctx.lineWidth = 2;
      roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2);
      ctx.stroke();
      text(ctx, item, cx, cy, 26, COLORS.text, "center", 600);
    }
  });
}

function dimField(
  ctx: CanvasRenderingContext2D,
  state: CaromView,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  drawField(ctx, state);
  ctx.restore();
  ctx.fillStyle = COLORS.overlay;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
}

function drawTitle(ctx: CanvasRenderingContext2D, state: CaromView): void {
  dimField(ctx, state, 0.45);
  text(ctx, TITLE_TEXT, FIELD_CX, 210, 128, COLORS.text, "center", 800);
  text(
    ctx,
    "A TOP-DOWN PADDLE DUEL WITH SPIN AND BANK SHOTS",
    FIELD_CX,
    296,
    20,
    COLORS.dim,
    "center",
    600,
  );
  drawMenu(ctx, state);
  text(
    ctx,
    "W / S  AND  ↑ / ↓  MOVE   ·   ENTER CONFIRMS   ·   M MUTES",
    FIELD_CX,
    FIELD_H - 36,
    16,
    COLORS.dim,
    "center",
    600,
  );
}

export const HOWTO_LINES: readonly string[] = [
  "PLAYER ONE moves the left paddle with W and S.",
  "PLAYER TWO moves the right paddle with the UP and DOWN arrows.",
  "ENTER or SPACE confirms, ESCAPE backs out, P pauses, M mutes.",
  "",
  "SPIN: strike the ball while your paddle is moving and its flight curves.",
  "Moving down bends it clockwise, moving up the other way; spin fades out.",
  "",
  "BANK SHOTS: two bars stand mid-field. The ball ricochets off them with its",
  "spin intact, so a curving ball can bank around the other paddle.",
  "",
  `First to ${String(WIN_SCORE)} wins, leading by ${String(WIN_LEAD)}.`,
];

function drawHowto(ctx: CanvasRenderingContext2D, state: CaromView): void {
  dimField(ctx, state, 0.3);
  text(ctx, "HOW TO PLAY", FIELD_CX, 92, 56, COLORS.text, "center", 800);
  HOWTO_LINES.forEach((line, i) => {
    const accent = line.startsWith("SPIN") || line.startsWith("BANK");
    text(
      ctx,
      line,
      FIELD_CX,
      170 + i * 36,
      21,
      accent ? COLORS.highlight : COLORS.text,
      "center",
      accent ? 700 : 500,
    );
  });
  drawMenu(ctx, state);
}

function drawPaused(ctx: CanvasRenderingContext2D, state: CaromView): void {
  drawField(ctx, state);
  drawScores(ctx, state);
  ctx.fillStyle = COLORS.overlay;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  text(ctx, "PAUSED", FIELD_CX, 250, 72, COLORS.text, "center", 800);
  drawMenu(ctx, state);
}

export function winnerLabel(state: CaromView): string {
  if (state.winner === "left") return "PLAYER ONE WINS";
  if (state.winner === "right") {
    return state.mode === "solo" ? "THE MACHINE WINS" : "PLAYER TWO WINS";
  }
  return "MATCH OVER";
}

function drawMatchover(ctx: CanvasRenderingContext2D, state: CaromView): void {
  dimField(ctx, state, 0.4);
  const color =
    state.winner === "left"
      ? COLORS.left
      : state.winner === "right"
        ? COLORS.right
        : COLORS.text;
  text(ctx, winnerLabel(state), FIELD_CX, 220, 64, color, "center", 800);
  text(
    ctx,
    `${String(state.score.p1)}  –  ${String(state.score.p2)}`,
    FIELD_CX,
    320,
    72,
    COLORS.text,
  );
  text(ctx, modeLabel(state), FIELD_CX, 380, 18, COLORS.dim, "center", 600);
  drawMenu(ctx, state);
}

const DRAWERS: Readonly<
  Record<Screen, (ctx: CanvasRenderingContext2D, state: CaromView) => void>
> = {
  title: drawTitle,
  howto: drawHowto,
  countdown: (ctx, state) => {
    drawField(ctx, state);
    drawScores(ctx, state);
    drawCountdown(ctx, state);
  },
  playing: (ctx, state) => {
    drawField(ctx, state);
    drawScores(ctx, state);
  },
  paused: drawPaused,
  matchover: drawMatchover,
};

/** Draw the frame for `state`. */
export function renderFrame(
  state: CaromView,
  ctx: CanvasRenderingContext2D,
): void {
  DRAWERS[state.screen](ctx, state);
}
