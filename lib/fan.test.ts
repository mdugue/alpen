import { describe, expect, test } from "bun:test";

import {
  areasOf as areasIn,
  FAN,
  FAN_FIT,
  fanFits,
  fanLayout,
  fanTarget,
  spread,
} from "@/lib/fan";
import type { AreaIndex, FanItem, FanView, Px } from "@/lib/fan";

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
  status: FanItem["status"] = "open",
  classic = false,
): FanItem => ({
  at: { x, y },
  classic,
  kind: "pass",
  name: slug,
  slug,
  status,
});

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

  test("an outline wider than the free screen pulls its column in, onto the screen", () => {
    const wide: Px[] = outline.map((p) => ({
      x: p.x < 600 ? 40 : 1180,
      y: p.y,
    }));
    const fan = fanLayout([road("a", 600, 400)], wide, view);
    const [entry] = fan.entries;
    expect(entry!.label.x + FAN.charPx + FAN.chrome).toBeLessThanOrEqual(
      view.width - FAN.margin,
    );
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

const areasOf = (sel: { kind: string; slug: string }) =>
  sel.slug === "pordoi" || sel.slug === "arabba"
    ? ["alta-badia", "dolomiti"]
    : sel.slug === "galibier"
      ? ["oisans"]
      : [];

describe("fanTarget", () => {
  const base = {
    areasOf,
    current: null,
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

  test("a road or a town pointed at opens its area", () => {
    expect(
      fanTarget({ ...base, hovered: { kind: "pass", slug: "galibier" } }),
    ).toBe("oisans");
    expect(
      fanTarget({ ...base, hovered: { kind: "town", slug: "arabba" } }),
    ).toBe("alta-badia");
    // Outside every area: nothing to fan out.
    expect(
      fanTarget({ ...base, hovered: { kind: "pass", slug: "ventoux" } }),
    ).toBeNull();
  });

  test("of a road in two areas, the one already open stays", () => {
    expect(
      fanTarget({
        ...base,
        current: "dolomiti",
        hovered: { kind: "pass", slug: "pordoi" },
      }),
    ).toBe("dolomiti");
  });

  test("the names keep it open; another area's road moves it", () => {
    const open = { ...base, current: "alta-badia" };
    expect(fanTarget({ ...open, overFan: true })).toBe("alta-badia");
    expect(
      fanTarget({ ...open, hovered: { kind: "pass", slug: "galibier" } }),
    ).toBe("oisans");
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

  test("a tour opens its area like a road", () => {
    expect(
      fanTarget({ ...base, hovered: { kind: "tour", slug: "galibier" } }),
    ).toBe("oisans");
  });
});

const area = (
  slug: string,
  lat: number,
  lon: number,
  passes: string[],
  tours: string[] = [],
) => ({
  destination: { center: { lat, lon }, slug },
  members: { passes, tours, towns: [] },
});

describe("areasOf", () => {
  const index: AreaIndex = {
    destination: [
      area("vinschgau", 46.6, 10.6, ["stelvio"], ["grandes-alpes", "loop"]),
      area(
        "bormio",
        46.47,
        10.37,
        ["stelvio", "gavia"],
        ["grandes-alpes", "loop"],
      ),
      area("oisans", 45.06, 6.03, [], ["grandes-alpes"]),
    ],
    pass: [{ pass: { lat: 46.53, lon: 10.45, slug: "stelvio" } }],
    tourBounds: { loop: [10.3, 46.4, 10.6, 46.6] },
    town: [],
  };

  test("a road in two areas names the one with the nearest centre first", () => {
    expect(areasIn({ kind: "pass", slug: "stelvio" }, index)).toEqual([
      "bormio",
      "vinschgau",
    ]);
    expect(areasIn({ kind: "pass", slug: "gavia" }, index)).toEqual(["bormio"]);
  });

  test("a tour through more than two areas is a journey and opens none", () => {
    expect(areasIn({ kind: "tour", slug: "grandes-alpes" }, index)).toEqual([]);
    expect(areasIn({ kind: "tour", slug: "loop" }, index)).toHaveLength(2);
  });

  test("an area itself belongs to nothing", () => {
    expect(areasIn({ kind: "destination", slug: "bormio" }, index)).toEqual([]);
  });
});

describe("fanLayout with towns and loops", () => {
  test("a town and a road may share a slug and are both named", () => {
    const town: FanItem = {
      ...road("bormio", 690, 420),
      kind: "town",
      status: null,
    };
    const fan = fanLayout([road("bormio", 520, 400), town], outline, view);
    expect(fan.entries.map((e) => `${e.kind}:${e.side}`).toSorted()).toEqual([
      "pass:left",
      "town:right",
    ]);
  });
});

describe("fanFits", () => {
  // About 50 km square at 46° N – the middling area.
  const box: [number, number, number, number] = [10, 46, 10.65, 46.45];
  const laptop = { height: 700, width: 1000 };

  test("an area seen from outside is fanned out", () => {
    expect(fanFits(box, { ...laptop, zoom: 7.5 })).toBe(true);
  });

  test("one that takes more than its share of the map is not", () => {
    expect(fanFits(box, { ...laptop, zoom: 9 })).toBe(false);
  });

  test("the share is of the shorter side of what the panels leave", () => {
    // The same zoom fits a tall window and not a short one.
    const zoom = 8.3;
    expect(fanFits(box, { height: 1000, width: 1000, zoom })).toBe(true);
    expect(fanFits(box, { height: 500, width: 1000, zoom })).toBe(false);
    expect(FAN_FIT).toBeLessThan(1);
  });

  test("a map not measured yet fans as before", () => {
    expect(fanFits(box, null)).toBe(true);
  });
});
