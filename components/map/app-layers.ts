/**
 * Everything the map is painted with, as functions of the theme tokens and
 * the device: the app's own layers, the base stack under them, the hillshade
 * between the two, and the canvas icons the symbol layers point at.
 *
 * It sits beside `pass-map.tsx` rather than inside it because none of it is
 * about a running map: a colour read from the document and a `MapEnvironment`
 * go in, a layer list comes out. That is what lets a scheme change re-apply
 * every paint property from the same definition the style was built from –
 * the alternative is a second, drifting copy of each expression in an effect.
 * The two functions that do touch a map handle (`addIcons`, `applyBase`) add
 * and remove; they decide nothing the core has not decided already.
 */
import type {
  ExpressionSpecification,
  LayerSpecification,
  Map as MLMap,
} from "maplibre-gl";

import { OVERLAYS } from "@/components/map/map-style";
import { BASEMAP_ID, basemapLayers, FONT_BOLD } from "@/lib/basemap";
import type { Lang } from "@/lib/i18n";
import {
  LAYERS,
  ROUTE_DASH,
  OVERLAY,
  PASS_LABELS,
  passLabelId,
  SOURCE,
} from "@/lib/layer-ids";
import { PALETTE } from "@/lib/palette";
import type { Scheme } from "@/lib/palette";
import { DESTINATION_MAX_ZOOM, prominenceFilter } from "@/lib/prominence";
import { STATUSES } from "@/lib/regions";
import type { MapEnvironment } from "@/lib/use-media-query";

/**
 * The tour hatch, in multiples of the line width – so on a band this wide the
 * numbers have to be well below 1 to read as a texture at all. Widen the band
 * and the dashes lengthen with it unless these come down to match.
 */
const DASH = [0.45, 0.35];
/** The first layer above the base stack: where the basemap's lines and labels go. */
const ABOVE_BASE = `ov-${OVERLAYS[0].id}`;

/**
 * What the pointer may aim at, in pixels. A pass dot is 5 to 15 px across, a
 * town disc about 14, an ascent line 3.5 wide – targets that a finger cannot
 * hit and that a mouse only hits when the map stands still. Every kind
 * therefore carries a transparent hit area on top of its mark: about a 44 px
 * target on touch, roughly half of that with a mouse, where aiming is precise
 * and the marks sit denser on screen. Deliberately not larger: the areas
 * overlap heavily as it is, and the wider they get the more often one mark
 * answers for its neighbour.
 */
const HIT_RADIUS = 22;
const HIT_RADIUS_FINE = 13;
const HIT_WIDTH = 32;
const HIT_WIDTH_FINE = 18;
/** How far a hit area reaches beyond a mark that is drawn wider than the floor. */
const HIT_MARGIN = 6;

/**
 * Normalises any CSS colour (oklch, lab, color-mix …) to an rgb/rgba string.
 * Browsers hand back computed custom properties in `lab()` notation, which
 * MapLibre cannot parse; painting one pixel and reading it back yields sRGB.
 */
const toRgb = (color: string, fallback: string): string => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback;
  const sentinel = "#010203";
  ctx.fillStyle = sentinel;
  ctx.fillStyle = color;
  // An unparseable value leaves the previous fillStyle untouched.
  if (ctx.fillStyle === sentinel) return fallback;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return a === 255
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${((a ?? 0) / 255).toFixed(3)})`;
};

/** Read colour values from the theme tokens – MapLibre cannot use CSS variables. */
export const readColors = (el: HTMLElement) => {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => {
    const raw = s.getPropertyValue(name).trim();
    return raw ? toRgb(raw, fallback) : fallback;
  };
  return {
    accent: v("--accent", "#e8a33d"),
    area: v("--area", "#5b86c4"),
    closed: v("--status-closed", "#c43d3d"),
    ink: v("--foreground", "#1b2430"),
    open: v("--status-open", "#2e8b57"),
    paper: v("--card", "#ffffff"),
    risky: v("--status-risky", "#d9932a"),
    town: v("--town", "#1f4e79"),
    /**
     * A road whose status is not known – an ascent whose feature state has not
     * arrived yet. The muted token rather than a grey spelled out here: it is
     * the one the rest of the app says "no answer" in, and it follows the OS
     * scheme with everything else.
     */
    unknown: v("--muted-foreground", "#888888"),
  };
};

/** Paints one icon on a fresh canvas and returns its pixels. */
const draw = (
  paint: (ctx: CanvasRenderingContext2D, s: number) => void,
  size = 48,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  paint(ctx, size);
  return ctx.getImageData(0, 0, size, size);
};

/**
 * A town: a disc in the town colour inside a ring. No glyph in it – at the
 * size a town mark has on this map a pictogram is a smudge, and the ring
 * plus the colour already separate it from a pass dot. Only the ring changes
 * – paper for a plain town, accent for a favourite, ink for the selected one
 * – so a town keeps one silhouette at every zoom.
 */
const townIcon = (c: Colors, ring: string) =>
  draw((ctx, s) => {
    const r = s * 0.3;
    ctx.translate(s / 2, s / 2);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = c.town;
    ctx.fill();
    ctx.lineWidth = s * 0.08;
    ctx.strokeStyle = c.paper;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r + s * 0.115, 0, Math.PI * 2);
    ctx.lineWidth = s * 0.07;
    ctx.strokeStyle = ring;
    ctx.stroke();
  });

/** Star as a canvas icon so that no font glyphs are needed. */
export const addIcons = (map: MLMap, c: ReturnType<typeof readColors>) => {
  const star = (fill: string, stroke: string) =>
    draw((ctx, s) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = (i % 2 ? 0.46 : 1) * s * 0.42;
        ctx.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = s * 0.07;
      ctx.lineJoin = "round";
      ctx.strokeStyle = stroke;
      ctx.stroke();
    });

  // Repainted on a scheme change: the strokes are paper and ink, which flip.
  const add = (id: string, data: ImageData) => {
    if (map.hasImage(id)) map.updateImage(id, data);
    else map.addImage(id, data, { pixelRatio: 2 });
  };
  for (const k of STATUSES) {
    add(`star-${k}-0`, star(c[k], c.paper));
    add(`star-${k}-1`, star(c[k], c.ink));
  }
  add("town", townIcon(c, c.paper));
  add("town-fav", townIcon(c, c.accent));
  add("town-sel", townIcon(c, c.ink));
};

type Colors = ReturnType<typeof readColors>;

// Lighter on the light map: over a flat land tone the shading is the only
// texture, and at 0.3 it turns the whole range grey.
export const hillshadePaint = (s: Scheme) => ({
  "hillshade-exaggeration": s === "dark" ? 0.3 : 0.2,
  "hillshade-highlight-color": PALETTE[s].highlight,
  "hillshade-shadow-color": PALETTE[s].shade,
});

/** The hillshade over the base: the DEM stays, its tones follow the scheme. */
export const hillshadeLayer = (
  s: Scheme,
  visible: boolean,
): LayerSpecification => ({
  id: "hillshade",
  layout: { visibility: visible ? "visible" : "none" },
  paint: hillshadePaint(s),
  source: "dem",
  type: "hillshade",
});

/**
 * The bottom of the stack: either the generated vector map – its fills below
 * the hillshade, its lines and labels above it – or one raster layer below.
 */
export const baseStack = (
  id: string,
  s: Scheme,
  lang: Lang,
): { ground: LayerSpecification[]; detail: LayerSpecification[] } =>
  id === BASEMAP_ID
    ? basemapLayers(s, lang)
    : { detail: [], ground: [{ id: "base", source: id, type: "raster" }] };

/** Swaps the base under a running map; everything above it stays put. */
export const applyBase = (m: MLMap, id: string, s: Scheme, lang: Lang) => {
  for (const l of m.getStyle().layers)
    if (l.id === "base" || l.id.startsWith("base-")) m.removeLayer(l.id);
  const { ground, detail } = baseStack(id, s, lang);
  for (const l of ground) m.addLayer(l, "hillshade");
  for (const l of detail) m.addLayer(l, ABOVE_BASE);
};

/**
 * The app's own layers, painted with the live tokens. A pure function of the
 * colours and the environment, so a scheme change re-applies every paint
 * property from the same definition the style was built from.
 */
export const appLayers = (
  colors: Colors,
  env: MapEnvironment,
): LayerSpecification[] => {
  const coarse = env.coarsePointer;
  /**
   * A transparent line under a drawn one, as wide as the pointer needs. It
   * carries the same filter as its visible twin (set in the effects below), so
   * a hidden tour stays out of hit-testing.
   */
  const hitLine = (id: string, source: string): LayerSpecification => ({
    id,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": colors.ink,
      "line-opacity": 0,
      "line-width": coarse ? HIT_WIDTH : HIT_WIDTH_FINE,
    },
    source,
    type: "line",
  });
  /**
   * The same for a mark: one disc per point, in screen pixels (the default
   * viewport alignment), so a tilted map does not shrink the target.
   */
  const hitPoint = (
    id: string,
    source: string,
    /** Where the drawn mark grows with the zoom, the area has to grow with it. */
    radius: number | ExpressionSpecification = coarse
      ? HIT_RADIUS
      : HIT_RADIUS_FINE,
  ): LayerSpecification => ({
    id,
    paint: {
      "circle-color": colors.ink,
      "circle-opacity": 0,
      "circle-radius": radius,
    },
    source,
    type: "circle",
  });
  /**
   * The status colours, keyed by wherever the status is kept.
   *
   * A pass dot reads it off the feature – the point source is rewritten
   * whenever the half-month changes – and an ascent off its feature state,
   * because the geometry is a static file that must never be re-uploaded. Two
   * lookups, one ladder: the arms come from `STATUSES`, so a fourth status
   * is one entry in `lib/status.ts` rather than two expressions here.
   */
  const statusBy = (where: ExpressionSpecification) =>
    [
      "match",
      where,
      ...STATUSES.flatMap((s) => [s, colors[s]]),
      colors.unknown,
    ] as never;
  const statusColor = statusBy(["get", "status"]);
  // The ascent and tour lines carry status and selection as feature state,
  // so a period, filter or selection change never re-uploads geometry.
  const selected = ["==", ["feature-state", "selected"], 1];
  const hoveredLine = ["==", ["feature-state", "hovered"], 1];
  /**
   * The radius of a pass dot, by zoom and fame. With a `hit` floor it becomes
   * the dot's hit area instead: never below that floor, and always a margin
   * wider than the dot, which on a famous pass at close zoom is as wide as the
   * floor itself. One interpolate rather than a `max` around it, because a
   * `zoom` expression may only be the input of a top-level interpolate.
   */
  const passRadius = (hit = 0): ExpressionSpecification => {
    const stop = (base: number, perFame: number): ExpressionSpecification => {
      const r: ExpressionSpecification = [
        "+",
        base + (hit ? HIT_MARGIN : 0),
        ["*", perFame, ["get", "fame"]],
      ];
      return hit ? ["max", hit, r] : r;
    };
    return [
      "interpolate",
      ["linear"],
      ["zoom"],
      6,
      stop(2, 1.1),
      12,
      stop(4, 1.8),
    ];
  };
  const isSelected = ["==", ["get", "selected"], 1] as const;
  const isFavorite = ["==", ["get", "favorite"], 1] as const;
  /**
   * One pass dot: status by hue, closure by hollowness, fame by size and
   * weight. Shared by the pass layer and the hovered mark, which is the same
   * dot drawn from another source.
   */
  /** An unpaved road's dot and line (plan 27): a ring, and a dash over the line. */
  const isUnpavedDot: ExpressionSpecification = [
    "!=",
    ["get", "surface"],
    "asphalt",
  ];
  const passPaint = {
    // "closed" is additionally encoded as a hollow circle so that the
    // three states do not rely on hue alone.
    "circle-color": [
      "case",
      ["==", ["get", "status"], "closed"],
      colors.paper,
      statusColor,
    ],
    "circle-opacity": [
      "case",
      [">=", ["get", "fame"], 4],
      0.95,
      ["==", ["get", "fame"], 3],
      0.8,
      0.62,
    ],
    "circle-pitch-alignment": "map",
    "circle-radius": passRadius(),
    "circle-stroke-color": [
      "case",
      isSelected,
      colors.ink,
      ["==", ["get", "status"], "closed"],
      colors.closed,
      // An unpaved road: a dark ring, the dot's own colour still the status.
      isUnpavedDot,
      colors.ink,
      colors.paper,
    ],
    "circle-stroke-width": [
      "case",
      isSelected,
      3,
      ["==", ["get", "status"], "closed"],
      2.5,
      isUnpavedDot,
      2,
      1.5,
    ],
  } as never;
  const routeColor = statusBy([
    "coalesce",
    ["feature-state", "status"],
    "none",
  ]);
  /**
   * A pixel width for the tour lines: it grows with the zoom and again while
   * the tour is selected. The zoom interpolation has to sit at the very top of
   * the expression – MapLibre accepts `["zoom"]` only as the input of the
   * outermost stop function – so the selection case goes inside the stops
   * rather than as a factor around them.
   */
  const tourWidth = (near: number, far: number) =>
    [
      "interpolate",
      ["linear"],
      ["zoom"],
      6,
      ["case", selected, near * 1.3, hoveredLine, near * 1.15, near],
      13,
      ["case", selected, far * 1.3, hoveredLine, far * 1.15, far],
    ] as never;
  // Wide enough to hold the widest ascent it can carry – a selected one, at 6
  // – and still reach past it on both sides.
  const tourLine = tourWidth(9, 12);

  const isDestinationLit: ExpressionSpecification = [
    "any",
    ["==", ["get", "selected"], 1],
    ["==", ["get", "hovered"], 1],
  ];

  return [
    // The destinations: the outline of where each area's riding is – its
    // roads, their ascents and its towns (`DestinationMembers.outline`) – at
    // the very bottom of the stack (plan 12), in the area colour: the town's
    // blue family, because an area is where one stays, and never a status
    // colour, because red to green is what a road's rideability is said in.
    // The rideable count is the label's line, not a tint.
    //
    // It stays at every zoom – an area that vanished while zooming into it
    // read as a bug. Only its weight changes: the fill thins out towards
    // `DESTINATION_MAX_ZOOM`, where every road is drawn and would be veiled
    // by it, and the edge steps back to a hairline; the selected or hovered
    // area keeps its full weight.
    //
    // `["zoom"]` may only feed a top-level `interpolate`, so the zoom is the
    // outer expression and what differs per feature sits in its stops.
    {
      id: LAYERS.destination.mark,
      paint: {
        "fill-color": colors.area,
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          DESTINATION_MAX_ZOOM - 1,
          ["case", isDestinationLit, 0.16, 0.06],
          DESTINATION_MAX_ZOOM + 1,
          ["case", isDestinationLit, 0.1, 0.02],
        ],
      },
      source: SOURCE.destinations,
      type: "fill",
    },
    {
      id: LAYERS.destination.companions[0],
      paint: {
        "line-color": colors.area,
        // `line-opacity` rather than the layer's: the lit edge keeps its
        // weight while the others step back, which is a per-feature
        // difference. Two outlines cross at a point, not along a hairpin, so
        // the double composite the rule guards against is two pixels wide.
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          DESTINATION_MAX_ZOOM - 1,
          ["case", isDestinationLit, 0.9, 0.45],
          DESTINATION_MAX_ZOOM + 1,
          ["case", isDestinationLit, 0.9, 0.3],
        ],
        "line-width": ["case", ["==", ["get", "selected"], 1], 2, 1],
      },
      source: SOURCE.destinations,
      type: "line",
    },
    {
      // At every zoom too: it is the last group `pick` asks, so a road, a
      // town or a label inside the area still wins its click.
      id: LAYERS.destination.hit,
      paint: { "fill-color": colors.ink, "fill-opacity": 0 },
      source: SOURCE.destinations,
      type: "fill",
    },
    // The area one town reaches, drawn while it is hovered: the hull over
    // its passes (lib/nearby.ts). Bottom of the app's stack, so
    // every line and dot stays readable on top of it.
    {
      id: OVERLAY.hull,
      paint: { "fill-color": colors.town, "fill-opacity": 0.12 },
      source: SOURCE.reach,
      type: "fill",
    },
    {
      id: OVERLAY.hullEdge,
      paint: {
        "line-color": colors.town,
        "line-dasharray": [3, 2],
        "line-opacity": 0.7,
        "line-width": 1.5,
      },
      source: SOURCE.reach,
      type: "line",
    },
    hitLine(LAYERS.tour.hit, SOURCE.tours),
    hitLine(LAYERS.route.hit, SOURCE.routes),
    // A tour is the union of several ascents – the Sellaronda *is* its four
    // passes – so it is drawn as what it is: a band wide enough to hold them,
    // laid *under* the ascents so it reaches past them on both sides. What a
    // tour contains is then read from the map rather than from the list.
    //
    // Translucent, so the hillshade and the roads keep showing through a band
    // that covers a lot of ground, and hatched rather than solid, so it is
    // told apart from an ascent by texture and not only by weight – a tour is
    // the looser of the two marks, which is the right order: the ascent is
    // the rated thing. The hatch is short and tight on purpose; a wide line
    // with long dashes reads as a chain of blocks rather than as a texture.
    //
    // `line-layer-opacity`, not `line-opacity`: the latter is applied per
    // feature, so where a hairpin runs MapLibre's triangle strip over itself
    // the overlap composites twice and shows as a blotch. The layer property
    // flattens the whole layer to one surface first and composites that once,
    // which is what makes a translucent band usable in switchbacks at all.
    {
      id: LAYERS.tour.mark,
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-dasharray": DASH,
        "line-layer-opacity": 0.62,
        "line-width": tourLine,
      },
      source: SOURCE.tours,
      type: "line",
    },
    // The ascent, on top of the band that holds it: solid and opaque, because
    // the status colour is the stronger signal and must not be tinted by the
    // tour it belongs to.
    {
      id: LAYERS.route.mark,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": routeColor,
        // Hover is the lighter of the two states, so it must not reach the
        // width a selection has: pointing at a row says "this one", opening
        // it says "this one, and here is everything about it".
        "line-width": ["case", selected, 6, hoveredLine, 5, 3.5],
      },
      source: SOURCE.routes,
      type: "line",
    },
    // The dash over an unpaved ascent, in the paper colour so the status
    // colour of the line shows through the gaps: `line-dasharray` is not
    // data-driven, so the layer is the split – painted transparent on
    // asphalt, and it carries the route filter like the line under it.
    {
      id: ROUTE_DASH,
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": [
          "case",
          ["==", ["get", "surface"], "asphalt"],
          "transparent",
          colors.paper,
        ],
        "line-dasharray": [1.5, 1.5],
        "line-width": ["case", selected, 2.5, hoveredLine, 2, 1.5],
      },
      source: SOURCE.routes,
      type: "line",
    },
    {
      id: LAYERS.tour.labels[0],
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 600,
        "text-field": ["get", "name"],
        "text-font": [FONT_BOLD],
        "text-size": 11,
      },
      paint: {
        "text-color": ["get", "color"],
        "text-halo-color": colors.paper,
        "text-halo-width": 1.5,
      },
      source: SOURCE.tours,
      type: "symbol",
    },
    hitPoint(LAYERS.town.hit, SOURCE.towns),
    {
      ...hitPoint(
        LAYERS.pass.hit,
        SOURCE.passes,
        passRadius(coarse ? HIT_RADIUS : HIT_RADIUS_FINE),
      ),
      // The hit area follows the rule the dot follows, or a hidden pass still
      // answers the pointer; a favourite is drawn as a star at every zoom.
      filter: prominenceFilter((minFame) =>
        minFame === null
          ? true
          : ["any", isSelected, isFavorite, [">=", ["get", "fame"], minFame]],
      ) as never,
    },
    // Below the passes: MapLibre places labels from the top of the style
    // down, so a pass label wins the collision against a town name. The
    // passes are what the map is read for; the town is the answer to the
    // second question, not the first.
    {
      id: LAYERS.town.mark,
      layout: {
        "icon-allow-overlap": true,
        "icon-image": [
          "case",
          ["==", ["get", "selected"], 1],
          "town-sel",
          ["==", ["get", "favorite"], 1],
          "town-fav",
          "town",
        ],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.6, 13, 0.85],
      },
      source: SOURCE.towns,
      type: "symbol",
    },
    {
      id: LAYERS.town.labels[0],
      layout: {
        "text-field": ["get", "name"],
        "text-font": [FONT_BOLD],
        "text-justify": "auto",
        "text-radial-offset": 1,
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 12, 13, 14],
        "text-variable-anchor": ["left", "right", "top", "bottom"],
      },
      minzoom: 8,
      paint: {
        "text-color": colors.town,
        "text-halo-color": colors.paper,
        "text-halo-width": 2,
      },
      source: SOURCE.towns,
      type: "symbol",
    },
    {
      // The overview draws by fame (`lib/prominence.ts`): the famous passes
      // at every zoom, the known ones from 7.5, everything from 8.5. What is
      // selected is always drawn; a favourite is a star, in the layer below.
      filter: prominenceFilter((minFame) => [
        "all",
        ["!=", ["get", "favorite"], 1],
        ...(minFame === null
          ? []
          : [["any", isSelected, [">=", ["get", "fame"], minFame]]]),
      ]) as never,
      id: LAYERS.pass.mark,
      paint: passPaint,
      source: SOURCE.passes,
      type: "circle",
    },
    // The hovered pass, drawn again from its own one-feature source: at a
    // zoom where the rule hides its dot, a row hovered in the list would
    // otherwise ring an empty patch of map. Where the dot is drawn anyway the
    // two coincide exactly.
    {
      filter: [
        "all",
        ["==", ["get", "kind"], "pass"],
        ["!=", ["get", "favorite"], 1],
      ],
      id: OVERLAY.mark,
      paint: passPaint,
      source: SOURCE.hover,
      type: "circle",
    },
    {
      filter: ["==", ["get", "favorite"], 1],
      id: "pass-stars",
      layout: {
        "icon-allow-overlap": true,
        "icon-image": [
          "concat",
          "star-",
          ["get", "status"],
          "-",
          ["to-string", ["get", "selected"]],
        ],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 12, 0.9],
      },
      source: SOURCE.passes,
      type: "symbol",
    },
    // Labels staggered by prominence; MapLibre resolves collisions
    // The area's name over its centre, with the count under it, at every
    // zoom like its outline. A point of its own rather than the outline's: a polygon is labelled
    // once per tile it crosses. Below the pass labels in the list, so
    // MapLibre places the pass names first: a famous pass wins its collision
    // against the area it lies in.
    {
      id: LAYERS.destination.labels[0],
      layout: {
        "symbol-sort-key": ["-", 1, ["get", "share"]] as never,
        "text-field": [
          "format",
          ["get", "name"],
          {},
          "\n",
          {},
          ["get", "text"],
          { "font-scale": 0.8 },
        ] as never,
        "text-font": [FONT_BOLD],
        "text-line-height": 1.25,
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          11,
          8,
          13,
        ] as never,
      },
      paint: {
        // The towns' blue rather than the ink: an area's name is the quiet
        // voice under the road names, in the family its outline is drawn in.
        "text-color": colors.town,
        "text-halo-color": colors.paper,
        "text-halo-width": 1.5,
        // The name stays too; past the overview the pass names win their
        // collisions against it (they are placed first, see below).
        "text-opacity": 0.85,
      },
      source: SOURCE.destinationLabels,
      type: "symbol",
    },
    ...PASS_LABELS.map(({ fame, minzoom }) => ({
      filter:
        fame === 5
          ? ([
              "any",
              ["==", ["get", "fame"], 5],
              ["==", ["get", "selected"], 1],
              ["==", ["get", "favorite"], 1],
            ] as never)
          : ([
              "all",
              ["==", ["get", "fame"], fame],
              ["!=", ["get", "selected"], 1],
              ["!=", ["get", "favorite"], 1],
            ] as never),
      id: passLabelId(fame),
      layout: {
        "symbol-sort-key": ["-", 6, ["get", "fame"]] as never,
        "text-field": ["get", "name"] as never,
        "text-font": [FONT_BOLD],
        "text-justify": "auto" as never,
        "text-radial-offset": 1,
        "text-size": fame >= 5 ? 13 : fame <= 2 ? 11 : 12.5,
        "text-variable-anchor": ["left", "right", "top", "bottom"] as never,
      },
      minzoom,
      paint: {
        "text-color": colors.ink,
        "text-halo-color": colors.paper,
        "text-halo-width": 1.6,
        "text-opacity": fame <= 2 ? 0.85 : 1,
      },
      source: SOURCE.passes,
      type: "symbol" as const,
    })),
    /**
     * What the pointer is over, wherever the pointer is. A ring rather than a
     * change to the mark itself: a pass dot is 5–15 px across and already
     * carries three things (status by hue, closure by hollowness, fame by
     * size), so there is nothing left in it to spend on a fourth state –
     * and a ring around it reads at any of those sizes. It is its own
     * one-feature source, so hovering never rewrites the source with every pass in it.
     */
    {
      id: OVERLAY.ring,
      paint: {
        "circle-color": "transparent",
        "circle-opacity": 0,
        "circle-pitch-alignment": "map",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 9, 12, 16],
        "circle-stroke-color": colors.accent,
        "circle-stroke-opacity": 0.9,
        "circle-stroke-width": 3,
      },
      source: SOURCE.hover,
      type: "circle",
    },
    // Topmost: the profile cursor must stay visible over its own ascent.
    {
      id: OVERLAY.cursor,
      paint: {
        "circle-color": colors.paper,
        "circle-pitch-alignment": "map",
        "circle-radius": 6,
        "circle-stroke-color": colors.ink,
        "circle-stroke-width": 2.5,
      },
      source: SOURCE.cursor,
      type: "circle",
    },
  ] as LayerSpecification[];
};
