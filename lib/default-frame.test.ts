import { expect, test } from "bun:test";

import passesJson from "@/data/passes.json" with { type: "json" };
import toursJson from "@/data/tours.json" with { type: "json" };
import { bounds } from "@/lib/geo";
import type { Bounds } from "@/lib/geo";
import { FIT_PADDING } from "@/lib/map-camera";
import {
  HOME_RANGE,
  inBox,
  RANGE_BOUNDS,
  RANGES,
  rangeOf,
} from "@/lib/regions";
import { tourRange } from "@/lib/rows";
import { shellGeometry } from "@/lib/shell-geometry";
import { indexBySlug } from "@/lib/status";
import type { Pass, Tour } from "@/lib/types";

/**
 * A desktop the size a laptop has, with the sidebar open and the header and
 * the season card in place – what `onReady` in the camera fits the opening
 * frame into: the map's padding is the shell's inset, and `FIT_PADDING` is
 * added on every edge.
 */
const VIEWPORT = { height: 800, width: 1280 };
const { inset } = shellGeometry({
  bars: { header: 64, season: 80 },
  panels: { detail: false, sidebar: true },
  sheet: { inset: 0, snap: 0 },
  viewport: { ...VIEWPORT, mobile: false, wide: false },
});
const FREE = {
  height: VIEWPORT.height - inset.top - inset.bottom - 2 * FIT_PADDING,
  width: VIEWPORT.width - inset.left - inset.right - 2 * FIT_PADDING,
};

/** MapLibre's world is 512 px wide at zoom 0. */
const TILE = 512;

/** Web Mercator, as a share of the world's height: 0 at the north pole. */
const mercatorY = (lat: number) => {
  const phi = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2;
};

/** The zoom at which a box fits the free part of the viewport – what `fitBounds` lands on. */
const fitZoom = ([w, s, e, n]: Bounds): number =>
  Math.min(
    Math.log2(FREE.width / (TILE * ((e - w) / 360))),
    Math.log2(FREE.height / (TILE * (mercatorY(s) - mercatorY(n)))),
  );

/**
 * The zoom below which a range stops being readable as an overview: at 6 the
 * dots of the famous passes still stand apart, at 5 the range is a smear.
 * The map opens on the frame around what it draws of the home range
 * (`Scene.opening`, `onReady` in `camera`) and a range chip frames its own
 * range, so each of those frames has to be readable on its own: the Alps
 * with the Vosges and the Jura open at about 5.9 under a laptop's sidebar,
 * and the line sits a quarter step under that. The union of every range is
 * allowed to be far wider – the Pyrenees are 600 km from the Alps – because
 * nothing frames it but the fit button, pressed on purpose
 * (docs/plans/26-pyrenees.md).
 */
const MIN_OPENING_ZOOM = 5.65;

const passes = passesJson as Pass[];
const tours = toursJson as Tour[];
const index = indexBySlug(passes);

/** Every marker and every waypoint of one range; a loop's range is its passes'. */
const rangeBox = (range: (typeof RANGES)[number]): Bounds | null => {
  const points = [
    ...passes
      .filter((p) => rangeOf(p.region) === range)
      .map((p): [number, number] => [p.lat, p.lon]),
    ...tours
      .filter((t) => tourRange(t, index) === range)
      .flatMap((t) => t.waypoints.map((w): [number, number] => [w.lat, w.lon])),
  ];
  return points.length ? bounds(points) : null;
};

test("the home range, what the map opens on, frames at a readable zoom", () => {
  const box = rangeBox(HOME_RANGE);
  expect(box).not.toBeNull();
  const zoom = fitZoom(box!);
  expect(zoom, `opens at zoom ${zoom.toFixed(2)}`).toBeGreaterThanOrEqual(
    MIN_OPENING_ZOOM,
  );
});

test("every range with roads frames at a readable zoom on its own", () => {
  for (const range of RANGES) {
    const box = rangeBox(range);
    if (!box) continue;
    const zoom = fitZoom(box);
    expect(zoom, `${range} at zoom ${zoom.toFixed(2)}`).toBeGreaterThanOrEqual(
      MIN_OPENING_ZOOM,
    );
  }
});

/** A box as its two corners, `[lat, lon]` each – what `bounds` takes. */
const corners = (b: Bounds): [number, number][] => [
  [b[1], b[0]],
  [b[3], b[2]],
];

test("the Vosges and the Jura would fit the home frame, the Pyrenees would not", () => {
  const home = rangeBox(HOME_RANGE)!;
  // The two ranges' spans from plan 25, added to the alpine roads.
  const withVosgesAndJura = bounds([
    ...corners(home),
    [48.7, 6.8],
    [45.9, 5.5],
  ]);
  expect(fitZoom(withVosgesAndJura)).toBeGreaterThanOrEqual(MIN_OPENING_ZOOM);
  // Tourmalet and the Basque cols, 600 km to the south-west: this is why the
  // map opens on the home range rather than on everything it draws.
  const withPyrenees = bounds([...corners(home), [42.9, -1.5]]);
  expect(fitZoom(withPyrenees)).toBeLessThan(MIN_OPENING_ZOOM);
});

test("every road lies inside the box of its own range", () => {
  const outside = passes
    .filter((p) => !inBox(RANGE_BOUNDS[rangeOf(p.region)], p))
    .map((p) => p.slug);
  expect(outside).toEqual([]);
});
