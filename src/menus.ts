// The menus: which items each screen shows, where they sit, and how the
// keyboard, the pointer, and touch drive them (specs/ui.md).

import type { PointerSample } from "@clockwyrks/simple-2d";
import {
  FIELD_CX,
  MATCHOVER_ITEMS,
  PAUSE_ITEMS,
  TITLE_ITEMS,
} from "./constants";
import type {
  CaromState,
  CaromView,
  MenuPress,
  MenuRect,
  Screen,
} from "./game";
import type { FrameInput } from "./input";
import { returnToTitle, startMatch } from "./match";

/** The copy of the how-to screen's single item; the build's own. */
export const HOWTO_ITEMS = ["BACK TO TITLE"] as const;

export type MenuScreen = "title" | "howto" | "paused" | "matchover";

interface MenuLayout {
  /** The center y of the first item. */
  readonly top: number;
  /** The distance between item centers. */
  readonly step: number;
}

export const MENU_ITEM_W = 380;
export const MENU_ITEM_H = 56;

const LAYOUTS: Readonly<Record<MenuScreen, MenuLayout>> = {
  title: { top: 420, step: 70 },
  howto: { top: 648, step: 70 },
  paused: { top: 352, step: 70 },
  matchover: { top: 470, step: 70 },
};

/** The items the menu on `screen` shows, or `null` where there is no menu. */
export function menuItems(screen: Screen): readonly string[] | null {
  switch (screen) {
    case "title":
      return TITLE_ITEMS;
    case "howto":
      return HOWTO_ITEMS;
    case "paused":
      return PAUSE_ITEMS;
    case "matchover":
      return MATCHOVER_ITEMS;
    default:
      return null;
  }
}

/** The hit region of item `index` on `screen`'s menu, or `null`. */
export function menuItemRect(screen: Screen, index: number): MenuRect | null {
  const items = menuItems(screen);
  if (items === null || !Number.isInteger(index)) return null;
  if (index < 0 || index >= items.length) return null;
  const layout = LAYOUTS[screen as MenuScreen];
  return {
    x: FIELD_CX - MENU_ITEM_W / 2,
    y: layout.top + index * layout.step - MENU_ITEM_H / 2,
    w: MENU_ITEM_W,
    h: MENU_ITEM_H,
  };
}

/** The index of the item whose region holds `(x, y)`, or `-1`. */
export function menuItemAt(screen: Screen, x: number, y: number): number {
  const items = menuItems(screen);
  if (items === null) return -1;
  for (let index = 0; index < items.length; index++) {
    const r = menuItemRect(screen, index);
    if (r !== null && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
      return index;
    }
  }
  return -1;
}

// ---- Transitions ---------------------------------------------------------

function pauseGame(state: CaromView): CaromState {
  if (state.screen !== "countdown" && state.screen !== "playing") {
    return state;
  }
  return {
    ...state,
    resumeScreen: state.screen,
    screen: "paused",
    menuIndex: 0,
  };
}

function resumeGame(state: CaromView): CaromState {
  return { ...state, screen: state.resumeScreen };
}

function openHowto(state: CaromView): CaromState {
  return { ...state, screen: "howto", menuIndex: 0 };
}

/** The effect of confirming the item at `menuIndex` on the current screen. */
export function confirmItem(state: CaromView): CaromState {
  const index = state.menuIndex;
  switch (state.screen) {
    case "title": {
      const remembered = { ...state, titleIndex: index };
      if (index === 0) return startMatch(remembered, "solo");
      if (index === 1) return startMatch(remembered, "versus");
      if (index === 2) return openHowto(remembered);
      return state;
    }
    case "howto":
      return returnToTitle(state);
    case "paused":
      if (index === 0) return resumeGame(state);
      if (index === 1) return startMatch(state, state.mode);
      if (index === 2) return returnToTitle(state);
      return state;
    case "matchover":
      if (index === 0) return startMatch(state, state.mode);
      if (index === 1) return returnToTitle(state);
      return state;
    default:
      return state;
  }
}

// ---- Input ---------------------------------------------------------------

/** At most this many pending presses are remembered. */
const PRESS_LIMIT = 16;

/**
 * Apply this frame's pointer and touch samples to the menu on `state.screen`.
 * A landing or a hover onto an item selects it; a lift inside the item its
 * press landed on confirms it. Samples after a confirm belong to the screen
 * the confirm reached and are left for the next update.
 */
function applyPointer(
  state: CaromView,
  samples: readonly PointerSample[],
): CaromState {
  let next: CaromState = state;
  let presses: readonly MenuPress[] = state.presses;
  for (const sample of samples) {
    const index = menuItemAt(next.screen, sample.x, sample.y);
    if (sample.type === "down") {
      const press: MenuPress = { id: sample.id, screen: next.screen, index };
      presses = [...presses.filter((p) => p.id !== sample.id), press].slice(
        -PRESS_LIMIT,
      );
      if (index >= 0) next = { ...next, menuIndex: index };
    } else if (sample.type === "move") {
      if (index >= 0) next = { ...next, menuIndex: index };
    } else {
      const press = presses.find((p) => p.id === sample.id);
      presses = presses.filter((p) => p.id !== sample.id);
      if (
        press !== undefined &&
        press.screen === next.screen &&
        press.index >= 0 &&
        press.index === index
      ) {
        return confirmItem({ ...next, menuIndex: index, presses });
      }
    }
  }
  return { ...next, presses };
}

/**
 * Drive the menu on `state.screen` with this frame's input: the escape
 * actions first, then keyboard movement, then a keyboard confirm, then the
 * pointer and touch samples.
 */
function applyMenu(
  state: CaromView,
  input: FrameInput,
  escape: boolean,
  onEscape: (s: CaromView) => CaromState,
): CaromState {
  if (escape) return onEscape(state);
  const items = menuItems(state.screen);
  const count = items === null ? 1 : items.length;
  const { edges } = input;
  const up = edges["p1-up"] || edges["p2-up"];
  const down = edges["p1-down"] || edges["p2-down"];

  let next: CaromState = state;
  let moved = false;
  if (up) {
    next = { ...next, menuIndex: (next.menuIndex - 1 + count) % count };
    moved = true;
  } else if (down) {
    next = { ...next, menuIndex: (next.menuIndex + 1) % count };
    moved = true;
  }
  if (!moved && edges.confirm) return confirmItem(next);
  return applyPointer(next, input.samples);
}

/** Read this frame's input on the screen the update began on. */
export function applyInput(state: CaromView, input: FrameInput): CaromState {
  const { edges } = input;
  switch (state.screen) {
    case "title":
      return applyMenu(state, input, false, (s) => s);
    case "howto":
      return applyMenu(state, input, edges.back, returnToTitle);
    case "countdown":
    case "playing":
      return edges.pause ? pauseGame(state) : state;
    case "paused":
      return applyMenu(state, input, edges.pause || edges.back, resumeGame);
    case "matchover":
      return applyMenu(state, input, edges.back, returnToTitle);
  }
}
