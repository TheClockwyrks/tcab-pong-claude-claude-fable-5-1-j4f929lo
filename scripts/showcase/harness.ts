// The showcase harness: the real game on a page-sized canvas, stepped by a
// constant clock and reachable from Playwright as `window.carom`. Nothing here
// ships; `vite build` bundles `index.html` alone.

import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import { FIELD_H, FIELD_W, LAYOUT } from "../../src/constants";
import {
  BACKGROUND,
  game,
  type CaromDebugApi,
  type CaromState,
} from "../../src/game";

declare global {
  interface Window {
    carom: {
      engine: Engine<CaromState, CaromDebugApi>;
      ready: Promise<void>;
    };
  }
}

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const engine = createEngine({
  canvas,
  width: FIELD_W,
  height: FIELD_H,
  game,
  background: BACKGROUND,
  layout: LAYOUT,
  clock: new ConstantClock(1000 / 60),
});

window.carom = { engine, ready: engine.initialize().then(() => undefined) };
