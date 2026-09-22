import { expect, test } from "bun:test";

import passesJson from "@/data/passes.json" with { type: "json" };
import toursJson from "@/data/tours.json" with { type: "json" };
import { bounds } from "@/lib/map-assets";
import type { Bounds } from "@/lib/map-assets";
import { FIT_PADDING } from "@/lib/map-camera";
import { shellGeometry } from "@/lib/shell-geometry";
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
 * The zoom below which the Alps stop being readable as an overview: at 6 the
 * dots of the famous passes still stand apart, at 5 the range is a smear.
 * The map opens on the frame around everything it draws (`onReady` in
 * `camera`), so a range added far from the Alps would not fall out of the
 * picture – it would zoom the picture out until nothing in it is readable,
 * and nobody would notice from the list. This is the line that fails first
 * (docs/plans/25-vosges-and-jura.md; plan 26, the Pyrenees, trips it and
 * decides what the first screen shows then). The Alps with the Vosges and
 * the Jura open at about 5.9 under a laptop's sidebar; the line sits a
 * quarter step under that.
 */
const MIN_OPENING_ZOOM = 5.65;

const passes = passesJson as Pass[];
const tours = toursJson as Tour[];

/** Every marker and every tour waypoint: what the opening frame holds at least. */
const everything = () =>
  bounds([
    ...passes.map((p): [number, number] => [p.lat, p.lon]),
    ...tours.flatMap((t) =>
      t.waypoints.map((w): [number, number] => [w.lat, w.lon]),
    ),
  ]);

test("the frame around every road and loop still opens at a readable zoom", () => {
  const zoom = fitZoom(everything());
  expect(zoom, `opens at zoom ${zoom.toFixed(2)}`).toBeGreaterThanOrEqual(
    MIN_OPENING_ZOOM,
  );
});

test("the Vosges and the Jura fit inside that line, the Pyrenees would not", () => {
  const today = everything();
  const corners = (b: Bounds): [number, number][] => [
    [b[1], b[0]],
    [b[3], b[2]],
  ];
  // The two ranges' spans from the plan, added to today's roads.
  const withVosgesAndJura = bounds([
    ...corners(today),
    [48.7, 6.8],
    [45.9, 5.5],
  ]);
  expect(fitZoom(withVosgesAndJura)).toBeGreaterThanOrEqual(MIN_OPENING_ZOOM);
  // Tourmalet and the Basque cols, 600 km to the south-west.
  const withPyrenees = bounds([...corners(today), [42.9, -1.5]]);
  expect(fitZoom(withPyrenees)).toBeLessThan(MIN_OPENING_ZOOM);
});
