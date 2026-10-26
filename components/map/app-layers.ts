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
  ROUTE_CASING,
  ROUTE_LINES,
  ROUTE_DASH,
  ROUTE_GHOST,
  OVERLAY,
  PASS_LABELS,
  passLabelId,
  SOURCE,
  TOUR_PARTS,
} from "@/lib/layer-ids";
import { PALETTE } from "@/lib/palette";
import type { Scheme } from "@/lib/palette";
import {
  DESTINATION_MAX_ZOOM,
  OVERVIEW_ZOOM,
  SHORT_NAME_ZOOM,
  SIZE_ZOOMS,
} from "@/lib/prominence";
import { CLASSIC_FAME, STATUSES } from "@/lib/regions";
import type { MapEnvironment } from "@/lib/use-media-query";

/** The image the arrows along a tour are drawn with (`arrowhead`). */
const TOUR_ARROW = "tour-arrow";
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
    closed: v("--status-closed", "#b14e49"),
    ink: v("--foreground", "#1b2430"),
    open: v("--status-open", "#2e8b57"),
    paper: v("--card", "#ffffff"),
    risky: v("--status-risky", "#d9932a"),
    /** Every tour at rest: one quiet tone outside the status colours. */
    tour: v("--tour", "#9b8fb0"),
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

/**
 * The arrowhead along a tour, pointing the way the line runs – which is the way
 * the tour is ridden, because its geometry is routed through the waypoints in
 * order. A signed-distance image, so the symbol layer paints it in each
 * tour's own colour with a paper halo, and a scheme change needs no repaint.
 */
const arrowhead = () =>
  draw((ctx, s) => {
    // A notched arrowhead: filled, because a stroked chevron of this size
    // thins to a hair on a curve.
    ctx.beginPath();
    ctx.moveTo(s * 0.24, s * 0.2);
    ctx.lineTo(s * 0.78, s * 0.5);
    ctx.lineTo(s * 0.24, s * 0.8);
    ctx.lineTo(s * 0.4, s * 0.5);
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.lineWidth = s * 0.06;
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    ctx.fill();
    ctx.stroke();
  });

/** The status stars and the town marks, added once and repainted on a scheme change. */
export const addIcons = (map: MLMap, c: ReturnType<typeof readColors>) => {
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
  if (!map.hasImage(TOUR_ARROW))
    map.addImage(TOUR_ARROW, arrowhead(), { pixelRatio: 2, sdf: true });
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

/** The dot's size at the two zooms it is given at (`SIZE_ZOOMS`), as base + per fame. */
const SIZE = { far: [2, 1.1], near: [4, 1.8] } as const;
/**
 * The two sizes a dot comes in, as the fame its size is computed for: a
 * classic, whatever its status, and every other road. Five steps of fame were
 * five sizes between 5 and 15 px, which nobody tells apart; two say the one
 * thing the size is for – a classic or not.
 */
const DOT_FAME = { classic: 4.5, other: 2 } as const;
/** An ascent's width at rest, by status: rideable widest, closed a thread. */
const ROUTE_WIDTH = { closed: 2, open: 3.5, risky: 2.75 } as const;
/** The lowest label layer's rank: it names every rank at or below it. */
const RANK_FLOOR = PASS_LABELS.at(-1)!.rank;
/** A shadow's radius at the two size zooms, its opacity and its lines': present, not loud. */
const GHOST = { line: 0.28, opacity: 0.5, radius: [2.4, 4.4] } as const;

/** A paint value given at the two size zooms (`SIZE_ZOOMS`) and interpolated between. */
const bySize = (
  far: ExpressionSpecification | number,
  near: ExpressionSpecification | number,
): ExpressionSpecification =>
  [
    "interpolate",
    ["linear"],
    ["zoom"],
    SIZE_ZOOMS.far,
    far,
    SIZE_ZOOMS.near,
    near,
  ] as never;

/**
 * The radius of a pass dot, by zoom and by whether it is a classic
 * (`DOT_FAME`). With a `hit` floor it becomes the dot's hit area instead:
 * never below that floor, always a margin wider than the dot, which on a
 * classic at close zoom is as wide as the floor itself.
 */
const passRadius = (hit = 0): ExpressionSpecification => {
  const at = ([base, perFame]: readonly [number, number]) => {
    const r: ExpressionSpecification = [
      "case",
      [">=", ["get", "fame"], CLASSIC_FAME],
      base + (hit ? HIT_MARGIN : 0) + perFame * DOT_FAME.classic,
      base + (hit ? HIT_MARGIN : 0) + perFame * DOT_FAME.other,
    ];
    return hit ? (["max", hit, r] as ExpressionSpecification) : r;
  };
  return bySize(at(SIZE.far), at(SIZE.near));
};

/**
 * Which status comes first, as a number: rideable before limited before
 * closed (`STATUSES`). The dots are stacked by it and the names placed by
 * it, so where marks crowd the green ones are the ones left to see.
 */
const statusFirst = (offset: number, step: number) =>
  [
    "match",
    ["get", "status"],
    ...STATUSES.flatMap((st, i) => [st, offset + i * step]),
    offset + STATUSES.length * step,
  ] as never;

/**
 * A road not often closed in the half-month: the ones named at rest. On a
 * fine pointer only – a finger has no hover to bring the others' names back,
 * so on a phone every road keeps its name.
 */
const notClosed = (coarse: boolean): ExpressionSpecification =>
  coarse ? ["literal", true] : ["!=", ["get", "status"], "closed"];

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
  const isSelected = ["==", ["get", "selected"], 1] as const;
  /** An unpaved road's dot and line (plan 27): a ring, and a dash over the line. */
  const isUnpavedDot: ExpressionSpecification = [
    "!=",
    ["get", "surface"],
    "asphalt",
  ];
  /** One pass dot: status by hue, closure by hollowness, fame by size and weight. */
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
      [">=", ["get", "fame"], CLASSIC_FAME],
      0.95,
      0.85,
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
      // A thin ring: "often closed" stays a shape, but no longer the loudest
      // mark on the map – the white disc in a thick red ring was.
      ["==", ["get", "status"], "closed"],
      1.5,
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
  // The tube: wide enough inside to hold an ascent on its rim (6 px, 9 when
  // selected), with a wall of 1.5 to 2 px either side of it.
  // Slimmer on the overview than up close: there a tube is a frame around a
  // few millimetres of road, and at 11 px it was wider than any ascent.
  const tourWall = tourWidth(7.5, 16);
  const tourInside = tourWidth(5.5, 12.5);
  /**
   * A tour's colour: one quiet tone for all of them at rest, its own once it
   * is pointed at or selected. A third of the tours' own colours lay in the
   * reds and oranges the status is said in, so at rest every tube spoke
   * status; the tour that is singled out still needs to be told from a
   * neighbour on the same road.
   */
  const tourColor = [
    "case",
    ["any", selected, hoveredLine],
    ["get", "color"],
    colors.tour,
  ] as never;

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
    // `DESTINATION_MAX_ZOOM`, where most roads are drawn and would be veiled
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
          ["case", isDestinationLit, 0.16, 0.045],
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
          ["case", isDestinationLit, 0.9, 0.18],
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
    // The ascents of the roads the filters leave out: a hairline in the ink,
    // faint, under everything – the valleys stay legible as a network of
    // roads, and none of it competes with a status colour. One layer opacity
    // for all of them, so a hairpin's overlap is not drawn twice. Not on the
    // overview, where three hundred hairlines would be a grey felt.
    {
      filter: ["in", ["get", "slug"], ["literal", []]],
      id: ROUTE_GHOST,
      layout: { "line-cap": "round", "line-join": "round" },
      minzoom: 8,
      paint: {
        "line-color": colors.ink,
        "line-layer-opacity": GHOST.line,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 12, 2],
      },
      source: SOURCE.routes,
      type: "line",
    },
    // The roads the filters leave out, as shadows (`Scene.ghosts`): a small
    // dot in the ink, faint, no ring, no status, no name, at every zoom –
    // only the filters decide what is drawn. They lie under every line and
    // mark the filters kept, which win the pointer too (`HIT_GROUPS`).
    {
      id: LAYERS.ghost.mark,
      paint: {
        "circle-color": colors.ink,
        "circle-opacity": GHOST.opacity,
        "circle-pitch-alignment": "map",
        "circle-radius": bySize(GHOST.radius[0], GHOST.radius[1]),
      },
      source: SOURCE.ghosts,
      type: "circle",
    },
    hitPoint(LAYERS.ghost.hit, SOURCE.ghosts),
    hitLine(LAYERS.tour.hit, SOURCE.tours),
    hitLine(LAYERS.route.hit, SOURCE.routes),
    // A tour is the union of several ascents – the Sellaronda *is* its four
    // passes – so it is drawn as what it is: a tube the ascents run inside,
    // reaching past them on both sides. What a tour contains is then read
    // from the map rather than from the list.
    //
    // Three lines make the tube: the wall in the tour's colour, a narrower
    // paper line over it that leaves only the wall's rim showing, and the
    // road itself along the middle, thin, for the stretches between two
    // ascents. Overlapping tours share one inside, because every wall is
    // drawn before any inside: where two tours run on the same road the
    // tubes merge into one, which is what that road is.
    //
    // The inside is not quite opaque, so a breath of the wall's colour
    // tints it – the tour stays recognisable along a road its ascents cover
    // completely. Each layer carries `line-layer-opacity`, not
    // `line-opacity`: a hairpin tighter than the tube runs the triangle
    // strip over itself, and only the layer property composites that once.
    {
      id: LAYERS.tour.mark,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": tourColor,
        "line-layer-opacity": 0.95,
        "line-width": tourWall,
      },
      source: SOURCE.tours,
      type: "line",
    },
    {
      id: TOUR_PARTS.inside,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": colors.paper,
        "line-layer-opacity": 0.8,
        "line-width": tourInside,
      },
      source: SOURCE.tours,
      type: "line",
    },
    {
      id: TOUR_PARTS.road,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": tourColor,
        "line-layer-opacity": 0.9,
        "line-width": ["case", selected, 2, 1.5],
      },
      source: SOURCE.tours,
      type: "line",
    },
    // Every ascent sits on a paper rim, the same edge the tour's inside
    // gives it: inside a tube the rim disappears into it, on its own it lifts
    // the status colour off the hillshade – one kind of line on the whole
    // map rather than a cased one in a tour and a bare one outside it.
    {
      id: ROUTE_CASING,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": colors.paper,
        // A rim of the same width round each line, so a thin closed one does
        // not sit in a wide white band.
        "line-width": [
          "case",
          selected,
          9,
          hoveredLine,
          7.5,
          [
            "match",
            ["feature-state", "status"],
            ...STATUSES.flatMap((st) => [st, ROUTE_WIDTH[st] + 2.5]),
            ROUTE_WIDTH.open + 2.5,
          ],
        ] as never,
      },
      source: SOURCE.routes,
      type: "line",
    },
    // The ascent, inside the tube that holds it: solid and opaque, because
    // the status colour is the stronger signal and must not be tinted by the
    // tour it belongs to. One layer per status, closed first and rideable
    // last (`ROUTE_LINES`), so a green road is drawn over a red one where they
    // cross – and narrower the further down the ladder it is: what is good to
    // ride is what the map is read for.
    ...(["closed", "risky", "open"] as const).map(
      (status): LayerSpecification => ({
        id: ROUTE_LINES[status],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": routeColor,
          // Hover is the lighter of the two states, so it must not reach the
          // width a selection has: pointing at a row says "this one", opening
          // it says "this one, and here is everything about it".
          "line-width": [
            "case",
            selected,
            6,
            hoveredLine,
            5,
            ROUTE_WIDTH[status],
          ] as never,
        },
        source: SOURCE.routes,
        type: "line",
      }),
    ),
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
    // Which way round: arrows along the tour that is selected or pointed at,
    // over its ascents, because on a loop like the Sellaronda the ascents
    // are nearly all of it. Only for that one – on every tour at once they
    // would be noise laid over the status colours. Feature state cannot
    // reach a layout property, so the others are placed and painted
    // transparent; a dozen tours make that cheap.
    {
      id: TOUR_PARTS.arrows,
      layout: {
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-image": TOUR_ARROW,
        "icon-rotation-alignment": "map",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 13, 0.9],
        "symbol-placement": "line",
        "symbol-spacing": 110,
      },
      minzoom: 8,
      paint: {
        "icon-color": ["get", "color"],
        "icon-halo-color": colors.paper,
        "icon-halo-width": 2,
        "icon-opacity": ["case", selected, 1, hoveredLine, 1, 0],
      },
      source: SOURCE.tours,
      type: "symbol",
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
        "text-color": tourColor,
        "text-halo-color": colors.paper,
        "text-halo-width": 1.5,
      },
      source: SOURCE.tours,
      type: "symbol",
    },
    hitPoint(LAYERS.town.hit, SOURCE.towns),
    hitPoint(
      LAYERS.pass.hit,
      SOURCE.passes,
      passRadius(coarse ? HIT_RADIUS : HIT_RADIUS_FINE),
    ),
    // Below the passes: MapLibre places labels from the top of the style
    // down, so a pass label wins the collision against a town name. The
    // passes are what the map is read for; the town is the answer to the
    // second question, not the first.
    {
      id: LAYERS.town.mark,
      layout: {
        "icon-allow-overlap": true,
        // A town takes no room from the names: on the overview there are 161
        // of them, more than there are classics, and each one used to push a
        // pass name off the map.
        "icon-ignore-placement": true,
        "icon-image": [
          "case",
          ["==", ["get", "selected"], 1],
          "town-sel",
          ["==", ["get", "favorite"], 1],
          "town-fav",
          "town",
        ],
        // Small and pale on the overview, where the question is which region,
        // full from zoom 8, where it is which town in it – smaller, never
        // gone, so the zoom still decides only how a town reads.
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          0.38,
          8,
          0.6,
          13,
          0.85,
        ],
      },
      paint: {
        "icon-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 8.5, 1],
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
      // Every road the filters keep, at every zoom; a favourite is a star,
      // in the layer below. Stacked rideable over limited over closed, a
      // classic over the rest of its status.
      filter: ["!=", ["get", "favorite"], 1],
      id: LAYERS.pass.mark,
      layout: {
        // Higher is drawn later, so on top.
        "circle-sort-key": ["-", ["get", "fame"], statusFirst(0, 10)] as never,
      },
      paint: passPaint,
      source: SOURCE.passes,
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
    // The area's name, where its outline has room (`labelSpot`), from the
    // end of the overview on (`OVERVIEW_ZOOM`): on one screen of the Alps,
    // eighty area names were most of the text. A point of its own rather
    // than the outline's: a polygon is labelled once per tile it crosses. Below the pass labels in the list, so
    // MapLibre places the pass names first: a famous pass wins its collision
    // against the area it lies in.
    {
      id: LAYERS.destination.labels[0],
      layout: {
        "symbol-sort-key": ["-", 1, ["get", "share"]] as never,
        // The name alone: how many of its roads are good is what the hover
        // label and the list say. Spaced a little, the way a map sets the name
        // of an area under the names of the places in it.
        "text-field": ["get", "name"] as never,
        "text-font": [FONT_BOLD],
        "text-letter-spacing": 0.04,
        "text-max-width": 8,
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          10.5,
          8,
          12.5,
        ] as never,
      },
      minzoom: OVERVIEW_ZOOM,
      paint: {
        // The towns' blue rather than the ink: an area's name is the quiet
        // voice under the road names, in the family its outline is drawn in.
        "text-color": colors.town,
        "text-halo-color": colors.paper,
        "text-halo-width": 1.5,
        // The name stays too; past the overview the pass names win their
        // collisions against it (they are placed first, see below).
        "text-opacity": 0.75,
      },
      source: SOURCE.destinationLabels,
      type: "symbol",
    },
    ...PASS_LABELS.map(({ minzoom, rank }) => ({
      // One layer per rank, the lowest taking every rank under it: a dead end
      // of fame 1 has rank 0 and still gets its name at the last step. A road
      // that is often closed in the half-month is not named until it is
      // pointed at – its thin ring says enough, and its name took the room a
      // rideable road's name needed (on a fine pointer: `notClosed`). What is
      // selected or a favourite is named whatever its status.
      filter:
        rank === 5
          ? ([
              "any",
              ["all", ["==", ["get", "rank"], 5], notClosed(coarse)],
              ["==", ["get", "selected"], 1],
              ["==", ["get", "favorite"], 1],
            ] as never)
          : ([
              "all",
              ["==", ["max", RANK_FLOOR, ["get", "rank"]], rank],
              notClosed(coarse),
              ["!=", ["get", "selected"], 1],
              ["!=", ["get", "favorite"], 1],
            ] as never),
      id: passLabelId(rank),
      layout: {
        // Placed rideable first, then by rank: where two names collide, the
        // green road keeps its name.
        "symbol-sort-key": [
          "+",
          statusFirst(0, 10),
          ["-", 6, ["get", "rank"]],
        ] as never,
        // The overview writes the short name (`shortName`): "Galibier", not
        // "Col du Galibier". The selected road is named in full everywhere.
        // Below `OVERVIEW_ZOOM` only a rideable road is named at all – an
        // empty name places nothing – besides the selected and the favourites.
        "text-field": [
          "step",
          ["zoom"],
          [
            "case",
            ["==", ["get", "selected"], 1],
            ["get", "name"],
            [
              "any",
              ["==", ["get", "favorite"], 1],
              ["==", ["get", "status"], "open"],
            ],
            ["get", "short"],
            "",
          ],
          OVERVIEW_ZOOM,
          [
            "case",
            ["==", ["get", "selected"], 1],
            ["get", "name"],
            ["get", "short"],
          ],
          SHORT_NAME_ZOOM,
          ["get", "name"],
        ] as never,
        "text-font": [FONT_BOLD],
        "text-justify": "auto" as never,
        "text-radial-offset": 1,
        "text-size": rank >= 5 ? 13 : rank <= 2 ? 11 : 12.5,
        // Eight places round the dot rather than four: in a cluster the
        // diagonal is often the one that is free.
        "text-variable-anchor": [
          "left",
          "right",
          "top",
          "bottom",
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
        ] as never,
      },
      minzoom,
      paint: {
        "text-color": colors.ink,
        "text-halo-color": colors.paper,
        "text-halo-width": 1.6,
        // A road the fan names round its area (`PassState`) is not named
        // beside its dot as well.
        "text-opacity": [
          "case",
          ["==", ["feature-state", "fanned"], 1],
          0,
          rank <= 2 ? 0.85 : 1,
        ] as never,
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
    /*
     * The visitor's position, once asked for: the platform's blue dot in the
     * app's own blue (`--area`), and around it the circle the fix may be off
     * by. The halo is in metres on the ground, so its radius doubles with each
     * zoom step from the pixels `buildScene` measured at the fix's latitude.
     */
    {
      id: OVERLAY.youHalo,
      paint: {
        "circle-color": colors.area,
        "circle-opacity": 0.15,
        "circle-pitch-alignment": "map",
        "circle-radius": [
          "interpolate",
          ["exponential", 2],
          ["zoom"],
          0,
          ["get", "halo"],
          22,
          ["*", ["get", "halo"], 2 ** 22],
        ],
        "circle-stroke-color": colors.area,
        "circle-stroke-opacity": 0.4,
        "circle-stroke-width": 1,
      },
      source: SOURCE.you,
      type: "circle",
    },
    {
      id: OVERLAY.you,
      paint: {
        "circle-color": colors.area,
        "circle-pitch-alignment": "map",
        "circle-radius": 6,
        "circle-stroke-color": colors.paper,
        "circle-stroke-width": 2.5,
      },
      source: SOURCE.you,
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
