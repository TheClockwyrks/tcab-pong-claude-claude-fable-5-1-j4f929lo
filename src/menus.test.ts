import { describe, expect, it } from "vitest";
import type { PointerSample } from "@clockwyrks/simple-2d";
import { MATCHOVER_ITEMS, PAUSE_ITEMS, TITLE_ITEMS } from "./constants";
import type { CaromState, Screen } from "./game";
import { NO_INPUT, type FrameInput } from "./input";
import { titleState } from "./match";
import {
  HOWTO_ITEMS,
  applyInput,
  confirmItem,
  menuItemAt,
  menuItemRect,
  menuItems,
} from "./menus";

function on(screen: Screen, changes: Partial<CaromState> = {}): CaromState {
  return { ...titleState(false), screen, ...changes };
}

function edges(...names: (keyof FrameInput["edges"])[]): FrameInput {
  const all = { ...NO_INPUT.edges };
  for (const name of names) all[name] = true;
  return { ...NO_INPUT, edges: all };
}

function sample(
  type: PointerSample["type"],
  x: number,
  y: number,
  id = 1,
  device: PointerSample["device"] = "mouse",
): PointerSample {
  return {
    type,
    x,
    y,
    id,
    primary: true,
    device,
    button: type === "move" ? null : "primary",
    buttons: type === "up" ? [] : ["primary"],
  };
}

function samples(...list: PointerSample[]): FrameInput {
  return { ...NO_INPUT, samples: list };
}

function center(screen: Screen, index: number): { x: number; y: number } {
  const rect = menuItemRect(screen, index);
  if (rect === null) throw new Error("no rect");
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

describe("menu layout", () => {
  it("lists the items each screen shows", () => {
    expect(menuItems("title")).toBe(TITLE_ITEMS);
    expect(menuItems("howto")).toBe(HOWTO_ITEMS);
    expect(menuItems("paused")).toBe(PAUSE_ITEMS);
    expect(menuItems("matchover")).toBe(MATCHOVER_ITEMS);
    expect(menuItems("playing")).toBeNull();
    expect(menuItems("countdown")).toBeNull();
  });

  it("lays items out in non-overlapping regions inside the field", () => {
    for (const screen of ["title", "howto", "paused", "matchover"] as const) {
      const items = menuItems(screen) ?? [];
      const rects = items.map((_, i) => menuItemRect(screen, i));
      rects.forEach((rect, i) => {
        expect(rect).not.toBeNull();
        if (rect === null) return;
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.w).toBeLessThanOrEqual(1280);
        expect(rect.y + rect.h).toBeLessThanOrEqual(720);
        const next = rects[i + 1];
        if (next) expect(next.y).toBeGreaterThanOrEqual(rect.y + rect.h);
      });
    }
  });

  it("returns null for screens with no menu and for indices naming no item", () => {
    expect(menuItemRect("playing", 0)).toBeNull();
    expect(menuItemRect("countdown", 0)).toBeNull();
    expect(menuItemRect("title", 3)).toBeNull();
    expect(menuItemRect("title", -1)).toBeNull();
    expect(menuItemRect("title", 0.5)).toBeNull();
    expect(menuItemRect("howto", 1)).toBeNull();
  });

  it("finds the item under a point", () => {
    const { x, y } = center("title", 1);
    expect(menuItemAt("title", x, y)).toBe(1);
    expect(menuItemAt("title", 10, 10)).toBe(-1);
    expect(menuItemAt("playing", x, y)).toBe(-1);
  });
});

describe("keyboard navigation", () => {
  it("wraps the title menu both ways from either player's actions", () => {
    expect(applyInput(on("title"), edges("p1-up")).menuIndex).toBe(2);
    expect(
      applyInput(on("title", { menuIndex: 2 }), edges("p2-down")).menuIndex,
    ).toBe(0);
    expect(applyInput(on("title"), edges("p2-down")).menuIndex).toBe(1);
  });

  it("applies up before down and movement before confirm", () => {
    const both = applyInput(
      on("title", { menuIndex: 1 }),
      edges("p1-up", "p1-down"),
    );
    expect(both.menuIndex).toBe(0);
    const moveAndConfirm = applyInput(on("title"), edges("p1-down", "confirm"));
    expect(moveAndConfirm.screen).toBe("title");
    expect(moveAndConfirm.menuIndex).toBe(1);
  });

  it("confirms each title item and remembers the selection", () => {
    const solo = applyInput(on("title"), edges("confirm"));
    expect(solo).toMatchObject({
      screen: "countdown",
      mode: "solo",
      titleIndex: 0,
    });
    const versus = applyInput(on("title", { menuIndex: 1 }), edges("confirm"));
    expect(versus).toMatchObject({
      screen: "countdown",
      mode: "versus",
      titleIndex: 1,
    });
    const howto = applyInput(on("title", { menuIndex: 2 }), edges("confirm"));
    expect(howto).toMatchObject({
      screen: "howto",
      menuIndex: 0,
      titleIndex: 2,
    });
  });

  it("ignores back on the title", () => {
    expect(
      applyInput(on("title", { menuIndex: 1 }), edges("back")),
    ).toMatchObject({ screen: "title", menuIndex: 1 });
  });

  it("returns from the how-to screen on confirm or back", () => {
    expect(
      applyInput(on("howto", { titleIndex: 2 }), edges("confirm")),
    ).toMatchObject({ screen: "title", menuIndex: 2 });
    expect(
      applyInput(on("howto", { titleIndex: 2 }), edges("back")),
    ).toMatchObject({ screen: "title", menuIndex: 2 });
    expect(applyInput(on("howto"), edges("p1-down")).menuIndex).toBe(0);
  });

  it("pauses from countdown and playing, remembering which", () => {
    expect(
      applyInput(on("playing", { menuIndex: 2 }), edges("pause")),
    ).toMatchObject({
      screen: "paused",
      resumeScreen: "playing",
      menuIndex: 0,
    });
    expect(applyInput(on("countdown"), edges("pause"))).toMatchObject({
      screen: "paused",
      resumeScreen: "countdown",
    });
    expect(
      applyInput(on("playing"), edges("back", "confirm", "p1-up")).screen,
    ).toBe("playing");
  });

  it("resumes from the pause menu on pause or back and does nothing else", () => {
    const paused = on("paused", { resumeScreen: "countdown", menuIndex: 1 });
    expect(
      applyInput(paused, edges("pause", "p1-down", "confirm")),
    ).toMatchObject({ screen: "countdown", menuIndex: 1 });
    expect(applyInput(paused, edges("back"))).toMatchObject({
      screen: "countdown",
    });
  });

  it("drives the pause menu", () => {
    const paused = on("paused", {
      resumeScreen: "playing",
      mode: "versus",
      score: { p1: 3, p2: 4 },
    });
    expect(applyInput(paused, edges("p1-up")).menuIndex).toBe(2);
    expect(applyInput(paused, edges("confirm")).screen).toBe("playing");
    const restart = applyInput({ ...paused, menuIndex: 1 }, edges("confirm"));
    expect(restart).toMatchObject({
      screen: "countdown",
      mode: "versus",
      score: { p1: 0, p2: 0 },
    });
    const quit = applyInput({ ...paused, menuIndex: 2 }, edges("confirm"));
    expect(quit).toMatchObject({ screen: "title", mode: "solo" });
  });

  it("drives the match-over menu", () => {
    const over = on("matchover", {
      mode: "versus",
      winner: "right",
      score: { p1: 2, p2: 11 },
    });
    expect(applyInput(over, edges("p2-down")).menuIndex).toBe(1);
    expect(applyInput(over, edges("p2-up")).menuIndex).toBe(1);
    expect(applyInput(over, edges("confirm"))).toMatchObject({
      screen: "countdown",
      mode: "versus",
      winner: null,
    });
    expect(
      applyInput({ ...over, menuIndex: 1 }, edges("confirm")),
    ).toMatchObject({ screen: "title" });
    expect(applyInput(over, edges("back"))).toMatchObject({ screen: "title" });
  });

  it("confirms nothing for an index naming no item", () => {
    expect(confirmItem(on("title", { menuIndex: 7 })).screen).toBe("title");
    expect(confirmItem(on("paused", { menuIndex: 7 })).screen).toBe("paused");
    expect(confirmItem(on("matchover", { menuIndex: 7 })).screen).toBe(
      "matchover",
    );
    expect(confirmItem(on("playing")).screen).toBe("playing");
  });
});

describe("pointer and touch", () => {
  it("selects the item a pointer moves onto", () => {
    const { x, y } = center("title", 2);
    expect(
      applyInput(on("title"), samples(sample("move", x, y))).menuIndex,
    ).toBe(2);
    expect(
      applyInput(on("title"), samples(sample("move", 5, 5))).menuIndex,
    ).toBe(0);
  });

  it("confirms a press and release inside one item", () => {
    const { x, y } = center("title", 1);
    const state = applyInput(
      on("title"),
      samples(sample("down", x, y), sample("up", x + 3, y - 3)),
    );
    expect(state).toMatchObject({
      screen: "countdown",
      mode: "versus",
      titleIndex: 1,
    });
  });

  it("confirms across frames, remembering where the press landed", () => {
    const { x, y } = center("title", 2);
    const pressed = applyInput(on("title"), samples(sample("down", x, y)));
    expect(pressed.menuIndex).toBe(2);
    expect(pressed.presses).toEqual([{ id: 1, screen: "title", index: 2 }]);
    const released = applyInput(pressed, samples(sample("up", x, y)));
    expect(released.screen).toBe("howto");
    expect(released.presses).toEqual([]);
  });

  it("confirms nothing when the edges fall in different regions", () => {
    const a = center("title", 0);
    const b = center("title", 1);
    const pressed = applyInput(on("title"), samples(sample("down", a.x, a.y)));
    const dragged = applyInput(pressed, samples(sample("move", b.x, b.y)));
    expect(dragged.menuIndex).toBe(1);
    const released = applyInput(dragged, samples(sample("up", b.x, b.y)));
    expect(released.screen).toBe("title");
    expect(released.presses).toEqual([]);
  });

  it("confirms nothing when an edge falls outside every region", () => {
    const a = center("title", 0);
    const outsideIn = applyInput(
      applyInput(on("title"), samples(sample("down", 5, 5))),
      samples(sample("up", a.x, a.y)),
    );
    expect(outsideIn.screen).toBe("title");
    const inOut = applyInput(
      applyInput(on("title"), samples(sample("down", a.x, a.y))),
      samples(sample("up", 5, 5)),
    );
    expect(inOut.screen).toBe("title");
    expect(inOut.presses).toEqual([]);
  });

  it("drives the menus with touch contacts by id", () => {
    const a = center("paused", 2);
    const paused = on("paused", { mode: "versus" });
    const landed = applyInput(
      paused,
      samples(sample("down", a.x, a.y, 7, "touch")),
    );
    expect(landed.menuIndex).toBe(2);
    const otherFinger = applyInput(
      landed,
      samples(sample("up", a.x, a.y, 8, "touch")),
    );
    expect(otherFinger.screen).toBe("paused");
    const lifted = applyInput(
      otherFinger,
      samples(sample("up", a.x, a.y, 7, "touch")),
    );
    expect(lifted.screen).toBe("title");
  });

  it("selects the item a touch travels onto", () => {
    const a = center("matchover", 0);
    const b = center("matchover", 1);
    const landed = applyInput(
      on("matchover"),
      samples(sample("down", a.x, a.y, 3, "touch")),
    );
    const travelled = applyInput(
      landed,
      samples(sample("move", b.x, b.y, 3, "touch")),
    );
    expect(travelled.menuIndex).toBe(1);
  });

  it("lets the pointer's selection win over a keyboard movement on one frame", () => {
    const { x, y } = center("title", 2);
    const input: FrameInput = {
      ...edges("p1-down"),
      samples: [sample("move", x, y)],
    };
    expect(applyInput(on("title"), input).menuIndex).toBe(2);
  });

  it("lets a keyboard confirm win over a pointer confirm on one frame", () => {
    const { x, y } = center("title", 1);
    const input: FrameInput = {
      ...edges("confirm"),
      samples: [sample("down", x, y), sample("up", x, y)],
    };
    expect(applyInput(on("title"), input)).toMatchObject({
      screen: "countdown",
      mode: "solo",
    });
  });

  it("ignores a press that landed on another screen", () => {
    const { x, y } = center("title", 0);
    const pressed = applyInput(on("title"), samples(sample("down", x, y)));
    const elsewhere = { ...pressed, screen: "paused" as const };
    const pausedRect = center("paused", 0);
    const lifted = applyInput(
      elsewhere,
      samples(sample("up", pausedRect.x, pausedRect.y)),
    );
    expect(lifted.screen).toBe("paused");
  });

  it("leaves samples after a confirm for the screen the confirm reached", () => {
    const { x, y } = center("title", 0);
    const state = applyInput(
      on("title"),
      samples(sample("down", x, y), sample("up", x, y), sample("down", x, y)),
    );
    expect(state.screen).toBe("countdown");
    expect(state.presses).toEqual([]);
  });

  it("ignores pointer input on screens without a menu", () => {
    const { x, y } = center("title", 0);
    const state = applyInput(
      on("playing"),
      samples(sample("down", x, y), sample("up", x, y)),
    );
    expect(state.screen).toBe("playing");
    expect(state.presses).toEqual([]);
  });

  it("bounds the pending presses it remembers", () => {
    const { x, y } = center("title", 0);
    let state = on("title");
    for (let id = 0; id < 40; id++) {
      state = applyInput(state, samples(sample("down", x, y, id, "touch")));
    }
    expect(state.presses.length).toBeLessThanOrEqual(16);
  });
});
