// What one frame of input looks like to the game, read once at the top of
// every update (specs/ui.md).

import type { PointerSample, UpdateApi } from "@clockwyrks/simple-2d";
import { ACTIONS, type ActionName } from "./constants";
import type { HeldMovement } from "./paddle";

export interface FrameInput {
  /** Each action's press edge this frame, consumed on the read. */
  readonly edges: Readonly<Record<ActionName, boolean>>;
  /** The movement actions held this frame. */
  readonly held: HeldMovement;
  /** Every pointer and touch sample delivered since the last frame closed. */
  readonly samples: readonly PointerSample[];
}

/** An input frame with nothing pressed, held, or pointed. */
export const NO_INPUT: FrameInput = {
  edges: {
    "p1-up": false,
    "p1-down": false,
    "p2-up": false,
    "p2-down": false,
    confirm: false,
    back: false,
    pause: false,
    mute: false,
  },
  held: { p1Up: 0, p1Down: 0, p2Up: 0, p2Down: 0 },
  samples: [],
};

export function readInput(api: UpdateApi): FrameInput {
  const edges = { ...NO_INPUT.edges };
  for (const name of ACTIONS) edges[name] = api.input.pressed(name);
  return {
    edges,
    held: {
      p1Up: api.input.value("p1-up"),
      p1Down: api.input.value("p1-down"),
      p2Up: api.input.value("p2-up"),
      p2Down: api.input.value("p2-down"),
    },
    samples: api.input.pointerSamples(),
  };
}
