import { expect, test } from "bun:test";

import { convexHull, expandRing, haversine } from "@/lib/geo";
import type { LatLon } from "@/lib/types";

const at = (lat: number, lon: number): LatLon => ({ lat, lon });

test("fewer than three distinct points have no hull", () => {
  expect(convexHull([])).toEqual([]);
  expect(convexHull([at(46, 9)])).toEqual([]);
  expect(convexHull([at(46, 9), at(47, 9), at(46, 9)])).toEqual([]);
});

test("the hull keeps the corners and drops what lies inside", () => {
  const corners = [at(46, 9), at(46, 10), at(47, 10), at(47, 9)];
  const hull = convexHull([...corners, at(46.5, 9.5), at(46.2, 9.9)]);
  expect(hull).toHaveLength(4);
  expect(new Set(hull.map((p) => `${p.lat},${p.lon}`))).toEqual(
    new Set(corners.map((p) => `${p.lat},${p.lon}`)),
  );
});

test("a point on an edge is not a corner", () => {
  const hull = convexHull([
    at(46, 9),
    at(46, 10),
    at(47, 10),
    at(47, 9),
    at(46, 9.5),
  ]);
  expect(hull).toHaveLength(4);
});

test("expandRing pushes every vertex out by the given distance", () => {
  const ring = [at(46, 9), at(46, 10), at(47, 10), at(47, 9)];
  const wide = expandRing(ring, 10);
  const centre = at(46.5, 9.5);
  for (const [i, p] of wide.entries())
    expect(haversine(centre, p) - haversine(centre, ring[i]!)).toBeCloseTo(
      10,
      0,
    );
});

test("expandRing on an empty ring stays empty", () => {
  expect(expandRing([], 10)).toEqual([]);
});
