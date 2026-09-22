import { describe, expect, test } from "bun:test";

import { HIT_GROUPS, HIT_LAYERS, LAYERS, PASS_LABELS } from "@/lib/layer-ids";
import { DOUBLE_MS, isDoubleClick, pick } from "@/lib/map-pick";
import type { Hit } from "@/lib/map-pick";

/** Degrees straight onto pixels: one degree of longitude is one pixel. */
const project = (p: readonly [number, number]) => ({ x: p[0], y: p[1] });
const AT = { x: 0, y: 0 };

const at = (
  layer: string,
  slug: string,
  point: [number, number] | null = [0, 0],
): Hit => ({ layer, point, slug });

describe("the table it ranks by", () => {
  test("every hit layer belongs to exactly one group", () => {
    expect(HIT_LAYERS.length).toBe(new Set(HIT_LAYERS).size);
    expect(HIT_GROUPS.flat()).toEqual([...HIT_LAYERS]);
  });

  test("every fame level's label answers the pointer", () => {
    for (const id of LAYERS.pass.labels) expect(HIT_LAYERS).toContain(id);
    expect(LAYERS.pass.labels).toHaveLength(PASS_LABELS.length);
  });
});

describe("priority", () => {
  test("a mark beats the name beside it, and both beat the lines", () => {
    const features = [
      at(LAYERS.tour.hit, "marmotte", null),
      at(LAYERS.route.hit, "galibier", null),
      at(LAYERS.tour.labels[0], "marmotte"),
      at(LAYERS.pass.labels[2]!, "lautaret"),
      at(LAYERS.pass.hit, "galibier"),
    ];
    expect(pick(features, AT, project)).toEqual({
      kind: "pass",
      slug: "galibier",
    });
    // Without the dot the name wins, and the tour's name loses to a pass's.
    expect(pick(features.slice(0, 4), AT, project)).toEqual({
      kind: "pass",
      slug: "lautaret",
    });
    // Two lines: the ascent is the more specific answer inside the band.
    expect(pick(features.slice(0, 2), AT, project)).toEqual({
      kind: "pass",
      slug: "galibier",
    });
  });

  test("an ascent is answered as its pass; a town speaks for itself", () => {
    expect(pick([at(LAYERS.route.hit, "stelvio", null)], AT, project)).toEqual({
      kind: "pass",
      slug: "stelvio",
    });
    expect(pick([at(LAYERS.town.hit, "bormio")], AT, project)).toEqual({
      kind: "town",
      slug: "bormio",
    });
    expect(pick([at(LAYERS.tour.hit, "marmotte", null)], AT, project)).toEqual({
      kind: "tour",
      slug: "marmotte",
    });
  });
});

describe("the tie-break", () => {
  test("inside a group the nearer mark wins, whichever kind it is", () => {
    const far = at(LAYERS.pass.hit, "far", [12, 0]);
    const near = at(LAYERS.town.hit, "near", [3, 4]);
    expect(pick([far, near], AT, project)).toEqual({
      kind: "town",
      slug: "near",
    });
    // Order does not decide it: the distance does.
    expect(pick([near, far], AT, project)).toEqual({
      kind: "town",
      slug: "near",
    });
  });

  test("a nearer mark in a lower group never beats a farther one above it", () => {
    expect(
      pick(
        [
          at(LAYERS.pass.hit, "far", [20, 0]),
          at(LAYERS.town.labels[0], "near"),
        ],
        AT,
        project,
      ),
    ).toEqual({ kind: "pass", slug: "far" });
  });
});

describe("what is not an answer", () => {
  test("nothing under the pointer, a layer outside the table, a feature without a slug", () => {
    expect(pick([], AT, project)).toBeNull();
    expect(pick([at("basemap-peaks", "galibier")], AT, project)).toBeNull();
    expect(pick([at(LAYERS.pass.hit, "")], AT, project)).toBeNull();
  });
});

/**
 * A double click is MapLibre's zoom gesture, and both of its halves arrive as
 * ordinary clicks. The first of them must not open a panel on its way into a
 * zoom, which is what every case here is about.
 */
const tap = (t: number, x = 0, y = 0) => ({ t, x, y });

describe("the double-click window", () => {
  test("the first click of a session is never the second half of one", () => {
    expect(isDoubleClick(null, tap(0))).toBe(false);
  });

  test("close in time and in place: the zoom gesture, not a pick", () => {
    expect(isDoubleClick(tap(0), tap(DOUBLE_MS - 1))).toBe(true);
    expect(isDoubleClick(tap(0), tap(120, 20, 20))).toBe(true);
  });

  test("a slow second click is a pick of its own", () => {
    expect(isDoubleClick(tap(0), tap(DOUBLE_MS))).toBe(false);
    expect(isDoubleClick(tap(0), tap(DOUBLE_MS + 500))).toBe(false);
  });

  test("a second click somewhere else is a pick of its own", () => {
    expect(isDoubleClick(tap(0), tap(100, 40, 0))).toBe(false);
    expect(isDoubleClick(tap(0), tap(100, 0, 31))).toBe(false);
  });

  test("a run of fast clicks stays a gesture all the way through", () => {
    const run = [tap(0), tap(100), tap(200), tap(300), tap(400)];
    expect(run.slice(1).map((t, i) => isDoubleClick(run[i]!, t))).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });
});
