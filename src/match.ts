// The match: the title-screen state, starting a match, returning to the title,
// and the win rule (specs/ui.md, specs/balls.md).

import { FIELD_CY, OBSTACLE_CENTERS, WIN_LEAD, WIN_SCORE } from "./constants";
import { parkedBall } from "./ball";
import type {
  CaromState,
  CaromView,
  Mode,
  ObstacleState,
  PaddleState,
  Side,
} from "./game";

export const REST_PADDLE: PaddleState = {
  cy: FIELD_CY,
  vy: 0,
  driven: false,
  drivenVy: 0,
};

/** Obstacle `index` at its fixed center. */
export function obstacleAt(index: number): ObstacleState {
  const center = OBSTACLE_CENTERS[index];
  if (center === undefined) {
    throw new RangeError(`Carom: no obstacle has index ${String(index)}`);
  }
  return { index, cx: center.x, cy: center.y };
}

/** Every obstacle, in the order of `OBSTACLE_CENTERS`. */
export function allObstacles(): readonly ObstacleState[] {
  return OBSTACLE_CENTERS.map((_, index) => obstacleAt(index));
}

/** The state the game opens on, with the runtime's mute bit mirrored in. */
export function titleState(muted: boolean): CaromState {
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: { left: REST_PADDLE, right: REST_PADDLE },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parkedBall(),
    obstacles: allObstacles(),
    simTime: 0,
    muted,
    presses: [],
  };
}

/** Start a match in `mode`: fresh scores, both paddles at rest, the ball parked. */
export function startMatch(state: CaromView, mode: Mode): CaromState {
  return {
    ...state,
    mode,
    screen: "countdown",
    resumeScreen: "playing",
    menuIndex: 0,
    score: { p1: 0, p2: 0 },
    winner: null,
    receiver: "left",
    ball: parkedBall(),
    paddles: {
      left: { ...state.paddles.left, cy: FIELD_CY, vy: 0 },
      right: { ...state.paddles.right, cy: FIELD_CY, vy: 0 },
    },
  };
}

/**
 * Return to the title: every declared field back to its title-screen value,
 * except the remembered title selection, the simulation time, and the mute
 * bit, with `menuIndex` restored from `titleIndex`.
 */
export function returnToTitle(state: CaromView): CaromState {
  return {
    ...titleState(state.muted),
    titleIndex: state.titleIndex,
    menuIndex: state.titleIndex,
    simTime: state.simTime,
  };
}

/** The winning side under the win rule, or `null` while the match goes on. */
export function winnerOf(score: { p1: number; p2: number }): Side | null {
  if (score.p1 >= WIN_SCORE && score.p1 - score.p2 >= WIN_LEAD) return "left";
  if (score.p2 >= WIN_SCORE && score.p2 - score.p1 >= WIN_LEAD) return "right";
  return null;
}

export function otherSide(side: Side): Side {
  return side === "left" ? "right" : "left";
}
