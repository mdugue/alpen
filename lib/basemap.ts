import type {
  ExpressionSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

import { PALETTE } from "@/lib/palette";
import type { Scheme } from "@/lib/palette";

/**
 * The default basemap: a vector style in the app's own palette, one variant
 * per colour scheme (docs/plans/06-basemap.md).
 *
 * The tiles come from OpenFreeMap (OpenMapTiles schema, no key, no account);
 * the style is generated here so that land, water, roads and labels are quiet
 * enough for the status and tour colours to dominate, and so that dark mode
 * gets a dark map. `components/map/pass-map.tsx` composes these layers with
 * its own; `scripts/build-map-style.ts` writes the same thing as two complete
 * style files under `public/map` for tuning in a style editor.
 *
 * Layer stack, bottom to top (the app's layers in brackets):
 *
 *   ground   land · built-up · wood · glacier · water
 *   [hillshade from the Terrarium DEM, low exaggeration]
 *   detail   rivers · borders · roads (minor at ≥ 11, casing at ≥ 10)
 *            road names (≥ 12) · lake names · peaks with elevation (≥ 10)
 *            villages · towns · cities · regions · countries
 *   [overlays · tours · ascents · towns · passes · labels · profile cursor]
 *
 * The hillshade sits between the two groups: it models the land without
 * greying the roads and labels on top. Labels prefer `name:de`, then the
 * Latin transliteration OpenMapTiles carries for every name, then the local
 * name – so the Latin glyph ranges under `public/map/fonts` are all a label
 * ever needs (a glyph outside them is drawn locally by MapLibre).
 */

/** Which base is the generated one; the raster alternatives keep their own ids. */
export const BASEMAP_ID = "karte";

export const BASEMAP_SOURCE: SourceSpecification = {
  attribution:
    '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a>, Daten von <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  type: "vector",
  url: "https://tiles.openfreemap.org/planet",
};

/** The one source every generated layer draws from. */
export const BASEMAP_SOURCE_ID = "openmaptiles";

/**
 * Glyphs are served from `public/map/fonts` (scripts/build-glyphs.ts): the
 * Latin ranges of Inter, the family the rest of the app is set in. The
 * names are directories there; SemiBold is the weight the UI uses for
 * emphasis, and the one the pass labels had before.
 */
export const GLYPHS = "/map/fonts/{fontstack}/{range}.pbf";
export const FONT_REGULAR = "Inter Regular";
export const FONT_ITALIC = "Inter Italic";
export const FONT_BOLD = "Inter SemiBold";

/** German name where OpenStreetMap has one, else the Latin spelling. */
const NAME: ExpressionSpecification = [
  "coalesce",
  ["get", "name:de"],
  ["get", "name:latin"],
  ["get", "name"],
];

const isPolygon: ExpressionSpecification = [
  "match",
  ["geometry-type"],
  ["Polygon", "MultiPolygon"],
  true,
  false,
];

const classIn = (classes: string[]): ExpressionSpecification => [
  "match",
  ["get", "class"],
  classes,
  true,
  false,
];

/** Line width by zoom, exponential so it grows with the road. */
const width = (
  stops: [number, number][],
  base = 1.4,
): ExpressionSpecification => [
  "interpolate",
  ["exponential", base],
  ["zoom"],
  ...stops.flat(),
];

const linear = (stops: [number, number][]): ExpressionSpecification => [
  "interpolate",
  ["linear"],
  ["zoom"],
  ...stops.flat(),
];

/** The layers before the hillshade: fills only. */
const groundLayers = (scheme: Scheme): LayerSpecification[] => {
  const p = PALETTE[scheme];
  return [
    {
      id: "base-land",
      paint: { "background-color": p.land },
      type: "background",
    },
    {
      filter: [
        "all",
        isPolygon,
        classIn([
          "residential",
          "suburb",
          "neighbourhood",
          "commercial",
          "industrial",
          "retail",
        ]),
      ],
      id: "base-built",
      minzoom: 8,
      paint: {
        "fill-color": p.built,
        "fill-opacity": linear([
          [8, 0.5],
          [12, 1],
        ]),
      },
      source: BASEMAP_SOURCE_ID,
      "source-layer": "landuse",
      type: "fill",
    },
    {
      filter: ["all", isPolygon, ["==", ["get", "class"], "wood"]],
      id: "base-wood",
      minzoom: 5,
      paint: {
        "fill-antialias": false,
        "fill-color": p.wood,
        "fill-opacity": linear([
          [6, 0.5],
          [11, 0.9],
        ]),
      },
      source: BASEMAP_SOURCE_ID,
      "source-layer": "landcover",
      type: "fill",
    },
    {
      filter: [
        "all",
        isPolygon,
        [
          "any",
          ["==", ["get", "subclass"], "glacier"],
          ["==", ["get", "class"], "ice"],
        ],
      ],
      id: "base-glacier",
      minzoom: 5,
      paint: {
        "fill-antialias": false,
        "fill-color": p.glacier,
        "fill-opacity": 0.85,
      },
      source: BASEMAP_SOURCE_ID,
      "source-layer": "landcover",
      type: "fill",
    },
    {
      filter: ["all", isPolygon, ["!=", ["get", "brunnel"], "tunnel"]],
      id: "base-water",
      paint: { "fill-color": p.water },
      source: BASEMAP_SOURCE_ID,
      "source-layer": "water",
      type: "fill",
    },
  ];
};

/** The layers after the hillshade: lines and labels. */
const detailLayers = (scheme: Scheme): LayerSpecification[] => {
  const p = PALETTE[scheme];
  const halo = { "text-halo-color": p.land, "text-halo-width": 1.3 };
  const road = (
    id: string,
    classes: string[],
    minzoom: number,
    stops: [number, number][],
  ): LayerSpecification => ({
    filter: classIn(classes),
    id: `base-road-${id}`,
    layout: { "line-cap": "round", "line-join": "round" },
    minzoom,
    paint: { "line-color": p.road, "line-width": width(stops) },
    source: BASEMAP_SOURCE_ID,
    "source-layer": "transportation",
    type: "line",
  });
  const place = (
    id: string,
    cls: string,
    minzoom: number,
    size: ExpressionSpecification | number,
    extra: Partial<Extract<LayerSpecification, { type: "symbol" }>> = {},
  ): LayerSpecification => ({
    filter: ["==", ["get", "class"], cls],
    id: `base-place-${id}`,
    layout: {
      "text-field": NAME,
      "text-font": [FONT_REGULAR],
      "text-max-width": 8,
      "text-size": size,
      ...extra.layout,
    },
    minzoom,
    paint: { "text-color": p.label, ...halo, ...extra.paint },
    source: BASEMAP_SOURCE_ID,
    "source-layer": "place",
    type: "symbol",
    ...(extra.maxzoom === undefined ? {} : { maxzoom: extra.maxzoom }),
  });

  return [
    {
      filter: classIn(["river", "canal"]),
      id: "base-waterway",
      layout: { "line-cap": "round", "line-join": "round" },
      minzoom: 9,
      paint: {
        "line-color": p.water,
        "line-width": width([
          [9, 0.6],
          [14, 2.2],
          [18, 6],
        ]),
      },
      source: BASEMAP_SOURCE_ID,
      "source-layer": "waterway",
      type: "line",
    },
    {
      filter: [
        "all",
        ["==", ["get", "admin_level"], 2],
        ["!=", ["get", "maritime"], 1],
        ["!=", ["get", "disputed"], 1],
      ],
      id: "base-boundary",
      layout: { "line-join": "round" },
      paint: {
        "line-color": p.boundary,
        "line-dasharray": [3, 2],
        "line-width": linear([
          [3, 0.8],
          [10, 1.6],
        ]),
      },
      source: BASEMAP_SOURCE_ID,
      "source-layer": "boundary",
      type: "line",
    },
    // Roads, thin and neutral: the mountain roads that matter are the app's
    // own lines. Minor roads only from zoom 11, where a village has streets.
    {
      filter: classIn(["motorway", "trunk", "primary", "secondary"]),
      id: "base-road-casing",
      layout: { "line-cap": "round", "line-join": "round" },
      minzoom: 10,
      paint: {
        "line-color": p.roadCasing,
        "line-width": width([
          [10, 2.4],
          [14, 4.2],
          [18, 14],
        ]),
      },
      source: BASEMAP_SOURCE_ID,
      "source-layer": "transportation",
      type: "line",
    },
    road("minor", ["minor"], 11, [
      [11, 0.5],
      [14, 1.2],
      [18, 5],
    ]),
    road("tertiary", ["tertiary"], 9.5, [
      [9.5, 0.6],
      [14, 1.8],
      [18, 7],
    ]),
    road("primary", ["primary", "secondary"], 7.5, [
      [7.5, 0.6],
      [10, 1.2],
      [14, 2.6],
      [18, 10],
    ]),
    road("motorway", ["motorway", "trunk"], 6, [
      [6, 0.7],
      [10, 1.6],
      [14, 3],
      [18, 11],
    ]),
    {
      filter: classIn([
        "motorway",
        "trunk",
        "primary",
        "secondary",
        "tertiary",
      ]),
      id: "base-road-label",
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 400,
        "text-field": NAME,
        "text-font": [FONT_REGULAR],
        "text-rotation-alignment": "map",
        "text-size": 11,
      },
      minzoom: 12,
      paint: { "text-color": p.labelMuted, ...halo },
      source: BASEMAP_SOURCE_ID,
      "source-layer": "transportation_name",
      type: "symbol",
    },
    {
      filter: [
        "match",
        ["geometry-type"],
        ["Point", "MultiPoint"],
        true,
        false,
      ],
      id: "base-water-label",
      layout: {
        "text-field": NAME,
        "text-font": [FONT_ITALIC],
        "text-letter-spacing": 0.1,
        "text-max-width": 6,
        "text-size": linear([
          [8, 10],
          [13, 13],
        ]),
      },
      minzoom: 8,
      paint: { "text-color": p.labelWater, ...halo },
      source: BASEMAP_SOURCE_ID,
      "source-layer": "water_name",
      type: "symbol",
    },
    // Peaks with their elevation: orientation, not data – the pass points
    // are the app's own and carry their own labels.
    {
      filter: [
        "all",
        classIn(["peak", "volcano"]),
        ["has", "name"],
        ["has", "ele"],
      ],
      id: "base-peak",
      layout: {
        "symbol-sort-key": ["get", "rank"],
        "text-anchor": "top",
        "text-field": [
          "concat",
          NAME,
          "\n",
          [
            "number-format",
            ["get", "ele"],
            { locale: "de-DE", "max-fraction-digits": 0 },
          ],
          " m",
        ],
        "text-font": [FONT_ITALIC],
        "text-max-width": 7,
        "text-offset": [0, 0.3],
        "text-size": 10.5,
      },
      minzoom: 10,
      paint: { "text-color": p.labelMuted, ...halo },
      source: BASEMAP_SOURCE_ID,
      "source-layer": "mountain_peak",
      type: "symbol",
    },
    place("village", "village", 10, 11),
    place(
      "town",
      "town",
      8,
      linear([
        [8, 11],
        [12, 14],
      ]),
    ),
    place(
      "city",
      "city",
      5,
      linear([
        [5, 12],
        [10, 17],
      ]),
    ),
    place(
      "state",
      "state",
      5,
      linear([
        [5, 10],
        [8, 13],
      ]),
      {
        layout: { "text-letter-spacing": 0.15, "text-transform": "uppercase" },
        maxzoom: 9,
        paint: { "text-color": p.labelMuted },
      },
    ),
    place(
      "country",
      "country",
      3,
      linear([
        [3, 12],
        [7, 16],
      ]),
      {
        layout: { "text-font": [FONT_BOLD], "text-letter-spacing": 0.05 },
        maxzoom: 8,
      },
    ),
  ];
};

/**
 * The basemap's layers in two groups, so the caller can slot its hillshade
 * between them. All ids start with `base-`.
 */
export const basemapLayers = (scheme: Scheme) => ({
  detail: detailLayers(scheme),
  ground: groundLayers(scheme),
});

/** Every layer id of one scheme, in drawing order; identical across schemes. */
export const basemapLayerIds = (scheme: Scheme): string[] => {
  const { ground, detail } = basemapLayers(scheme);
  return [...ground, ...detail].map((l) => l.id);
};

/**
 * A complete, standalone style – what `scripts/build-map-style.ts` writes to
 * `public/map/style-{light,dark}.json`. `glyphs` defaults to the app's own
 * path; a style editor needs it absolute.
 */
export const basemapStyle = (
  scheme: Scheme,
  glyphs: string = GLYPHS,
): StyleSpecification => {
  const { ground, detail } = basemapLayers(scheme);
  return {
    glyphs,
    layers: [...ground, ...detail],
    name: `Alpenpässe ${scheme === "dark" ? "dunkel" : "hell"}`,
    sources: { [BASEMAP_SOURCE_ID]: BASEMAP_SOURCE },
    version: 8,
  };
};
