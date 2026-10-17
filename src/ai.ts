// The AI opponent (specs/modes/single-player.md). It holds no state of its
// own: each frame its velocity follows from the state it is handed.

import {
  AI_DEADZONE,
  AI_HOME_DEADZONE,
  AI_HOME_Y,
  AI_REACT,
  AI_SPEED,
} from "./constants";
import type { CaromView } from "./game";

/** The velocity the AI drives the right paddle at this frame. */
export function aiVelocity(state: CaromView, dt: number): number {
  if (!state.ai.movement) return 0;

  let target = AI_HOME_Y;
  let deadzone = AI_HOME_DEADZONE;
  const ball = state.ball;
  if (
    state.ai.tracking &&
    state.screen === "playing" &&
    ball !== null &&
    ball.vx > 0
  ) {
    target = ball.y - ball.vy * AI_REACT;
    deadzone = AI_DEADZONE;
  }

  const diff = target - state.paddles.right.cy;
  if (Math.abs(diff) <= deadzone) return 0;
  const reach = dt > 0 ? Math.abs(diff) / dt : AI_SPEED;
  return Math.sign(diff) * Math.min(AI_SPEED, reach);
}
