"use client";

import type { FeatureCollection } from "geojson";
import { Compass, MoreHorizontal, Scan } from "lucide-react";
import type {
  ExpressionSpecification,
  IControl,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  LngLat,
  Map as MLMap,
  Popup,
  ScaleControl,
  setWorkerUrl,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { useCamera } from "@/components/map/apply-camera";
import { applyScene, sceneHost } from "@/components/map/apply-scene";
import type { SceneHost } from "@/components/map/apply-scene";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_VIEW } from "@/lib/app-state";
import type { MapView, Selection, Shown } from "@/lib/app-state";
import {
  BASEMAP_ID,
  BASEMAP_SOURCE,
  BASEMAP_SOURCE_ID,
  basemapLayers,
  FONT_BOLD,
  GLYPHS,
} from "@/lib/basemap";
import type { MapAssets } from "@/lib/map-assets";
import {
  FIT_MS,
  FIT_PADDING,
  fitDone,
  flightFor,
  NO_INSET,
} from "@/lib/map-camera";
import type { CameraIntent, Inset } from "@/lib/map-camera";
import {
  HIT_LAYERS,
  LAYERS,
  OVERLAY,
  PASS_LABELS,
  passLabelId,
  SOURCE,
} from "@/lib/map-layers";
import { DOUBLE_MS, isDoubleClick, pick } from "@/lib/map-pick";
import type { Tap } from "@/lib/map-pick";
import { buildScene } from "@/lib/map-scene";
import type { Scene } from "@/lib/map-scene";
import type { TownReach } from "@/lib/nearby";
import { PALETTE } from "@/lib/palette";
import type { Scheme } from "@/lib/palette";
import { prominenceFilter, prominenceWord } from "@/lib/prominence";
import { entityKey } from "@/lib/route-key";
import type { PassRow, TourRow, TownRow } from "@/lib/rows";
import { STATUS_ORDER } from "@/lib/status";
import type { LatLon } from "@/lib/types";
import type { MapEnvironment } from "@/lib/use-media-query";
import { useStored } from "@/lib/use-stored";
import { cn, MAP_CLUSTER, MAP_TOOL } from "@/lib/utils";

interface Props {
  /**
   * What the three lists show – the same rows, drawn as marks, lines and
   * names. `buildScene` (lib/map-scene.ts) turns them into what the map
   * draws; nothing is translated on the way in.
   */
  rows: {
    pass: readonly PassRow[];
    tour: readonly TourRow[];
    town: readonly TownRow[];
  };
  /** The "auf der Karte" switches: the layer toggle on top of the lists. */
  shown: Shown;
  /**
   * The area each town reaches – the hull over the passes within reach,
   * precomputed in `lib/nearby.ts`. Drawn while a town is hovered, in the list
   * or on the map, so "was ist von hier aus erreichbar" is answered on the map
   * itself. A selected town is flown to instead: from inside the hull there is
   * nothing to see.
   */
  townReach: TownReach;
  /**
   * The ascent and tour lines never arrive as props: MapLibre fetches them as
   * static GeoJSON from these URLs and tiles them in its worker. Which lines
   * show and how is a layer filter and feature state, both of them scene
   * fields.
   */
  assets: MapAssets;
  selection: Selection | null;
  /**
   * What the pointer is over, from either half of the screen. The map both
   * reports it (its own pointer) and answers it (a row hovered in the list),
   * which is what finally ties the two together – see `hovered` in
   * `explorer.tsx`.
   */
  hovered?: Selection | null;
  onHover?: (sel: Selection | null) => void;
  onSelect: (sel: Selection) => void;
  /**
   * Where the camera has come to rest, once it has: the hash adapter writes it
   * (`writeHash` in `lib/map-camera.ts`). Not every frame of a flight – a link
   * to a camera still on its way is a link to nowhere in particular.
   */
  onViewChange: (v: MapView) => void;
  /**
   * What the opening camera owes the link the page was opened with, read from
   * the hash before the map is built (`cameraIntent`, lib/hash-adapter.ts).
   * The map is built on its `view` and waits for it, which is also why it is
   * the one prop with no default: `null` means the hash has not been read yet.
   */
  intent: CameraIntent | null;
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
  /**
   * What the shell covers of the map on each edge, in pixels
   * (`shellGeometry`, lib/shell-geometry.ts): the panels on the left, the
   * header at the top, the season bar or whichever drawer is in front at the
   * bottom. Camera targets land in what is left of it.
   */
  inset?: Inset;
  /**
   * What the device does differently: the colour scheme the layers are painted
   * in, whether the pointer is a finger, whether motion is unwanted and whether
   * the shell is the phone one. All four used to be `matchMedia` calls inside
   * the map, one of them in a function documented as pure.
   */
  env: MapEnvironment;
}

const EMPTY: FeatureCollection = { features: [], type: "FeatureCollection" };
/** A click on the elevation profile: close enough to count the hairpins. */
const PROFILE_ZOOM = 13;
const PROFILE_MS = 900;

/**
 * The two tools share one segmented column in the map's top-right corner. They
 * are the only furniture on the map itself now that the period control has
 * moved into the shell's bottom bar, so the corner holds what is about the
 * *picture* – framing it, and what it is drawn on – and nothing about the
 * domain.
 */
const TOOL = "size-9";
const TERRAIN = { exaggeration: 1.25, source: "dem" } as const;

/**
 * The legend line for the level of detail (`lib/prominence.ts`): "Bei dieser
 * Zoomstufe: bekannte Pässe" while the overview is thinned by fame, nothing
 * once every road is drawn. A MapLibre control rather than a React node, so
 * it sits in a corner the way the scale bar and the attribution do – read,
 * not pressed – and keeps clear of the season bar with them.
 * It is silent while the passes are switched off: a line about which passes
 * are drawn is a lie when none are.
 */
class DetailLevelControl implements IControl {
  private el: HTMLDivElement | null = null;
  private map: MLMap | null = null;
  private shown = true;
  private readonly update = () => {
    if (!this.el || !this.map) return;
    const word = this.shown ? prominenceWord(this.map.getZoom()) : null;
    this.el.textContent = word ? `Bei dieser Zoomstufe: ${word}` : "";
    this.el.hidden = !word;
  };

  onAdd(m: MLMap) {
    this.map = m;
    this.el = document.createElement("div");
    this.el.className =
      "maplibregl-ctrl bg-card/70 border-border/60 text-muted-foreground text-2xs rounded-xs border px-1 leading-4 backdrop-blur-sm";
    m.on("zoom", this.update);
    this.update();
    return this.el;
  }

  onRemove(m: MLMap) {
    m.off("zoom", this.update);
    this.el?.remove();
    this.el = null;
    this.map = null;
  }

  /** Whether the passes are drawn at all – with them off the line is hidden. */
  setShown(shown: boolean) {
    this.shown = shown;
    this.update();
  }
}
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
/** Slack around the pointer, so a near miss on a label still counts. */
const HIT_SLOP = 4;

/**
 * The one entity under a point, resolved across every hit layer at once.
 *
 * A single query instead of a handler per layer: overlapping areas are the
 * normal case here, and only one of them may win a click. Which one is
 * `pick` (lib/map-pick.ts) – a decision over plain records, so the rule
 * behind every click is tested without a map.
 */
const pickAt = (m: MLMap, x: number, y: number): Selection | null => {
  const layers = HIT_LAYERS.filter((id) => m.getLayer(id));
  if (layers.length === 0) return null;
  const features = m.queryRenderedFeatures(
    [
      [x - HIT_SLOP, y - HIT_SLOP],
      [x + HIT_SLOP, y + HIT_SLOP],
    ],
    { layers },
  );
  return pick(
    features.map((f) => ({
      layer: f.layer.id,
      point:
        f.geometry.type === "Point"
          ? (f.geometry.coordinates as [number, number])
          : null,
      slug: String(f.properties.slug ?? ""),
    })),
    { x, y },
    (at) => m.project([at[0], at[1]]),
  );
};

/** The scale bar, the attribution ⓘ and the level-of-detail line, as a set. */
interface Provenance {
  attribution: AttributionControl;
  scale: ScaleControl;
  level: DetailLevelControl;
}

/**
 * Puts the three quiet controls in the corner the layout leaves them.
 *
 * On a phone they stack in the bottom-left corner above the season bar; on
 * desktop, where the season card stands beside the panels on the left, they sit
 * in a row in the bottom-right corner, the one corner nothing else claims.
 * MapLibre fixes a control's corner when it is added, so a change of layout
 * re-adds them – which is also what keeps the compact attribution unfolding
 * towards the map rather than off its edge.
 */
const placeProvenance = (
  m: MLMap,
  controls: Provenance,
  mobile: boolean,
  root: HTMLElement | null,
) => {
  // A right corner takes each new control on its *left*, so the ⓘ goes in
  // first and keeps the corner; the scale bar stands beside it.
  const corner = mobile ? "bottom-left" : "bottom-right";
  for (const control of [controls.attribution, controls.scale, controls.level])
    m.addControl(control, corner);
  /*
   * MapLibre opens a compact attribution the first time it has something to
   * say, and folds it away only once it has been clicked. Nothing else on this
   * map is open before it is asked for, so it starts folded.
   *
   * Marking the container compact *here* is what does that, rather than
   * removing the open class afterwards: `_updateCompact` adds
   * `maplibregl-compact-show` only while the container is not compact yet, and
   * it runs again on every resize and whenever the attributions change – so a
   * class removed now is back the moment the first source reports in. Set the
   * flag it tests and it never opens by itself; the ⓘ still toggles. Which is
   * also why the controls go in while the style is still parsing: an
   * attribution that has something to say before the flag is set says it.
   */
  root
    ?.querySelector(".maplibregl-ctrl-attrib")
    ?.classList.add("maplibregl-compact");
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
  for (const k of STATUS_ORDER) {
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
 * colours and the environment, so a scheme change re-applies every paint
 * property from the same definition the style was built from.
 */
const appLayers = (
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
      colors.paper,
    ],
    "circle-stroke-width": [
      "case",
      isSelected,
      3,
      ["==", ["get", "status"], "closed"],
      2.5,
      1.5,
    ],
  } as never;
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
      ["case", selected, near * 1.3, hoveredLine, near * 1.15, near],
      13,
      ["case", selected, far * 1.3, hoveredLine, far * 1.15, far],
    ] as never;
  // Wide enough to hold the widest ascent it can carry – a selected one, at 6
  // – and still reach past it on both sides.
  const tourLine = tourWidth(9, 12);

  return [
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
     * one-feature source, so hovering never rewrites the 201-point source.
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

export const PassMap = ({
  rows,
  shown,
  townReach,
  assets,
  selection,
  hovered = null,
  onHover,
  onSelect,
  onViewChange,
  intent,
  profileCursor = null,
  profileZoom = null,
  requestedView = null,
  inset = NO_INSET,
  env,
}: Props) => {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [is3d, setIs3d] = useState(false);
  /**
   * Whether the map is turned away from north, and by how much.
   *
   * The compass is the one tool that is not always there: a map pointing north
   * needs no control saying so, and the corner is quieter without it. The
   * boolean is state, because it mounts and unmounts a button. The angle is a
   * ref, because the needle follows a drag frame by frame and a re-render per
   * frame to turn an icon would be the most expensive way to do that.
   */
  const [turned, setTurned] = useState(false);
  const detailLevel = useRef<DetailLevelControl | null>(null);
  useEffect(() => {
    detailLevel.current?.setShown(shown.passes);
  }, [shown.passes, ready]);
  /** The three controls in the map's quiet corner, and which layout put them there. */
  const provenance = useRef<Provenance | null>(null);
  const placedFor = useRef<boolean | null>(null);
  const bearing = useRef(0);
  const needle = useRef<SVGSVGElement | null>(null);
  /** Points the needle north; also applies the angle it mounts at. */
  const aimNeedle = (el: SVGSVGElement | null) => {
    needle.current = el;
    if (el) el.style.transform = `rotate(${-bearing.current}deg)`;
  };
  /**
   * What the map draws, as one value, and what of it has been applied.
   *
   * The scene is built from the props on every render (`buildScene`,
   * lib/map-scene.ts) and the effect below hands MapLibre the difference to
   * the last one – so a hover that changes nothing costs nothing, and nothing
   * the map shows is decided in an effect any more.
   */
  const scene = buildScene({
    env: { coarse: env.coarsePointer },
    hovered,
    profileCursor,
    rows,
    selection,
    shown,
    tourBounds: assets.tourBounds,
    townReach,
  });
  const applied = useRef<Scene | null>(null);
  const host = useRef<SceneHost | null>(null);
  /**
   * Every camera move the map makes by itself goes through this one machine
   * (`camera` in lib/map-camera.ts): the effects below turn a prop change into
   * an event, `send` hands back the commands and the adapter carries them out.
   * Nothing here branches on where the camera happens to be.
   */
  const { issue, send } = useCamera(map, onViewChange, () => ({
    reduceMotion: env.reduceMotion,
  }));
  /** One string per selected entity: what the camera effects change on. */
  const selKey = selection && entityKey(selection);
  const [base, setBase] = useStored("base");
  // The base the map currently shows. The map is built during the hydration
  // render, where a stored value is not known yet (useSyncExternalStore hands
  // out the server snapshot); the effect below catches up once it is.
  const appliedBase = useRef(BASEMAP_ID);
  /** And the scheme it was painted in, for the same reason. */
  const appliedScheme = useRef<Scheme>("light");
  const [overlays, setOverlays] = useStored("overlays");
  // Callbacks are needed in map event handlers that are only registered
  // during setup; refs keep them current without rebuilding the map.
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onHoverRef.current = onHover;
  }, [onSelect, onHover]);

  /**
   * What the pointer is over, as the map last heard it. The map reports a
   * hover and is answered by the scene like any other half of the screen, so
   * this is not a second hover state: it is what keeps the pointer from
   * dispatching the same entity on every mouse move across one dot.
   */
  const hoveredRef = useRef<Selection | null>(hovered);
  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  // --- Build the map once ------------------------------------------------
  // Once the intent is known, which is one tick after the first commit: the
  // map is built on the camera a shared link carries, and reading the hash for
  // it is the hash adapter's business, not the map's.
  useEffect(() => {
    if (!container.current || map.current || !intent) return;
    const colors = readColors(container.current);
    appliedBase.current = resolveBase(base);
    appliedScheme.current = env.scheme;
    const { ground, detail } = baseStack(appliedBase.current, env.scheme);

    const style: StyleSpecification = {
      glyphs: GLYPHS,
      layers: [
        ...ground,
        hillshadeLayer(env.scheme, overlays.includes("hillshade")),
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
        ...appLayers(colors, env),
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
        // What the scene writes: empty until it has been applied once.
        [SOURCE.cursor]: { data: EMPTY, type: "geojson" },
        [SOURCE.hover]: { data: EMPTY, type: "geojson" },
        [SOURCE.passes]: { data: EMPTY, type: "geojson" },
        [SOURCE.reach]: { data: EMPTY, type: "geojson" },
        // Static files with a content hash in the name (scripts/build-map-assets.ts);
        // promoteId makes the `id` property the feature id for feature state.
        [SOURCE.routes]: {
          data: assets.routesUrl,
          promoteId: "id",
          type: "geojson",
        },
        [SOURCE.tours]: {
          data: assets.toursUrl,
          promoteId: "id",
          type: "geojson",
        },
        [SOURCE.towns]: { data: EMPTY, type: "geojson" },
      },
      version: 8,
    };

    const { view } = intent;
    const m = new MLMap({
      // Placed by hand below, in the corner opposite the tools.
      attributionControl: false,
      bearing: view.bearing,
      center: [view.lon, view.lat],
      container: container.current,
      locale: {
        "AttributionControl.ToggleAttribution": "Quellenangaben",
        "Map.Title": "Karte",
        "ScaleControl.Kilometers": "km",
        "ScaleControl.Meters": "m",
      },
      maxPitch: 75,
      pitch: view.pitch,
      style,
      zoom: view.zoom,
    });
    map.current = m;
    // Test hook for the e2e suite (never in a production build): the map
    // itself, and nothing else. What the suite needs to *judge* the map with –
    // the box a pass is framed into, say – it derives from the same data the
    // app does, rather than being handed it through the window.
    if (process.env.NEXT_PUBLIC_TEST_HOOKS === "1") {
      (window as unknown as { __alpen?: { map: MLMap } }).__alpen = { map: m };
    }
    /*
     * Provenance: the scale bar and who the map is by. Both quiet and small –
     * they are read once, not operated – while everything a visitor presses
     * lives in the top-right group. The level-of-detail line travels with
     * them: it is read too, and it must not sit under the sidebar on desktop.
     *
     * The attribution stays *on the map* behind a single ⓘ rather than moving
     * into the view menu: one clearly identifiable interaction is what the
     * OSM attribution guidelines ask for, and a line inside a menu about map
     * types is neither identifiable nor one interaction.
     */
    detailLevel.current = new DetailLevelControl();
    const controls: Provenance = {
      attribution: new AttributionControl({ compact: true }),
      level: detailLevel.current,
      scale: new ScaleControl({ unit: "metric" }),
    };
    provenance.current = controls;
    placedFor.current = env.mobile;
    placeProvenance(m, controls, env.mobile, container.current);

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
    host.current = sceneHost(m, popup);
    /** Last pointer position, so a moving map re-reads what is under it. */
    let at: { x: number; y: number } | null = null;

    const hover = () => {
      // While the map moves there is nothing to aim at, and a label following
      // a drag is only noise.
      const hit = at && !m.isMoving() ? pickAt(m, at.x, at.y) : null;
      m.getCanvas().style.cursor = hit ? "pointer" : "";
      const was = hoveredRef.current;
      if ((hit && was && entityKey(hit) === entityKey(was)) || (!hit && !was))
        return;
      // The map reports what its pointer is over and draws nothing itself: the
      // ring, the wider lines, the reach hull and the label all come back
      // through the scene, which is what makes a mark hovered here and a row
      // hovered in the list answer with the same picture (`hovered` in
      // explorer.tsx). Noted before it is dispatched, so the rest of the
      // pointer events in this frame do not repeat it.
      hoveredRef.current = hit;
      onHoverRef.current?.(hit);
    };

    // Hover is a mouse affordance; a finger has none, and a label under it
    // would cover what was just tapped.
    if (!env.coarsePointer) {
      m.on("mousemove", (e) => {
        at = { x: e.point.x, y: e.point.y };
        hover();
      });
      m.on("mouseout", () => {
        at = null;
        hover();
      });
    }
    /** The selection a click has resolved but not yet handed over. */
    let pending: ReturnType<typeof setTimeout> | null = null;
    /** The previous click, to tell the second half of a double click apart. */
    let clicked: Tap | null = null;
    const dropPending = () => {
      if (pending) clearTimeout(pending);
      pending = null;
    };

    m.on("click", (e) => {
      const tap: Tap = { t: Date.now(), x: e.point.x, y: e.point.y };
      const prev = clicked;
      clicked = tap;
      // A click that follows another one closely is the map's zoom gesture,
      // not a pick (`isDoubleClick`, lib/map-pick.ts): it drops what the first
      // one lined up and selects nothing itself. A third click in the same run
      // finds nothing pending and stops here too, so a run of fast clicks
      // never ends in a panel.
      if (isDoubleClick(prev, tap)) {
        dropPending();
        return;
      }
      const hit = pickAt(m, tap.x, tap.y);
      dropPending();
      if (!hit) return;
      pending = setTimeout(() => {
        pending = null;
        onSelectRef.current(hit);
      }, DOUBLE_MS);
    });
    // A mouse announces the double click itself; a tap on a phone may not, and
    // the timing above is what catches that one.
    m.on("dblclick", dropPending);

    // The needle follows the drag; `rotate` fires per frame, and the boolean
    // only changes on the first of them, so every later call bails out of the
    // render. `moveend` covers the flights that carry a bearing with them.
    const spin = () => {
      bearing.current = m.getBearing();
      needle.current?.style.setProperty(
        "transform",
        `rotate(${-bearing.current}deg)`,
      );
      setTurned(Math.abs(bearing.current) > 0.5);
    };
    m.on("rotate", spin);
    spin();

    // Keep the 3D toggle honest when the map is tilted by drag or compass.
    m.on("pitchend", () => {
      const pitched = m.getPitch() > 1;
      setIs3d(pitched);
      if (pitched && !m.getTerrain()) m.setTerrain(TERRAIN);
    });

    /*
     * One listener for everything a camera at rest settles: what is under the
     * pointer now that the picture has moved, where the needle points, and the
     * camera's own next move.
     *
     * There were three of these, registered in three places, and which of them
     * ran first decided whether a flight's leftover padding was applied before
     * or after the hash was written. Now the order is one function's three
     * lines, and only the third of them decides anything: `byUser` tells a
     * drag, a wheel and a pinch – the moves MapLibre makes on the visitor's
     * own behalf, and the only ones carrying a DOM event – from the app's.
     */
    m.on("moveend", (e) => {
      if (!env.coarsePointer) hover();
      spin();
      send({ byUser: Boolean(e.originalEvent), type: "moveend" });
    });

    // The container changes size when the sidebar collapses; MapLibre only
    // tracks window resizes on its own.
    const ro = new ResizeObserver(() => {
      m.resize();
    });
    ro.observe(container.current);

    return () => {
      ro.disconnect();
      dropPending();
      m.remove();
      map.current = null;
    };
    // Intentional: build only once. What it draws arrives as the scene below.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [intent, send]);

  // --- Which corner the provenance stands in -------------------------------
  // Placed with the map and moved when the layout changes under it; what each
  // corner means is `placeProvenance` above.
  useEffect(() => {
    const m = map.current;
    const controls = provenance.current;
    if (!m || !controls || placedFor.current === env.mobile) return;
    placedFor.current = env.mobile;
    for (const control of [
      controls.attribution,
      controls.scale,
      controls.level,
    ])
      m.removeControl(control);
    placeProvenance(m, controls, env.mobile, container.current);
  }, [env.mobile]);

  // --- Which base ----------------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const next = resolveBase(base);
    if (next === appliedBase.current) return;
    appliedBase.current = next;
    applyBase(m, next, env.scheme);
  }, [base, ready, env.scheme]);

  // --- Which overlays ------------------------------------------------------
  // What is on is applied from the stored value rather than only at the switch
  // that changed it, for the reason the base has an effect too: the map is
  // built before the stored value is known, so the first style carries the
  // defaults and this is what catches up.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    for (const id of ["hillshade", ...OVERLAYS.map((o) => o.id)])
      m.setLayoutProperty(
        id === "hillshade" ? "hillshade" : `ov-${id}`,
        "visibility",
        overlays.includes(id) ? "visible" : "none",
      );
  }, [overlays, ready]);

  // --- Follow the OS colour scheme -----------------------------------------
  // The tokens flip with it: the base is swapped for its twin, the icons are
  // repainted and every paint property of the app's layers is set again from
  // the definition the style was built from. Camera, sources, filters and
  // feature state are not touched, so nothing is lost or reloaded.
  //
  // The map is built in the scheme that was current then, so this is a change
  // and not a first application: the ref is what tells the two apart, and it
  // is why re-running on a base change costs nothing.
  useEffect(() => {
    const m = map.current;
    const el = container.current;
    if (!m || !el || !ready || appliedScheme.current === env.scheme) return;
    const s = env.scheme;
    appliedScheme.current = s;
    const colors = readColors(el);
    addIcons(m, colors);
    if (resolveBase(base) === BASEMAP_ID) applyBase(m, BASEMAP_ID, s);
    const repaint = (id: string, paint: object) => {
      for (const [k, v] of Object.entries(paint) as [never, never][])
        m.setPaintProperty(id, k, v);
    };
    repaint("hillshade", hillshadePaint(s));
    for (const layer of appLayers(colors, env))
      repaint(layer.id, layer.paint ?? {});
  }, [ready, base, env]);

  // --- The camera ----------------------------------------------------------
  // Five prop changes, five events, and the machine decides what each one
  // costs (`camera`, lib/map-camera.ts). The order they stand in is the order
  // they run in within one commit, and it is load-bearing twice: the opening
  // camera is known before the map reports for duty, and a selection is
  // announced before the padding its panel claims – so that padding belongs to
  // the flight instead of easing in ahead of it.
  useEffect(() => {
    if (intent) send({ intent, type: "intent" });
  }, [intent, send]);

  // What the map draws is what it opens on, so this is dispatched again until
  // something has been framed: the lines and dots may arrive after the style.
  useEffect(() => {
    if (ready) send({ bounds: scene.bounds, type: "ready" });
  }, [ready, scene.bounds, send]);

  useEffect(() => {
    if (!ready) return;
    send({
      key: selKey,
      target: selection
        ? flightFor(selection, {
            passBounds: assets.passBounds,
            passes: rows.pass.map((r) => r.pass),
            tourBounds: assets.tourBounds,
            towns: rows.town.map((r) => r.town),
          })
        : null,
      type: "selection",
    });
    // Intentional: the selection is the trigger; the boxes are only looked up
    // in it, and a filtered list must not re-fly the camera.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [selKey, ready]);

  const { bottom, left, right, top } = inset;
  useEffect(() => {
    send({ inset: { bottom, left, right, top }, type: "inset" });
  }, [bottom, left, right, top, send]);

  useEffect(() => {
    if (ready && requestedView)
      send({ type: "requestedView", view: requestedView });
  }, [requestedView, ready, send]);

  // --- What the map shows --------------------------------------------------
  /**
   * The scene, handed to MapLibre as the difference to the one before it
   * (`applyScene`, components/map/apply-scene.ts).
   *
   * This was four effects and two hover states: one deciding what the ascents
   * show, one the tours, two writing the point sources, and beside them a
   * `hoverKey` owned by the map's pointer and a `painted` ref owned by the
   * `hovered` prop. Nothing reconciled the two, which is why a town hovered in
   * the list drew no reach hull and a pass filtered out under the pointer kept
   * its ascents highlighted. One value, applied in one place, cannot disagree
   * with itself.
   *
   * Feature state set before the static line files have arrived is applied to
   * the tiles as they load, so nothing here waits for a source.
   */
  useEffect(() => {
    if (!ready || !host.current) return;
    applyScene(host.current, applied.current, scene);
    applied.current = scene;
  }, [scene, ready]);

  // Click on the profile: close enough to count the hairpins.
  useEffect(() => {
    if (!ready || !profileZoom) return;
    issue([
      {
        cmd: "flyTo",
        duration: env.reduceMotion ? 0 : PROFILE_MS,
        target: {
          kind: "point",
          point: { ...profileZoom, minZoom: PROFILE_ZOOM },
        },
      },
    ]);
  }, [profileZoom, ready, issue, env.reduceMotion]);

  const toggle3d = (pressed: boolean) => {
    const m = map.current;
    if (!m) return;
    setIs3d(pressed);
    m.setTerrain(pressed ? TERRAIN : null);
    // Coming back down straightens the map out as well: a tilted view is the
    // only reason to be turned away from north in the first place.
    issue([
      pressed
        ? { cmd: "easeTo", duration: 700, pitch: 60 }
        : { bearing: 0, cmd: "easeTo", duration: 600, pitch: 0 },
    ]);
  };

  const toggleOverlay = (id: string) =>
    setOverlays(
      overlays.includes(id)
        ? overlays.filter((o) => o !== id)
        : [...overlays, id],
    );

  /**
   * Fit the view to everything currently drawn. Pressed again while already
   * fitted (or when nothing is drawn) it returns to the whole-Alps overview.
   *
   * `cameraForBounds` is the one question only the map can answer – where a
   * box would put the camera at this size and padding; whether that is where
   * the camera already stands is `fitDone` (lib/map-camera.ts).
   */
  const fitToVisible = () => {
    const m = map.current;
    if (!m) return;
    const { bounds } = scene;
    const target = bounds
      ? m.cameraForBounds(bounds, { padding: FIT_PADDING })
      : undefined;
    const at = m.getCenter();
    const zoom = target?.zoom;
    const to =
      target && zoom !== undefined
        ? LngLat.convert(target.center as [number, number])
        : null;
    const already =
      to !== null &&
      zoom !== undefined &&
      fitDone(
        { lat: at.lat, lon: at.lng, zoom: m.getZoom() },
        { lat: to.lat, lon: to.lng, zoom },
      );
    issue([
      bounds && !already
        ? { bounds, cmd: "fitBounds", duration: FIT_MS, padding: FIT_PADDING }
        : {
            cmd: "flyTo",
            duration: FIT_MS,
            target: { kind: "view", view: DEFAULT_VIEW },
          },
    ]);
  };

  return (
    <div className="bg-muted relative size-full overflow-hidden">
      {/* Plain "absolute inset-0" loses against the unlayered maplibre-gl.css (`.maplibregl-map { position: relative }`). */}
      <div ref={container} className="size-full" />

      {/*
       * The map's own corner: which way is up, how it is framed, and what the
       * picture is drawn on. One group on one glass surface, opposite the
       * sidebar so the two never meet, and below the header bar, whose height
       * it is given as the inset's top edge. Everything a visitor presses is
       * here; the bottom-left corner carries only the things that are read.
       */}
      <div
        style={{ top: inset.top + 12 }}
        className="absolute right-3 z-10 transition-[top] duration-200 motion-reduce:transition-none"
      >
        <ButtonGroup orientation="vertical" className={MAP_CLUSTER}>
          {turned && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-lg"
                    variant="outline"
                    className={cn(TOOL, MAP_TOOL)}
                    onClick={() => {
                      issue([{ bearing: 0, cmd: "easeTo", duration: 400 }]);
                    }}
                    aria-label="Nach Norden ausrichten"
                  />
                }
              >
                <Compass ref={aimNeedle} />
              </TooltipTrigger>
              <TooltipContent side="left">
                Nach Norden ausrichten
              </TooltipContent>
            </Tooltip>
          )}
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
              <Scan />
            </TooltipTrigger>
            <TooltipContent side="left">
              Ansicht einpassen – erneut für die ganzen Alpen
            </TooltipContent>
          </Tooltip>

          {/*
           * Everything that changes how the map looks rather than where it
           * looks, behind one "…": the base, the overlays and the tilt. They
           * are answered once per visit and then left alone, so they do not
           * earn a button each on a phone screen.
           */}
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
                        aria-label="Ansicht: Karte, Ebenen und 3D"
                      />
                    }
                  />
                }
              >
                <MoreHorizontal />
              </TooltipTrigger>
              <TooltipContent side="left">Ansicht</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" side="left" className="w-60 gap-3">
              <FieldSet className="gap-2">
                <FieldLegend variant="label">Grundkarte</FieldLegend>
                <RadioGroup
                  value={resolveBase(base)}
                  onValueChange={(v) => setBase(String(v))}
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
                    <FieldLabel htmlFor={`ov-${o.id}`} className="font-normal">
                      {o.name}
                    </FieldLabel>
                  </Field>
                ))}
              </FieldSet>
              <FieldSet className="gap-2">
                <FieldLegend variant="label">Gelände</FieldLegend>
                <Field orientation="horizontal">
                  <Switch
                    size="sm"
                    id="terrain-3d"
                    checked={is3d}
                    onCheckedChange={toggle3d}
                  />
                  <FieldLabel htmlFor="terrain-3d" className="font-normal">
                    3D-Ansicht
                  </FieldLabel>
                </Field>
              </FieldSet>
            </PopoverContent>
          </Popover>
        </ButtonGroup>
      </div>
    </div>
  );
};
