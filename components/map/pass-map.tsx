"use client";

import { Box, Focus, Layers } from "lucide-react";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import {
  LngLat,
  LngLatBounds,
  Map as MLMap,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

import { baseLayers, OVERLAYS, VECTOR_BASE } from "@/components/map/map-style";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_VIEW, readHash, useStored } from "@/lib/app-state";
import type { MapView, Selection } from "@/lib/app-state";
import {
  BASEMAP_ID,
  BASEMAP_SOURCE,
  BASEMAP_SOURCE_ID,
  basemapLayers,
  FONT_BOLD,
  GLYPHS,
} from "@/lib/basemap";
import type { MapAssets } from "@/lib/map-assets";
import type { TownReach } from "@/lib/nearby";
import { PALETTE } from "@/lib/palette";
import type { Scheme } from "@/lib/palette";
import { roadTypeWord, TAG_LABEL } from "@/lib/regions";
import { ascentKey } from "@/lib/route-key";
import { tagIconSvg } from "@/lib/tag-icons";
import type { LatLon, Pass, Status, Tag, Tour, Town } from "@/lib/types";
import { cn, fmtUnit, MAP_CLUSTER, MAP_TOOL, PRESSED } from "@/lib/utils";

export interface MapPass extends Pass {
  status: Status;
  favorite: boolean;
}

interface Props {
  /** The passes the list shows: drawn as markers, their ascents highlighted. */
  passes: MapPass[];
  /** The tours the list shows; `visible` is the "auf der Karte" switch. */
  tours: (Tour & { status: Status; visible: boolean })[];
  towns: (Town & { favorite: boolean })[];
  /**
   * The area each town reaches – the hull over the passes within reach,
   * precomputed in `lib/nearby.ts`. Drawn while a town is hovered or selected,
   * so "was ist von hier aus erreichbar" is answered on the map itself.
   */
  townReach: TownReach;
  /**
   * The ascent and tour lines never arrive as props: MapLibre fetches them as
   * static GeoJSON from these URLs and tiles them in its worker. Which lines
   * show and how is set through layer filters and feature state below.
   */
  assets: MapAssets;
  /** "auf der Karte" for the pass section: markers, labels and ascents at once. */
  showPasses: boolean;
  showTowns: boolean;
  selection: Selection | null;
  onSelect: (sel: Selection) => void;
  onViewChange: (v: MapView) => void;
  /**
   * Camera requested from outside (a hash pasted into an open page). The map
   * is otherwise the source of truth for its camera, so this is applied only
   * when the object identity changes.
   */
  requestedView?: MapView | null;
  /** Road point under the elevation-profile cursor, marked on the ascent. */
  profileCursor?: LatLon | null;
  /**
   * Fly-to request from a click on the elevation profile. A fresh object per
   * click, so the same point can be asked for twice.
   */
  profileZoom?: LatLon | null;
  /** Pixels on the left covered by floating panels; camera targets stay right of them. */
  insetLeft?: number;
  /** Pixels at the bottom covered by the mobile sheet; camera targets stay above it. */
  insetBottom?: number;
  /**
   * The period scrubber, rendered inside the control cluster next to the three
   * map tools. A slot of its own, because `children` floats free beside the
   * cluster and must not stretch to its height.
   */
  scrubber?: React.ReactNode;
  /** Free-floating controls left of the cluster (the sidebar's own toggle). */
  children?: React.ReactNode;
}

const EMPTY = { features: [], type: "FeatureCollection" } as const;
/** Breathing room around a fitted frame, in pixels; the map padding is added on top. */
const FIT_PADDING = 48;
/**
 * The three tools share one segmented column that stretches to the scrubber's
 * height, so each takes a third of it and the cluster keeps an even edge all
 * the way round – a fixed height would leave a margin below the scrubber.
 */
const TOOL = "h-auto w-9 flex-1";
const TERRAIN = { exaggeration: 1.25, source: "dem" } as const;
/**
 * The tour hatch, in multiples of the line width – so on a band this wide the
 * numbers have to be well below 1 to read as a texture at all. Widen the band
 * and the dashes lengthen with it unless these come down to match.
 */
const DASH = [0.45, 0.35];
const DARK_QUERY = "(prefers-color-scheme: dark)";
/** The first layer above the base stack: where the basemap's lines and labels go. */
const ABOVE_BASE = `ov-${OVERLAYS[0].id}`;

const scheme = (): Scheme =>
  window.matchMedia(DARK_QUERY).matches ? "dark" : "light";

const coarsePointer = () => window.matchMedia("(pointer: coarse)").matches;

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
/** Slack around the pointer, so a near miss on a label still counts. */
const HIT_SLOP = 4;

/**
 * The layers that answer hover and click, in falling priority. The order is
 * spelled out rather than taken from the style, because the two disagree:
 * marks first, then the names beside them, then the lines – a name is a small
 * deliberate target, a line covers half the map, and both would otherwise
 * swallow the dot they belong to; and the tour band lies *under* the ascents
 * but reaches past them, so a click inside it hits both and the ascent is the
 * more specific answer. Within a group the nearer mark wins – passes and
 * towns share the first one – so a generous hit area never steals the click
 * from the mark actually aimed at.
 */
const HIT_GROUPS: readonly (readonly string[])[] = [
  ["passes-hit", "towns-hit"],
  [
    "pass-label-5",
    "pass-label-4",
    "pass-label-3",
    "pass-label-2",
    "pass-label-1",
    "towns-label",
  ],
  ["tours-label"],
  ["routes-hit"],
  ["tours-hit"],
];
const HIT_LAYERS = HIT_GROUPS.flat();

interface Hit {
  kind: Selection["kind"];
  slug: string;
  /** The feature's own properties – what the hover popup is built from. */
  props: Record<string, string>;
  /** Where the popup points: the mark itself, or the pointer on a line. */
  anchor: [number, number];
}

/**
 * The one entity under a point, resolved across all hit layers at once.
 * A single query instead of a handler per layer: overlapping areas are the
 * normal case here, and only one of them may win a click.
 */
const pickAt = (m: MLMap, x: number, y: number): Hit | null => {
  const layers = HIT_LAYERS.filter((id) => m.getLayer(id));
  if (layers.length === 0) return null;
  const features = m.queryRenderedFeatures(
    [
      [x - HIT_SLOP, y - HIT_SLOP],
      [x + HIT_SLOP, y + HIT_SLOP],
    ],
    { layers },
  );
  let best: Hit | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const f of features) {
    const rank = HIT_GROUPS.findIndex((g) => g.includes(f.layer.id));
    if (rank === -1 || rank > bestRank) continue;
    const props = f.properties as Record<string, string>;
    if (!props.slug) continue;
    const at =
      f.geometry.type === "Point"
        ? (f.geometry.coordinates as [number, number])
        : null;
    const p = at ? m.project(at) : null;
    const dist = p ? Math.hypot(p.x - x, p.y - y) : 0;
    if (rank === bestRank && dist >= bestDist) continue;
    const pointer = m.unproject([x, y]);
    bestRank = rank;
    bestDist = dist;
    best = {
      anchor: at ?? [pointer.lng, pointer.lat],
      // An ascent belongs to its pass; everything else names its own kind.
      kind: props.kind === "route" ? "pass" : (props.kind as Selection["kind"]),
      props,
      slug: props.slug,
    };
  }
  return best;
};

/** A stored base that no longer exists (a keyed raster, say) falls back to the default. */
const resolveBase = (id: string) =>
  id === BASEMAP_ID || baseLayers().some((b) => b.id === id) ? id : BASEMAP_ID;

// MapLibre resolves its worker via import.meta.url, which Turbopack does not
// serve; scripts/copy-maplibre-worker.ts places a copy under public/maplibre.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

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
const readColors = (el: HTMLElement) => {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => {
    const raw = s.getPropertyValue(name).trim();
    return raw ? toRgb(raw, fallback) : fallback;
  };
  return {
    accent: v("--accent", "#e8a33d"),
    closed: v("--status-closed", "#c43d3d"),
    ink: v("--foreground", "#1b2430"),
    open: v("--status-open", "#2e8b57"),
    paper: v("--card", "#ffffff"),
    risky: v("--status-risky", "#d9932a"),
    town: v("--town", "#1f4e79"),
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
const addIcons = (map: MLMap, c: ReturnType<typeof readColors>) => {
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
  for (const k of ["open", "risky", "closed"] as const) {
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
const hillshadePaint = (s: Scheme) => ({
  "hillshade-exaggeration": s === "dark" ? 0.3 : 0.2,
  "hillshade-highlight-color": PALETTE[s].highlight,
  "hillshade-shadow-color": PALETTE[s].shade,
});

/** The hillshade over the base: the DEM stays, its tones follow the scheme. */
const hillshadeLayer = (s: Scheme, visible: boolean): LayerSpecification => ({
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
const baseStack = (
  id: string,
  s: Scheme,
): { ground: LayerSpecification[]; detail: LayerSpecification[] } =>
  id === BASEMAP_ID
    ? basemapLayers(s)
    : { detail: [], ground: [{ id: "base", source: id, type: "raster" }] };

/** Swaps the base under a running map; everything above it stays put. */
const applyBase = (m: MLMap, id: string, s: Scheme) => {
  for (const l of m.getStyle().layers)
    if (l.id === "base" || l.id.startsWith("base-")) m.removeLayer(l.id);
  const { ground, detail } = baseStack(id, s);
  for (const l of ground) m.addLayer(l, "hillshade");
  for (const l of detail) m.addLayer(l, ABOVE_BASE);
};

/**
 * The app's own layers, painted with the live tokens. A pure function of the
 * colours, so a scheme change re-applies every paint property from the same
 * definition the style was built from.
 */
const appLayers = (colors: Colors): LayerSpecification[] => {
  const coarse = coarsePointer();
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
  const statusColor = [
    "match",
    ["get", "status"],
    "open",
    colors.open,
    "risky",
    colors.risky,
    "closed",
    colors.closed,
    "#888888",
  ] as never;
  // The ascent and tour lines carry status and selection as feature state,
  // so a period, filter or selection change never re-uploads geometry.
  const selected = ["==", ["feature-state", "selected"], 1];
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
  const routeColor = [
    "match",
    ["coalesce", ["feature-state", "status"], "none"],
    "open",
    colors.open,
    "risky",
    colors.risky,
    "closed",
    colors.closed,
    "#888888",
  ] as never;
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
      ["case", selected, near * 1.3, near],
      13,
      ["case", selected, far * 1.3, far],
    ] as never;
  // Wide enough to hold the widest ascent it can carry – a selected one, at 6
  // – and still reach past it on both sides.
  const tourLine = tourWidth(9, 12);

  return [
    // The area one town reaches, drawn while it is hovered: the hull over
    // its passes (lib/nearby.ts). Bottom of the app's stack, so
    // every line and dot stays readable on top of it.
    {
      id: "town-reach-fill",
      paint: { "fill-color": colors.town, "fill-opacity": 0.12 },
      source: "reach",
      type: "fill",
    },
    {
      id: "town-reach-line",
      paint: {
        "line-color": colors.town,
        "line-dasharray": [3, 2],
        "line-opacity": 0.7,
        "line-width": 1.5,
      },
      source: "reach",
      type: "line",
    },
    hitLine("tours-hit", "tours"),
    hitLine("routes-hit", "routes"),
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
      id: "tours",
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-dasharray": DASH,
        "line-layer-opacity": 0.62,
        "line-width": tourLine,
      },
      source: "tours",
      type: "line",
    },
    // The ascent, on top of the band that holds it: solid and opaque, because
    // the status colour is the stronger signal and must not be tinted by the
    // tour it belongs to.
    {
      id: "routes",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": routeColor,
        "line-width": ["case", selected, 6, 3.5],
      },
      source: "routes",
      type: "line",
    },
    {
      id: "tours-label",
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
      source: "tours",
      type: "symbol",
    },
    hitPoint("towns-hit", "towns"),
    hitPoint(
      "passes-hit",
      "passes",
      passRadius(coarse ? HIT_RADIUS : HIT_RADIUS_FINE),
    ),
    // Below the passes: MapLibre places labels from the top of the style
    // down, so a pass label wins the collision against a town name. The
    // passes are what the map is read for; the town is the answer to the
    // second question, not the first.
    {
      id: "towns",
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
      source: "towns",
      type: "symbol",
    },
    {
      id: "towns-label",
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
      source: "towns",
      type: "symbol",
    },
    {
      filter: ["!=", ["get", "favorite"], 1],
      id: "passes",
      paint: {
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
          ["==", ["get", "selected"], 1],
          colors.ink,
          ["==", ["get", "status"], "closed"],
          colors.closed,
          colors.paper,
        ],
        "circle-stroke-width": [
          "case",
          ["==", ["get", "selected"], 1],
          3,
          ["==", ["get", "status"], "closed"],
          2.5,
          1.5,
        ],
      },
      source: "passes",
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
      source: "passes",
      type: "symbol",
    },
    // Labels staggered by prominence; MapLibre resolves collisions
    ...(
      [
        [5, 0],
        [4, 7],
        [3, 8],
        [2, 9.5],
        [1, 10.5],
      ] as const
    ).map(([fame, minzoom]) => ({
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
      id: `pass-label-${fame}`,
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
      source: "passes",
      type: "symbol" as const,
    })),
    // Topmost: the profile cursor must stay visible over its own ascent.
    {
      id: "profile-cursor",
      paint: {
        "circle-color": colors.paper,
        "circle-pitch-alignment": "map",
        "circle-radius": 6,
        "circle-stroke-color": colors.ink,
        "circle-stroke-width": 2.5,
      },
      source: "cursor",
      type: "circle",
    },
  ] as LayerSpecification[];
};

const escapeHtml = (s: string) =>
  s.replaceAll(
    /[&<>"']/gu,
    (c) =>
      ({ '"': "&quot;", "&": "&amp;", "'": "&#39;", "<": "&lt;", ">": "&gt;" })[
        c
      ]!,
  );

/**
 * The hover popup's body: the name, the one line the mark carries (a road's
 * height and kind, a tour's own line) and the editorial labels with the same
 * glyphs the sidebar and the panel use – `lib/tag-icons.ts` exists because
 * this popup is an HTML string and not React. A town has labels and no
 * subtitle: what it is, is what the labels say.
 */
/**
 * What the hover popup reads off a road: its name, the one line under it and
 * its labels. One function rather than an object literal in the marker
 * effect, because the ascents read it too – see `roadPopupRef` – and a popup
 * that says one thing over the dot and another over the line belonging to it
 * is the kind of drift nobody notices until a screenshot.
 */
const roadPopup = (p: MapPass): Record<string, string> => ({
  name: p.name,
  subtitle: [fmtUnit(p.elevation, "m"), roadTypeWord(p.type)]
    .filter(Boolean)
    .join(" · "),
  tags: (p.tags ?? []).join(","),
});

const popupHtml = (p: Record<string, string>) => {
  const title = `<b>${escapeHtml(p.name ?? "")}</b>`;
  // Feature properties are strings; only what the vocabulary knows is drawn.
  const tags = (p.tags ?? "")
    .split(",")
    .filter((t): t is Tag => t in TAG_LABEL);
  const subtitle = p.subtitle ? `<br>${escapeHtml(p.subtitle)}` : "";
  if (tags.length === 0) return `${title}${subtitle}`;
  const chips = tags
    .map(
      (t) =>
        `<span class="flex items-center gap-1">${tagIconSvg(t)}${escapeHtml(TAG_LABEL[t].label)}</span>`,
    )
    .join("");
  return `${title}${subtitle}<div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">${chips}</div>`;
};

const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && !Number.isNaN(v)),
  ) as Partial<T>;

export const PassMap = ({
  passes,
  tours,
  towns,
  townReach,
  assets,
  showPasses,
  showTowns,
  selection,
  onSelect,
  onViewChange,
  profileCursor = null,
  profileZoom = null,
  requestedView = null,
  insetLeft = 0,
  insetBottom = 0,
  scrubber,
  children,
}: Props) => {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [is3d, setIs3d] = useState(false);
  // A shared link (a camera or a selection in the hash) is authoritative about
  // the camera; without one the map opens on what it draws, which is the frame
  // the fit button would produce. Both are refs, not state: they steer one
  // effect and never a render.
  const hashCamera = useRef(false);
  const fitted = useRef(false);
  const [base, setBase] = useStored("alpenpaesse:base", BASEMAP_ID);
  // The base the map currently shows. The map is built during the hydration
  // render, where a stored value is not known yet (useSyncExternalStore hands
  // out the server snapshot); the effect below catches up once it is.
  const appliedBase = useRef(BASEMAP_ID);
  const [overlays, setOverlays] = useStored<string[]>("alpenpaesse:overlays", [
    "hillshade",
  ]);
  // Callbacks are needed in map event handlers that are only registered
  // during setup; refs keep them current without rebuilding the map.
  const onSelectRef = useRef(onSelect);
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onViewChangeRef.current = onViewChange;
  }, [onSelect, onViewChange]);

  // The hover handler below is registered once during setup; this ref keeps
  // the hulls current without rebuilding the map.
  const reachRef = useRef<TownReach>(townReach);

  /**
   * Each road's popup body by slug. An ascent line *is* its road – `pickAt`
   * already answers a hit on one with `kind: "pass"` – but the route features
   * come from the static GeoJSON file, which carries the slug and nothing
   * else. Without this lookup the wide hit area over a line would open a
   * popup holding a bare name where the dot two hundred metres away shows the
   * height, the type and the labels.
   */
  const roadPopupRef = useRef(new Map<string, Record<string, string>>());
  useEffect(() => {
    roadPopupRef.current = new Map(passes.map((p) => [p.slug, roadPopup(p)]));
  }, [passes]);

  /** Draws one town's reach hull, or clears the layer. */
  const paintReach = (slug: string | null) => {
    const m = map.current;
    const ring = slug ? reachRef.current[slug] : undefined;
    (m?.getSource("reach") as GeoJSONSource | undefined)?.setData({
      features: ring
        ? [
            {
              geometry: { coordinates: [ring], type: "Polygon" },
              properties: {},
              type: "Feature",
            },
          ]
        : [],
      type: "FeatureCollection",
    });
  };

  /** Bounds of everything currently drawn; empty while nothing is. */
  const visibleBounds = () => {
    const b = new LngLatBounds();
    if (showPasses) for (const p of passes) b.extend([p.lon, p.lat]);
    for (const t of tours) {
      const bbox = assets.tourBounds[t.slug];
      if (t.visible && bbox) b.extend(bbox);
    }
    return b;
  };

  // --- Build the map once ------------------------------------------------
  useEffect(() => {
    if (!container.current || map.current) return;
    const colors = readColors(container.current);
    const initialScheme = scheme();
    appliedBase.current = resolveBase(base);
    const { ground, detail } = baseStack(appliedBase.current, initialScheme);

    const style: StyleSpecification = {
      glyphs: GLYPHS,
      layers: [
        ...ground,
        hillshadeLayer(initialScheme, overlays.includes("hillshade")),
        ...detail,
        ...OVERLAYS.map((o) => ({
          id: `ov-${o.id}`,
          layout: {
            visibility: overlays.includes(o.id)
              ? ("visible" as const)
              : ("none" as const),
          },
          paint: { "raster-opacity": o.opacity },
          source: `ov-${o.id}`,
          type: "raster" as const,
        })),
        ...appLayers(colors),
      ],
      sources: {
        [BASEMAP_SOURCE_ID]: BASEMAP_SOURCE,
        dem: {
          attribution: "Terrain © Mapzen/AWS",
          encoding: "terrarium",
          maxzoom: 15,
          tileSize: 256,
          tiles: [
            "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
          ],
          type: "raster-dem",
        },
        ...Object.fromEntries(
          baseLayers().map((b) => [
            b.id,
            {
              attribution: b.attribution,
              maxzoom: b.maxzoom,
              tileSize: 256,
              tiles: b.tiles,
              type: "raster",
            },
          ]),
        ),
        ...Object.fromEntries(
          OVERLAYS.map((o) => [
            `ov-${o.id}`,
            {
              attribution: o.attribution,
              maxzoom: o.maxzoom,
              tileSize: 256,
              tiles: [...o.tiles],
              type: "raster",
            },
          ]),
        ),
        cursor: { data: EMPTY, type: "geojson" },
        passes: { data: EMPTY, type: "geojson" },
        reach: { data: EMPTY, type: "geojson" },
        // Static files with a content hash in the name (scripts/build-map-assets.ts);
        // promoteId makes the `id` property the feature id for feature state.
        routes: { data: assets.routesUrl, promoteId: "id", type: "geojson" },
        tours: { data: assets.toursUrl, promoteId: "id", type: "geojson" },
        towns: { data: EMPTY, type: "geojson" },
      } as StyleSpecification["sources"],
      version: 8,
    };

    // The hash is read here rather than taken from props: this effect runs
    // before the parent's hash initialisation, and the map is built only once.
    const hash = readHash();
    const view = { ...DEFAULT_VIEW, ...defined(hash.view) };
    // A selection counts too: the map flies to it, so framing everything
    // first would only be a camera move the visitor never asked for.
    hashCamera.current =
      hash.view.lat !== undefined ||
      hash.view.zoom !== undefined ||
      hash.selection !== null;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const m = new MLMap({
      attributionControl: { compact: true },
      bearing: view.bearing,
      center: [view.lon, view.lat],
      container: container.current,
      locale: {
        "AttributionControl.ToggleAttribution": "Quellenangaben",
        "Map.Title": "Karte",
        "NavigationControl.ResetBearing": "Nach Norden ausrichten",
        "NavigationControl.ZoomIn": "Vergrößern",
        "NavigationControl.ZoomOut": "Verkleinern",
        "ScaleControl.Kilometers": "km",
        "ScaleControl.Meters": "m",
      },
      maxPitch: 75,
      pitch: view.pitch,
      style,
      zoom: view.zoom,
    });
    map.current = m;
    // Test hook for the e2e suite (never in a production build).
    if (process.env.NEXT_PUBLIC_TEST_HOOKS === "1") {
      (window as unknown as { __alpen?: { map: MLMap } }).__alpen = { map: m };
    }
    m.addControl(
      new NavigationControl({ showZoom: !coarse, visualizePitch: true }),
      "bottom-right",
    );
    m.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

    // `style.load`, not `load`: the latter waits for every source, and the
    // ascent and tour lines are a megabyte of GeoJSON fetched over holiday
    // Wi-Fi. Once the style is parsed the sources exist, so the markers,
    // filters and feature state can go in at once; the lines follow when
    // their files arrive (state set before that is applied as they load).
    m.on("style.load", () => {
      addIcons(m, colors);
      if (view.pitch > 1) {
        m.setTerrain(TERRAIN);
        setIs3d(true);
      }
      setReady(true);
    });

    // One pointer resolution for the whole map rather than a handler per
    // layer: the hit areas overlap, and exactly one entity may answer a hover
    // or a click (`pickAt` above decides which).
    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });
    /** The entity under the pointer as `kind:slug`, to rebuild only on change. */
    let hovered: string | null = null;
    /** Last pointer position, so a moving map re-reads what is under it. */
    let at: { x: number; y: number } | null = null;

    const hover = () => {
      // While the map moves there is nothing to aim at, and a popup following
      // a drag is only noise.
      const hit = at && !m.isMoving() ? pickAt(m, at.x, at.y) : null;
      m.getCanvas().style.cursor = hit ? "pointer" : "";
      if (!hit) {
        popup.remove();
        if (hovered) paintReach(null);
        hovered = null;
        return;
      }
      const key = `${hit.kind}:${hit.slug}`;
      if (key !== hovered) {
        hovered = key;
        // A route feature knows only its slug; its road knows the rest.
        const props =
          hit.props.kind === "route"
            ? (roadPopupRef.current.get(hit.slug) ?? hit.props)
            : hit.props;
        popup.setHTML(popupHtml(props));
        // Hovering a town also outlines what it reaches. Only on hover:
        // selecting one flies the camera in, and from inside the hull there is
        // nothing to see. The outline goes when the pointer does.
        paintReach(hit.kind === "town" ? hit.slug : null);
      }
      // `addTo` on an open popup re-appends its element, so it is only ever
      // added once per hover; the anchor follows the pointer along a line.
      popup.setLngLat(hit.anchor);
      if (!popup.isOpen()) popup.addTo(m);
    };

    // Hover is a mouse affordance; a finger has none, and a popup under it
    // would cover what was just tapped.
    if (!coarse) {
      m.on("mousemove", (e) => {
        at = { x: e.point.x, y: e.point.y };
        hover();
      });
      m.on("mouseout", () => {
        at = null;
        hover();
      });
      m.on("moveend", hover);
    }

    m.on("click", (e) => {
      const hit = pickAt(m, e.point.x, e.point.y);
      if (hit) onSelectRef.current({ kind: hit.kind, slug: hit.slug });
    });

    // Keep the 3D toggle honest when the map is tilted by drag or compass.
    m.on("pitchend", () => {
      const pitched = m.getPitch() > 1;
      setIs3d(pitched);
      if (pitched && !m.getTerrain()) m.setTerrain(TERRAIN);
    });

    m.on("moveend", () => {
      const c = m.getCenter();
      onViewChangeRef.current({
        bearing: m.getBearing(),
        lat: c.lat,
        lon: c.lng,
        pitch: m.getPitch(),
        zoom: m.getZoom(),
      });
    });

    // The container changes size when the sidebar collapses; MapLibre only
    // tracks window resizes on its own.
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(container.current);

    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
    // Intentional: build only once. Data arrives via the effects below.
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  // --- Which base ----------------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const next = resolveBase(base);
    if (next === appliedBase.current) return;
    appliedBase.current = next;
    applyBase(m, next, scheme());
  }, [base, ready]);

  // --- Follow the OS colour scheme -----------------------------------------
  // The tokens flip with it: the base is swapped for its twin, the icons are
  // repainted and every paint property of the app's layers is set again from
  // the definition the style was built from. Camera, sources, filters and
  // feature state are not touched, so nothing is lost or reloaded.
  useEffect(() => {
    const m = map.current;
    const el = container.current;
    if (!m || !el || !ready) return;
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      const s: Scheme = mql.matches ? "dark" : "light";
      const colors = readColors(el);
      addIcons(m, colors);
      if (resolveBase(base) === BASEMAP_ID) applyBase(m, BASEMAP_ID, s);
      const repaint = (id: string, paint: object) => {
        for (const [k, v] of Object.entries(paint) as [never, never][])
          m.setPaintProperty(id, k, v);
      };
      repaint("hillshade", hillshadePaint(s));
      for (const layer of appLayers(colors))
        repaint(layer.id, layer.paint ?? {});
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [ready, base]);

  // --- Camera requested via the URL hash ----------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !requestedView) return;
    m.jumpTo({
      bearing: requestedView.bearing,
      center: [requestedView.lon, requestedView.lat],
      pitch: requestedView.pitch,
      zoom: requestedView.zoom,
    });
  }, [requestedView, ready]);

  // --- Reserve space for the mobile sheet ---------------------------------
  useEffect(() => {
    map.current?.setPadding({
      bottom: insetBottom,
      left: insetLeft,
      right: 0,
      top: 0,
    });
  }, [insetLeft, insetBottom, ready]);

  // --- The frame the map opens on -----------------------------------------
  // Without a camera in the hash the overview is not a fixed rectangle but
  // whatever is drawn, so the first look is already the answer to "where are
  // these passes" – the same frame the fit button produces. A camera or a
  // selection in the hash wins; the selection flies to its own target.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || fitted.current) return;
    if (hashCamera.current || selection) {
      fitted.current = true;
      return;
    }
    const b = visibleBounds();
    if (b.isEmpty()) return;
    fitted.current = true;
    m.fitBounds(b, { animate: false, padding: FIT_PADDING });
    // Intentional: this runs once, as soon as there is something to frame.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [ready, passes, tours, selection]);

  // --- Which ascents show, and how -----------------------------------------
  // The geometry stays in the worker; a filter keeps the lines of filtered-out
  // passes out of the picture and out of hit-testing, feature state colours
  // the rest. MapLibre applies state set before the file has arrived to the
  // tiles as they load, so nothing here waits for the source.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const selPass = selection?.kind === "pass" ? selection.slug : null;
    const shown = [
      "in",
      ["get", "slug"],
      ["literal", showPasses ? passes.map((p) => p.slug) : []],
    ] as never;
    for (const layer of ["routes", "routes-hit"]) m.setFilter(layer, shown);
    for (const p of passes)
      for (const [i] of p.ascents.entries())
        m.setFeatureState(
          { id: ascentKey(p.slug, i), source: "routes" },
          { selected: p.slug === selPass ? 1 : 0, status: p.status },
        );
  }, [passes, selection, showPasses, ready]);

  // --- Which tours show, and how -------------------------------------------
  // A handful of tours: the filter with the visible slugs is as cheap as
  // feature state and also keeps a hidden tour from answering hover and click.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const visible = tours.filter((t) => t.visible).map((t) => t.slug);
    const filter = ["in", ["get", "slug"], ["literal", visible]] as never;
    for (const layer of ["tours", "tours-label", "tours-hit"])
      m.setFilter(layer, filter);
    for (const t of tours)
      m.setFeatureState(
        { id: t.slug, source: "tours" },
        {
          selected:
            selection?.kind === "tour" && selection.slug === t.slug ? 1 : 0,
        },
      );
  }, [tours, selection, ready]);

  // --- Markers: passes and towns ------------------------------------------
  // Points, a few hundred of them; their symbol layers need real properties
  // (icon by favourite and status, label filters by fame), which feature
  // state cannot drive, so these two sources are still written as GeoJSON.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const selPass = selection?.kind === "pass" ? selection.slug : null;
    (m.getSource("passes") as GeoJSONSource | undefined)?.setData({
      features: (showPasses ? passes : []).map((p) => ({
        geometry: { coordinates: [p.lon, p.lat], type: "Point" },
        properties: {
          ...roadPopup(p),
          fame: p.fame,
          favorite: p.favorite ? 1 : 0,
          kind: "pass",
          selected: p.slug === selPass ? 1 : 0,
          slug: p.slug,
          status: p.status,
        },
        type: "Feature",
      })),
      type: "FeatureCollection",
    });
  }, [passes, selection, showPasses, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const selTown = selection?.kind === "town" ? selection.slug : null;
    (m.getSource("towns") as GeoJSONSource | undefined)?.setData({
      features: showTowns
        ? towns.map((t) => ({
            geometry: { coordinates: [t.lon, t.lat], type: "Point" },
            properties: {
              favorite: t.favorite ? 1 : 0,
              kind: "town",
              name: t.name,
              selected: t.slug === selTown ? 1 : 0,
              slug: t.slug,
              tags: t.tags.join(","),
            },
            type: "Feature",
          }))
        : [],
      type: "FeatureCollection",
    });
  }, [towns, selection, showTowns, ready]);

  // --- The reach hull of the hovered town ---------------------------------
  // Nothing is hovered while this runs, so the layer is cleared with it: the
  // towns may have just been switched off under the pointer.
  useEffect(() => {
    if (!ready) return;
    reachRef.current = townReach;
    paintReach(null);
    // `paintReach` only reads refs and the map instance, both stable.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [townReach, showTowns, ready]);

  // --- Elevation-profile cursor -------------------------------------------
  // One point, so setData is cheap enough to run on every pointer move.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("cursor") as GeoJSONSource | undefined)?.setData({
      features: profileCursor
        ? [
            {
              geometry: {
                coordinates: [profileCursor.lon, profileCursor.lat],
                type: "Point",
              },
              properties: {},
              type: "Feature",
            },
          ]
        : [],
      type: "FeatureCollection",
    });
  }, [profileCursor, ready]);

  // Click on the profile: close enough to count the hairpins.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !profileZoom) return;
    m.flyTo({
      center: [profileZoom.lon, profileZoom.lat],
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 900,
      zoom: Math.max(m.getZoom(), 13),
    });
  }, [profileZoom, ready]);

  // --- Fly to selection --------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !selection) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reduce ? 0 : 900;
    if (selection.kind === "pass") {
      const p = passes.find((x) => x.slug === selection.slug);
      if (p)
        m.flyTo({
          center: [p.lon, p.lat],
          duration,
          zoom: Math.max(m.getZoom(), 11),
        });
    } else if (selection.kind === "town") {
      const t = towns.find((x) => x.slug === selection.slug);
      if (t)
        m.flyTo({
          center: [t.lon, t.lat],
          duration,
          zoom: Math.max(m.getZoom(), 10.5),
        });
    } else {
      // Precomputed per tour: the routed line's bounds, or the waypoints'.
      const bbox = assets.tourBounds[selection.slug];
      if (bbox) m.fitBounds(bbox, { duration, padding: 60 });
    }
    // oxlint-disable-next-line react/exhaustive-deps
  }, [selection?.kind, selection?.slug, ready]);

  const toggle3d = (pressed: boolean) => {
    const m = map.current;
    if (!m) return;
    setIs3d(pressed);
    if (pressed) {
      m.setTerrain(TERRAIN);
      m.easeTo({ duration: 700, pitch: 60 });
    } else {
      m.setTerrain(null);
      m.easeTo({ bearing: 0, duration: 600, pitch: 0 });
    }
  };

  const switchBase = (id: string) => setBase(id);

  const toggleOverlay = (id: string) => {
    const on = !overlays.includes(id);
    setOverlays(on ? [...overlays, id] : overlays.filter((o) => o !== id));
    map.current?.setLayoutProperty(
      id === "hillshade" ? "hillshade" : `ov-${id}`,
      "visibility",
      on ? "visible" : "none",
    );
  };

  /**
   * Fit the view to everything currently drawn. Pressed again while already
   * fitted (or when nothing is drawn) it returns to the whole-Alps overview.
   */
  const fitToVisible = () => {
    const m = map.current;
    if (!m) return;
    const b = visibleBounds();
    const target = b.isEmpty()
      ? undefined
      : m.cameraForBounds(b, { padding: FIT_PADDING });
    const alreadyFitted =
      target?.zoom !== undefined &&
      Math.abs(m.getZoom() - target.zoom) < 0.05 &&
      m
        .getCenter()
        .distanceTo(LngLat.convert(target.center as [number, number])) < 2000;
    if (!target || alreadyFitted) {
      m.flyTo({
        bearing: 0,
        center: [DEFAULT_VIEW.lon, DEFAULT_VIEW.lat],
        duration: 800,
        pitch: 0,
        zoom: DEFAULT_VIEW.zoom,
      });
    } else {
      m.fitBounds(b, { duration: 800, padding: FIT_PADDING });
    }
  };

  return (
    <div className="bg-muted relative size-full overflow-hidden">
      {/* Plain "absolute inset-0" loses against the unlayered maplibre-gl.css (`.maplibregl-map { position: relative }`). */}
      <div ref={container} className="size-full" />

      <div
        style={{ left: insetLeft + 12 }}
        className="absolute top-3 z-10 flex max-w-[calc(100%-4rem)] items-start gap-2 transition-[left] duration-200 motion-reduce:transition-none"
      >
        {children}
        {/*
         * One interaction area: the period scrubber and the three map tools on
         * a single panel surface, the tools segmented in the same outline as
         * the scrubber's own stepper and stretched to its height. A tool has to
         * look pressable, and the cluster has to keep an even edge.
         */}
        <div className={cn("flex min-w-0 items-stretch gap-1.5", MAP_CLUSTER)}>
          {scrubber}
          <ButtonGroup
            orientation="vertical"
            className="bg-background/60 shrink-0 rounded-md"
          >
            <Popover>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <PopoverTrigger
                      render={
                        <Button
                          size="icon-lg"
                          variant="outline"
                          className={cn(TOOL, MAP_TOOL)}
                          aria-label="Kartenebenen"
                        />
                      }
                    />
                  }
                >
                  <Layers />
                </TooltipTrigger>
                <TooltipContent side="right">Kartenebenen</TooltipContent>
              </Tooltip>
              <PopoverContent align="start" side="right" className="w-60 gap-3">
                <FieldSet className="gap-2">
                  <FieldLegend variant="label">Grundkarte</FieldLegend>
                  <RadioGroup
                    value={resolveBase(base)}
                    onValueChange={(v) => switchBase(String(v))}
                    className="gap-1.5"
                  >
                    {[VECTOR_BASE, ...baseLayers()].map((b) => (
                      <Field key={b.id} orientation="horizontal">
                        <RadioGroupItem value={b.id} id={`base-${b.id}`} />
                        <FieldLabel
                          htmlFor={`base-${b.id}`}
                          className="font-normal"
                        >
                          {b.name}
                        </FieldLabel>
                      </Field>
                    ))}
                  </RadioGroup>
                </FieldSet>
                <FieldSet className="gap-2">
                  <FieldLegend variant="label">Overlays</FieldLegend>
                  {[
                    { id: "hillshade", name: "Relief-Schummerung" },
                    ...OVERLAYS,
                  ].map((o) => (
                    <Field key={o.id} orientation="horizontal">
                      <Switch
                        size="sm"
                        id={`ov-${o.id}`}
                        checked={overlays.includes(o.id)}
                        onCheckedChange={() => toggleOverlay(o.id)}
                      />
                      <FieldLabel
                        htmlFor={`ov-${o.id}`}
                        className="font-normal"
                      >
                        {o.name}
                      </FieldLabel>
                    </Field>
                  ))}
                </FieldSet>
              </PopoverContent>
            </Popover>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Toggle
                    variant="outline"
                    size="lg"
                    pressed={is3d}
                    onPressedChange={toggle3d}
                    aria-label="3D-Gelände"
                    className={cn(TOOL, "px-0", MAP_TOOL, PRESSED)}
                  />
                }
              >
                <Box />
              </TooltipTrigger>
              <TooltipContent side="right">3D-Gelände</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-lg"
                    variant="outline"
                    className={cn(TOOL, MAP_TOOL)}
                    onClick={fitToVisible}
                    aria-label="Ansicht einpassen"
                  />
                }
              >
                <Focus />
              </TooltipTrigger>
              <TooltipContent side="right">
                Ansicht einpassen – erneut für die ganzen Alpen
              </TooltipContent>
            </Tooltip>
          </ButtonGroup>
        </div>
      </div>
    </div>
  );
};
