import { expect, test } from "bun:test";

import { convexHull, haversine, paddedHull } from "@/lib/geo";
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

test("paddedHull keeps its distance from every point it is drawn around", () => {
  const points = [
    at(46, 9),
    at(46, 10),
    at(47, 10),
    at(47, 9.2),
    at(46.5, 9.5),
  ];
  const ring = paddedHull(points, 10);
  const vertices = ring.map(([lon, lat]) => at(lat, lon));
  // Every vertex sits on a circle of 10 km around one of the points, give or
  // take the hundred metres the ring is rounded to …
  for (const v of vertices)
    expect(Math.min(...points.map((p) => haversine(p, v)))).toBeCloseTo(10, 0);
  // … and the inner point lies well inside.
  expect(
    Math.min(...vertices.map((v) => haversine(at(46.5, 9.5), v))),
  ).toBeGreaterThan(40);
});

test("paddedHull makes an area of one point or a line of them, and none of nothing", () => {
  expect(paddedHull([at(46, 9)], 5).length).toBeGreaterThanOrEqual(8);
  // A valley's roads in a line are a band, not a sliver.
  const band = paddedHull([at(46, 9), at(46, 9.5), at(46, 10)], 5);
  const lats = band.map(([, lat]) => lat);
  expect(Math.max(...lats) - Math.min(...lats)).toBeCloseTo(
    (2 * 5) / 111.32,
    2,
  );
  expect(paddedHull([], 5)).toEqual([]);
});
