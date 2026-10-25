import { describe, expect, test } from "bun:test";

import type { RouteGeometry } from "../../lib/types";
import { climbsOf, fillGaps, matchClimbs, resample } from "./climbs";
import type { Sample } from "./climbs";

/** A line due north, one point per km (0.009° of latitude ≈ 1 km). */
const north = (km: number, lat0 = 50): RouteGeometry =>
  Array.from({ length: km + 1 }, (_, i) => [lat0 + i * 0.008993, 13]);

/** Samples one km apart, straight north. */
const samples = (n: number): Sample[] =>
  Array.from({ length: n }, (_, i) => ({
    km: i,
    lat: 50 + i * 0.008993,
    lon: 13,
  }));

describe("resample", () => {
  test("puts a point every step along the line, the ends included", () => {
    const s = resample(north(2), 0.5);
    expect(s.map((x) => Math.round(x.km * 10) / 10)).toEqual([
      0, 0.5, 1, 1.5, 2,
    ]);
    expect(s.at(-1)?.lat).toBeCloseTo(50.018, 3);
  });

  test("an empty line has no samples", () => {
    expect(resample([])).toEqual([]);
  });
});

describe("climbsOf", () => {
  test("finds a rise from its foot to its top", () => {
    const [climb, ...rest] = climbsOf(
      samples(6),
      [300, 400, 500, 600, 550, 500],
    );
    expect(rest).toEqual([]);
    expect(climb?.foot.km).toBe(0);
    expect(climb?.top.km).toBe(3);
    expect(climb?.gain).toBe(300);
    expect(climb?.grade).toBe(10);
  });

  test("a dip shallower than the drop does not cut a climb in two", () => {
    const [climb, ...rest] = climbsOf(
      samples(6),
      [300, 400, 380, 500, 600, 500],
    );
    expect(rest).toEqual([]);
    expect(climb?.gain).toBe(300);
  });

  test("two climbs with a real descent between them are two", () => {
    const climbs = climbsOf(
      samples(8),
      [300, 450, 300, 250, 400, 550, 400, 300],
    );
    expect(climbs.map((c) => [c.foot.km, c.top.km, c.gain])).toEqual([
      [0, 1, 150],
      [3, 5, 300],
    ]);
  });

  test("a flat run-in is not part of the climb", () => {
    const [climb] = climbsOf(samples(6), [300, 302, 305, 306, 450, 600]);
    expect(climb?.foot.km).toBe(3);
    expect(climb?.grade).toBe(14.7);
  });

  test("a valley road gaining height slowly is no climb", () => {
    const s = resample(north(30), 1);
    const h = s.map((_, i) => 200 + i * 7);
    expect(climbsOf(s, h)).toEqual([]);
  });

  test("a rise below the minimum gain is no climb", () => {
    expect(climbsOf(samples(4), [300, 400, 420, 300])).toEqual([]);
  });

  test("a climb ridden up and back down is out and back", () => {
    // Up 3 km north and back down the same road.
    const line = [...north(3), ...north(3).toReversed().slice(1)];
    const s = resample(line, 1);
    const [spur] = climbsOf(s, [300, 450, 600, 750, 600, 450, 300]);
    expect(spur?.outAndBack).toBe(true);
    // Over the top and on north: a crossing.
    const [pass] = climbsOf(
      resample(north(6), 1),
      [300, 450, 600, 750, 600, 450, 300],
    );
    expect(pass?.outAndBack).toBe(false);
  });
});

describe("matchClimbs", () => {
  const [climb] = climbsOf(samples(4), [300, 450, 600, 450]);
  const top = { lat: 50 + 2 * 0.008993, lon: 13 };

  test("an entry at the top is the climb, named when the tour lists it", () => {
    const entry = { ...top, slug: "x" };
    expect(
      matchClimbs(climb ? [climb] : [], [entry], { passes: ["x"] }),
    ).toMatchObject([{ entry: { slug: "x" }, named: true }]);
    expect(
      matchClimbs(climb ? [climb] : [], [entry], { passes: [] }),
    ).toMatchObject([{ entry: { slug: "x" }, named: false }]);
  });

  test("an entry 2 km off is not", () => {
    const far = { lat: top.lat + 0.018, lon: 13, slug: "far" };
    expect(
      matchClimbs(climb ? [climb] : [], [far], { passes: ["far"] }),
    ).toMatchObject([{ entry: null, named: false }]);
  });
});

describe("matchClimbs on an ascent", () => {
  const [climb] = climbsOf(samples(4), [300, 450, 600, 450]);
  // The marker 3 km on from the climb's top, the ascent running over it.
  const entry = { lat: 50 + 5 * 0.008993, lon: 13, slug: "on" };
  const climbs = climb ? [climb] : [];

  test("a top on one of an entry's ascents belongs to it", () => {
    expect(
      matchClimbs(climbs, [entry], { passes: ["on"] }, () => [north(5)]),
    ).toMatchObject([{ entry: { slug: "on" }, named: true }]);
  });

  test("a top beside the ascent does not", () => {
    const beside: RouteGeometry = north(5).map(([lat]) => [lat, 13.01]);
    expect(
      matchClimbs(climbs, [entry], { passes: ["on"] }, () => [beside]),
    ).toMatchObject([{ entry: null }]);
  });
});

describe("matchClimbs on the way up", () => {
  const [climb] = climbsOf(samples(6), [300, 400, 500, 600, 700, 720]);
  const climbs = climb ? [climb] : [];

  test("a marker the road passes high on the climb is that climb", () => {
    const col = { lat: 50 + 4 * 0.008993, lon: 13, slug: "col" };
    expect(matchClimbs(climbs, [col], { passes: ["col"] })).toMatchObject([
      { entry: { slug: "col" }, named: true },
    ]);
  });

  test("one it passes low on the climb is not", () => {
    const low = { lat: 50 + 0.008993, lon: 13, slug: "low" };
    expect(matchClimbs(climbs, [low], { passes: ["low"] })).toMatchObject([
      { entry: null },
    ]);
  });
});

test("a climb steeper than any road is the DEM, not a climb", () => {
  // 300 m in 1 km: a tunnel under a ridge.
  expect(climbsOf(samples(3), [500, 800, 500])).toEqual([]);
});

describe("fillGaps", () => {
  test("a cell without data takes the heights on either side", () => {
    expect(fillGaps([1500, null, 1520, null, null])).toEqual([
      1500, 1510, 1520, 1520, 1520,
    ]);
    expect(fillGaps([null, 300])).toEqual([300, 300]);
  });
});

test("a dip below the foot after a small bump moves the foot down", () => {
  const [climb] = climbsOf(samples(6), [1500, 1505, 1470, 1550, 1600, 1650]);
  expect(climb?.foot.ele).toBe(1470);
  expect(climb?.gain).toBe(180);
});

test("the tour's own entry wins over a nearer one it does not name", () => {
  const [climb] = climbsOf(samples(4), [300, 450, 600, 450]);
  const top = { lat: 50 + 2 * 0.008993, lon: 13 };
  const near = { ...top, lon: 13.005, slug: "near" };
  const own = { ...top, lon: 13.01, slug: "own" };
  expect(
    matchClimbs(climb ? [climb] : [], [near, own], { passes: ["own"] }),
  ).toMatchObject([{ entry: { slug: "own" }, named: true }]);
});
