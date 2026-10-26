import { describe, expect, test } from "bun:test";

import { FAN, fanLayout, fanTarget, spread } from "@/lib/fan";
import type { FanRoad, FanView, Px } from "@/lib/fan";

const view: FanView = {
  height: 800,
  inset: { bottom: 0, left: 0, right: 0, top: 0 },
  width: 1200,
};
/** A square outline from (500, 300) to (700, 500). */
const outline: Px[] = [
  { x: 500, y: 300 },
  { x: 700, y: 300 },
  { x: 700, y: 500 },
  { x: 500, y: 500 },
];
const road = (
  slug: string,
  x: number,
  y: number,
  status: FanRoad["status"] = "open",
  classic = false,
): FanRoad => ({ at: { x, y }, classic, name: slug, slug, status });

describe("spread", () => {
  test("names that do not collide stay level with their dots", () => {
    expect(spread([100, 200, 300], 0, 1000, 24)).toEqual([100, 200, 300]);
  });

  test("names that collide are pushed apart, a step each", () => {
    expect(spread([100, 105, 110], 0, 1000, 24)).toEqual([100, 124, 148]);
  });

  test("a column that runs off the bottom is pushed back up", () => {
    expect(spread([990, 995, 1000], 0, 1000, 24)).toEqual([952, 976, 1000]);
  });
});

describe("fanLayout", () => {
  test("a road west of the middle is named on the left, the others on the right", () => {
    const fan = fanLayout(
      [road("west", 520, 400), road("east", 680, 400)],
      outline,
      view,
    );
    const side = Object.fromEntries(fan.entries.map((e) => [e.slug, e.side]));
    expect(side).toEqual({ east: "right", west: "left" });
    const west = fan.entries.find((e) => e.slug === "west")!;
    expect(west.label).toEqual({ x: 500 - FAN.gap, y: 400 });
    expect(fan.more).toBe(0);
    expect(fan.moreAt).toBeNull();
  });

  test("lines in a column do not cross: the names keep the order of their dots", () => {
    const fan = fanLayout(
      [road("low", 600, 450), road("high", 610, 310), road("mid", 620, 400)],
      outline,
      view,
    );
    const right = fan.entries
      .filter((e) => e.side === "right")
      .toSorted((a, b) => a.label.y - b.label.y)
      .map((e) => e.slug);
    expect(right).toEqual(["high", "mid", "low"]);
  });

  test("an outline at the screen's edge names everything on the side with room", () => {
    const edge: Px[] = outline.map((p) => ({ x: p.x - 480, y: p.y }));
    const fan = fanLayout(
      [road("a", 30, 400), road("b", 200, 400)],
      edge,
      view,
    );
    expect(fan.entries.every((e) => e.side === "right")).toBe(true);
  });

  test("a short screen keeps the rideable roads and the classics, and counts the rest", () => {
    // Room for three rows a side.
    const short: FanView = { ...view, height: 3 * FAN.step + 2 * FAN.margin };
    const roads = [
      road("closed-1", 520, 40, "closed"),
      road("closed-2", 680, 40, "closed"),
      road("risky-classic", 520, 30, "risky", true),
      road("risky", 680, 30, "risky"),
      road("open-1", 520, 50),
      road("open-2", 680, 50),
      road("open-3", 530, 60),
      road("open-4", 670, 60),
    ];
    const fan = fanLayout(roads, outline, short);
    const named = fan.entries.map((e) => e.slug).toSorted();
    expect(named).toEqual([
      "open-1",
      "open-2",
      "open-3",
      "open-4",
      "risky-classic",
    ]);
    expect(fan.more).toBe(3);
    expect(fan.moreAt).not.toBeNull();
  });

  test("nothing to name, nothing drawn", () => {
    expect(fanLayout([], outline, view)).toEqual({
      entries: [],
      more: 0,
      moreAt: null,
    });
  });
});

const holds = (area: string, slug: string) =>
  area === "alta-badia" && slug === "pordoi";

describe("fanTarget", () => {
  const base = {
    current: null,
    holds,
    hovered: null,
    overFan: false,
    selection: null,
  };

  test("the area pointed at is fanned out", () => {
    expect(
      fanTarget({
        ...base,
        hovered: { kind: "destination", slug: "oisans" },
      }),
    ).toBe("oisans");
  });

  test("its own road under the pointer, or a name of it, keeps it open", () => {
    const open = { ...base, current: "alta-badia" };
    expect(
      fanTarget({ ...open, hovered: { kind: "pass", slug: "pordoi" } }),
    ).toBe("alta-badia");
    expect(fanTarget({ ...open, overFan: true })).toBe("alta-badia");
    // Another area's road does not.
    expect(
      fanTarget({ ...open, hovered: { kind: "pass", slug: "galibier" } }),
    ).toBeNull();
  });

  test("with nothing pointed at, the area open in the panel is fanned out", () => {
    expect(
      fanTarget({
        ...base,
        selection: { kind: "destination", slug: "oisans" },
      }),
    ).toBe("oisans");
    expect(fanTarget(base)).toBeNull();
  });
});
