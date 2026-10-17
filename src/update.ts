// One frame: read input, move between screens, then advance whatever the
// screen the input left the game on advances (specs/ui.md, specs/balls.md).

import type { UpdateApi } from "@clockwyrks/simple-2d";
import { CUES, HOLD_TIME, PADDLE_SPEED, type CueName } from "./constants";
import { aiVelocity } from "./ai";
import { appendTrail, parkedBall, scorerOf, serveBall, stepBall } from "./ball";
import type { BallState, CaromState, CaromView, Side } from "./game";
import { readInput, type FrameInput } from "./input";
import { otherSide, winnerOf } from "./match";
import { applyInput } from "./menus";
import { humanAxis, integratePaddle, type HeldMovement } from "./paddle";

/** A frame's advance: the next state and the cues the frame raised. */
export interface Advance {
  readonly state: CaromState;
  readonly cues: readonly CueName[];
}

/** The velocity whoever moves `side` drives it at this frame. */
function paddleVelocity(
  state: CaromView,
  side: Side,
  held: HeldMovement,
  dt: number,
): number {
  const paddle = state.paddles[side];
  if (paddle.driven) return paddle.drivenVy;
  if (side === "right" && state.mode === "solo") return aiVelocity(state, dt);
  return humanAxis(state.mode, side, held) * PADDLE_SPEED;
}

function movePaddles(
  state: CaromView,
  held: HeldMovement,
  dt: number,
): CaromState["paddles"] {
  return {
    left: integratePaddle(
      state.paddles.left,
      paddleVelocity(state, "left", held, dt),
      dt,
    ),
    right: integratePaddle(
      state.paddles.right,
      paddleVelocity(state, "right", held, dt),
      dt,
    ),
  };
}

/** A countdown frame: the trail, then the hold timer, serving when it elapses. */
function advanceCountdown(
  state: CaromView,
  ball: BallState,
  dt: number,
): CaromState {
  const sampled = appendTrail(ball, state.simTime);
  const holdTimer = sampled.holdTimer - dt;
  if (holdTimer > 0) return { ...state, ball: { ...sampled, holdTimer } };
  return {
    ...state,
    ball: serveBall(sampled, state.receiver),
    screen: "playing",
  };
}

/** A playing frame: the ball's physics, then the goal test. */
function advancePlaying(
  state: CaromView,
  ball: BallState,
  dt: number,
): Advance {
  const stepped = stepBall(ball, state.paddles, state.obstacles, dt);
  const cues: CueName[] = [];
  if (stepped.events.paddleHit) cues.push(CUES.paddleHit);
  if (stepped.events.wallBounce) cues.push(CUES.wallBounce);
  if (stepped.events.obstacleBounce) cues.push(CUES.obstacleBounce);

  const flown = appendTrail(stepped.ball, state.simTime);
  const scorer = scorerOf(flown);
  if (scorer === null) return { state: { ...state, ball: flown }, cues };

  cues.push(CUES.score);
  const score =
    scorer === "left"
      ? { p1: state.score.p1 + 1, p2: state.score.p2 }
      : { p1: state.score.p1, p2: state.score.p2 + 1 };
  const winner = winnerOf(score);
  if (winner !== null) {
    return {
      state: {
        ...state,
        ball: flown,
        score,
        winner,
        screen: "matchover",
        menuIndex: 0,
      },
      cues,
    };
  }
  return {
    state: {
      ...state,
      score,
      receiver: otherSide(scorer),
      ball: { ...parkedBall(), holdTimer: HOLD_TIME },
      screen: "countdown",
    },
    cues,
  };
}

/** Advance the screen `state` is on by `dt` seconds. */
export function advance(
  state: CaromView,
  held: HeldMovement,
  dt: number,
): Advance {
  if (state.screen !== "countdown" && state.screen !== "playing") {
    return { state, cues: [] };
  }
  const moved: CaromState = { ...state, paddles: movePaddles(state, held, dt) };
  const ball = moved.ball;
  if (ball === null) return { state: moved, cues: [] };
  if (moved.screen === "countdown") {
    return { state: advanceCountdown(moved, ball, dt), cues: [] };
  }
  return advancePlaying(moved, ball, dt);
}

/** The whole frame, over the engine's update API. */
export function updateFrame(
  state: CaromView,
  api: UpdateApi,
  dt: number,
): CaromState {
  // A pose may have set `muted` between frames; the runtime's bit follows it
  // before this frame's `mute` edge toggles it.
  if (api.audio.muted() !== state.muted) api.audio.setMuted(state.muted);
  const input = readInput(api);
  if (input.edges.mute) api.audio.setMuted(!api.audio.muted());

  const next = stepFrame(state, input, dt);
  for (const cue of next.cues) api.audio.play(cue);
  return { ...next.state, muted: api.audio.muted() };
}

/** The frame's transition over a read input, with the cues it raised. */
export function stepFrame(
  state: CaromView,
  input: FrameInput,
  dt: number,
): Advance {
  const ticked: CaromState = { ...state, simTime: state.simTime + dt };
  const afterInput = applyInput(ticked, input);
  return advance(afterInput, input.held, dt);
}
