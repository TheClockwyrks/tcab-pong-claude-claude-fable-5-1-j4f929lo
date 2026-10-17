// The values Carom shows on the engine's debug overlay
// (specs/instrumentation.md). Every source is a pure read of the state.

import type { InitApi } from "@clockwyrks/simple-2d";
import type { CaromState, CaromView, Side } from "./game";

const NONE = "-";

function fixed(value: number): string {
  return value.toFixed(1);
}

function paddleLine(state: CaromView, side: Side): string {
  const paddle = state.paddles[side];
  const tag = paddle.driven ? " driven" : "";
  return `cy ${fixed(paddle.cy)} vy ${fixed(paddle.vy)}${tag}`;
}

export function registerDiagnostics(api: InitApi<CaromState>): void {
  const { register } = api.diagnostics;
  register("screen", (s) => s.screen);
  register("mode", (s) => s.mode);
  register("score", (s) => `${String(s.score.p1)} - ${String(s.score.p2)}`);
  register("ball pos", (s) =>
    s.ball === null ? NONE : `${fixed(s.ball.x)}, ${fixed(s.ball.y)}`,
  );
  register("ball vel", (s) =>
    s.ball === null ? NONE : `${fixed(s.ball.vx)}, ${fixed(s.ball.vy)}`,
  );
  register("ball speed", (s) =>
    s.ball === null ? NONE : fixed(Math.hypot(s.ball.vx, s.ball.vy)),
  );
  register("ball spin", (s) => (s.ball === null ? NONE : fixed(s.ball.spin)));
  register("ball held", (s) => (s.ball === null ? NONE : s.ball.held));
  register("left paddle", (s) => paddleLine(s, "left"));
  register("right paddle", (s) => paddleLine(s, "right"));
  register("receiver", (s) => s.receiver);
  register("muted", (s) => s.muted);
  register("sim time", (s) => fixed(s.simTime));
}
