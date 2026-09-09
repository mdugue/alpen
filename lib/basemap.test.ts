import { describe, expect, test } from "bun:test";

import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";

import {
  BASEMAP_SOURCE_ID,
  basemapLayerIds,
  basemapLayers,
  basemapStyle,
} from "@/lib/basemap";
import { contrast, PALETTE } from "@/lib/palette";
import type { Scheme } from "@/lib/palette";

/** The `source-layer`s OpenFreeMap's TileJSON lists (OpenMapTiles schema). */
const SOURCE_LAYERS = new Set([
  "aerodrome_label",
  "aeroway",
  "boundary",
  "building",
  "housenumber",
  "landcover",
  "landuse",
  "mountain_peak",
  "park",
  "place",
  "poi",
  "transportation",
  "transportation_name",
  "water",
  "water_name",
  "waterway",
]);

const SCHEMES: Scheme[] = ["light", "dark"];

describe("basemapStyle", () => {
  test.each(SCHEMES)("%s is a valid MapLibre style", (scheme) => {
    const errors = validateStyleMin(basemapStyle(scheme));
    expect(errors.map((e) => e.message)).toEqual([]);
  });

  test.each(SCHEMES)(
    "%s: every layer is prefixed, sourced and on a real source layer",
    (scheme) => {
      const { ground, detail } = basemapLayers(scheme);
      for (const l of [...ground, ...detail]) {
        expect(l.id.startsWith("base-")).toBe(true);
        if (l.type === "background") continue;
        expect(l.source).toBe(BASEMAP_SOURCE_ID);
        expect(SOURCE_LAYERS.has(l["source-layer"] ?? "")).toBe(true);
      }
    },
  );

  test("the ground group is fills only, the detail group has none", () => {
    const { ground, detail } = basemapLayers("light");
    expect(
      ground.every((l) => l.type === "background" || l.type === "fill"),
    ).toBe(true);
    expect(detail.some((l) => l.type === "fill")).toBe(false);
  });

  test("both schemes have the same layers in the same order", () => {
    expect(basemapLayerIds("dark")).toEqual(basemapLayerIds("light"));
    expect(new Set(basemapLayerIds("light")).size).toBe(
      basemapLayerIds("light").length,
    );
  });

  test("no road label below zoom 12, no minor road below 11", () => {
    const { detail } = basemapLayers("light");
    const by = (id: string) => detail.find((l) => l.id === id)!;
    expect(by("base-road-label").minzoom).toBeGreaterThanOrEqual(12);
    expect(by("base-road-minor").minzoom).toBeGreaterThanOrEqual(11);
  });
});

describe("palette contrast", () => {
  // WCAG AA for text is 4.5:1; the app's labels sit on a halo of `paper`,
  // the basemap's on a halo of `land`.
  test.each(SCHEMES)("%s: labels against their halo reach AA", (scheme) => {
    const p = PALETTE[scheme];
    expect(contrast(p.ink, p.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.label, p.land)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.labelMuted, p.land)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.labelWater, p.land)).toBeGreaterThanOrEqual(4.5);
  });

  // Lines and markers are graphics, where 3:1 is the bar. The amber of
  // "risky" cannot reach it on a light ground – it is the same amber the
  // whole UI uses – which is why "closed" is also a hollow circle and every
  // marker carries a paper stroke; the check therefore covers the rest.
  test.each(SCHEMES)(
    "%s: status and tour colours stand off the land",
    (scheme) => {
      const p = PALETTE[scheme];
      for (const c of [p.status.open, p.status.closed, p.tour, p.town])
        expect(contrast(c, p.land)).toBeGreaterThanOrEqual(3);
      if (scheme === "dark")
        expect(contrast(p.status.risky, p.land)).toBeGreaterThanOrEqual(3);
    },
  );

  test("the land is a shade off the panels, in both schemes", () => {
    for (const scheme of SCHEMES) {
      const p = PALETTE[scheme];
      expect(p.land).not.toBe(p.paper);
      expect(p.land).not.toBe(p.background);
    }
  });
});
