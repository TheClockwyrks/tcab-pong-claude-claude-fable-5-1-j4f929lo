// A headless engine over a Node canvas, for the tests: the real engine, the
// real game, a constant clock, and an event target the tests dispatch key and
// pointer events at exactly as a player's would arrive.

import { createCanvas, type Canvas } from "@napi-rs/canvas";
import {
  ConstantClock,
  createEngine,
  type Clock,
  type Engine,
} from "@clockwyrks/simple-2d";
import { FIELD_H, FIELD_W, LAYOUT } from "../constants";
import {
  BACKGROUND,
  game,
  type CaromDebugApi,
  type CaromSnapshot,
  type CaromState,
  type CaromView,
} from "../game";

export type PointerKind = "pointerdown" | "pointermove" | "pointerup";

export interface PointerOptions {
  readonly id?: number;
  readonly device?: "mouse" | "touch" | "pen";
  readonly primary?: boolean;
}

export interface Harness {
  readonly engine: Engine<CaromState, CaromDebugApi>;
  readonly debug: CaromDebugApi;
  readonly canvas: Canvas;
  readonly target: EventTarget;
  /** Every cue played so far, in order. */
  readonly cues: string[];
  readonly state: CaromView;
  snapshot(): CaromSnapshot;
  pose(transition: (state: CaromView) => CaromState): void;
  advance(frames: number): Promise<void>;
  keyDown(code: string): void;
  keyUp(code: string): void;
  /** A press and its release before the next frame: one edge. */
  tap(code: string): void;
  pointer(
    kind: PointerKind,
    x: number,
    y: number,
    options?: PointerOptions,
  ): void;
  /** A press and a release at one point, before the next frame. */
  click(x: number, y: number, options?: PointerOptions): void;
  /** The pixel at a logical point, as `[r, g, b, a]`. */
  pixel(x: number, y: number): readonly number[];
  destroy(): void;
}

export const STEP_MS = 1000 / 60;

export async function createHarness(
  clock: Clock = new ConstantClock(STEP_MS),
): Promise<Harness> {
  const canvas = createCanvas(FIELD_W, FIELD_H);
  const target = new EventTarget();
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: FIELD_W,
    height: FIELD_H,
    game,
    background: BACKGROUND,
    layout: LAYOUT,
    clock,
    surface: {
      cssWidth: () => FIELD_W,
      cssHeight: () => FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  const cues: string[] = [];
  engine.events.on("cue:played", (event) => cues.push(event.cue));
  await engine.initialize();

  const pointer = (
    kind: PointerKind,
    x: number,
    y: number,
    options: PointerOptions = {},
  ): void => {
    const down = kind !== "pointerup";
    target.dispatchEvent(
      Object.assign(new Event(kind), {
        clientX: x,
        clientY: y,
        pointerId: options.id ?? 1,
        pointerType: options.device ?? "mouse",
        isPrimary: options.primary ?? true,
        button: kind === "pointermove" ? -1 : 0,
        buttons: down ? 1 : 0,
      }),
    );
  };
  const keyDown = (code: string): void => {
    target.dispatchEvent(
      Object.assign(new Event("keydown"), { code, repeat: false }),
    );
  };
  const keyUp = (code: string): void => {
    target.dispatchEvent(Object.assign(new Event("keyup"), { code }));
  };

  return {
    engine,
    debug: engine.debug,
    canvas,
    target,
    cues,
    get state() {
      return engine.state;
    },
    snapshot: () => engine.debug.snapshot(engine.state),
    pose: (transition) => {
      engine.apply(transition);
    },
    advance: (frames) => engine.advance(frames),
    keyDown,
    keyUp,
    tap: (code) => {
      keyDown(code);
      keyUp(code);
    },
    pointer,
    click: (x, y, options) => {
      pointer("pointerdown", x, y, options);
      pointer("pointerup", x, y, options);
    },
    pixel: (x, y) =>
      Array.from(canvas.getContext("2d").getImageData(x, y, 1, 1).data),
    destroy: () => engine.destroy(),
  };
}

/** Advance `seconds` of game time in frames of the harness's constant step. */
export function framesFor(seconds: number, stepMs = STEP_MS): number {
  return Math.ceil((seconds * 1000) / stepMs);
}
