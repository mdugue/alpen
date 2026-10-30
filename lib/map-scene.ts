/**
 * What the map shows, as a value.
 *
 * The rows, the "auf der Karte" switches, the selection and the hover go in;
 * out comes one scene – the layer filters, the feature state, the point
 * features with their properties, the hover surfaces and the box that "fit to
 * visible" frames. Nothing here talks to MapLibre: `applyScene` in
 * `components/map/` diffs two scenes and is the only place that does
 * (docs/plans/30-map-scene.md), which is what makes everything the map draws
 * readable and testable without a WebGL context.
 *
 * The hover is the reason this is one value rather than four effects. The map
 * used to keep two hover states – one owned by its own pointer, one by the
 * `hovered` prop – and they disagreed: a town hovered in the list drew no
 * reach hull, and a pass filtered out under the pointer kept its ascents
 * highlighted until something else hovered them. Here the pointer only reports
 * what it is over; every mark it draws comes back through the scene, so the
 * list and the map answer one another with the same picture.
 */

import type { FeatureCollection, Point, Polygon } from "geojson";
import type { FilterSpecification } from "maplibre-gl";

import type { Selection, Shown } from "@/lib/app-state";
import { isShown } from "@/lib/app-state";
import {
  areasOf,
  FAN_MIN_ENTRIES,
  fanFits,
  fanKey,
  fanTarget,
  nearness,
  TOUR_AREAS_MAX,
} from "@/lib/fan";
import type { FanKind, FitView } from "@/lib/fan";
import type { Bounds, Ring } from "@/lib/geo";
import { surfaceWord, tagLabel, typeWord } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n";
import { visibleBounds } from "@/lib/map-camera";
import type { TownReach } from "@/lib/nearby";
import { rankOf, shortName } from "@/lib/prominence";
import { CLASSIC_FAME, HOME_RANGE, rangeOf, STATUSES } from "@/lib/regions";
import { ascentKey } from "@/lib/route-key";
import type { PassRow, Rows, TourRow, TownRow } from "@/lib/rows";
import type { Fix, LatLon, Status, Surface, Tag } from "@/lib/types";
import { fmtUnit } from "@/lib/utils";

/** MapLibre reads properties as numbers and strings; a flag is 0 or 1. */
type Flag = 0 | 1;

const flag = (on: boolean): Flag => (on ? 1 : 0);

/** What a pass dot is drawn from: status by hue, fame by size, the rest by state. */
export interface PassProps {
  fame: number;
  favorite: Flag;
  name: string;
  /** Where the road stands on the label ladder (`rankOf`, lib/prominence.ts). */
  rank: number;
  /** The name as the overview writes it (`shortName`, lib/prominence.ts). */
  short: string;
  selected: Flag;
  slug: string;
  status: Status;
  /** An unpaved road's dot carries a ring (plan 27). */
  surface: Surface;
}

/**
 * A road the filters leave out, drawn as a shadow (`LAYERS.ghost`): a small
 * grey dot with no status and no name, at every zoom, its ascents a grey
 * hairline from zoom 8 (`ROUTE_GHOST`) – enough to say there is more here,
 * and to be tapped, without competing with what the filters chose.
 */
export interface GhostProps {
  fame: number;
  name: string;
  slug: string;
}

export interface TownProps {
  favorite: Flag;
  name: string;
  selected: Flag;
  slug: string;
}

/**
 * A destination on the map: its name, and how much of it is rideable in the
 * chosen half-month as a share from 0 to 1 – which of two crowding names
 * MapLibre keeps. The outline and the point its name stands on carry the same
 * properties. The hover rides in the properties rather than in feature state
 * because the source is rewritten from the rows anyway, and one path is fewer
 * than two. How many of its roads are good is not on the map: the hover label
 * and the list say it, and on the map it was the most text there was.
 */
export interface DestinationProps {
  favorite: Flag;
  hovered: Flag;
  name: string;
  /** Rideable roads over all roads, 0 for an area without a graded road. */
  share: number;
  selected: Flag;
  slug: string;
}

/**
 * The hovered mark, its own one-feature source: the ring is drawn around it,
 * over the mark that is already there – a shadow under the pointer stays grey.
 */
export interface HoverProps {
  kind: "ghost" | "pass" | "town";
}

export interface RouteState {
  hovered: Flag;
  selected: Flag;
  status: Status;
}

export interface TourState {
  hovered: Flag;
  selected: Flag;
}

/**
 * The hover label – the typed lookup from an entity to what the popup says,
 * rather than properties re-read off a rendered feature and a tag list
 * re-split from a comma string.
 *
 * It points at the entity itself and not at the pointer: a hit on an ascent is
 * a hit on its pass, so the label stands where the ring does. A tour has no
 * point of its own and is labelled at the centre of its box.
 */
export interface PopupContent {
  /** `[lon, lat]` – where the label points. */
  anchor: [number, number];
  name: string;
  subtitle: string | null;
  /** The editorial labels, each with its word: the popup is an HTML string, not a component that could ask. */
  tags: readonly (readonly [tag: Tag, label: string])[];
}

/**
 * An area's roads, towns and loops laid out round its outline (lib/fan.ts):
 * which area, its outline and the drawn members it holds, on the map's
 * coordinates. Where they go on the screen is the overlay's to work out,
 * because only the map knows where a coordinate is drawn.
 */
export interface SceneFan {
  slug: string;
  name: string;
  outline: Ring;
  items: {
    kind: FanKind;
    slug: string;
    name: string;
    /**
     * What its hover label would have said beside the name – a road's height,
     * a town's labels, a loop's length and climb – said beside the name the
     * pointer is on.
     */
    detail: string | null;
    status: Status | null;
    classic: boolean;
    /** Where its line ends: the dot, or for a loop the point of it nearest the area's centre. */
    lon: number;
    lat: number;
  }[];
}

/**
 * A pass dot's or a town's feature state: whether the fan names it right now
 * (`Scene.fan`), so its own label steps aside. State rather than a property,
 * because a fan opens on every area the pointer crosses and a property would
 * re-tile the whole source each time.
 */
export interface PassState {
  fanned: Flag;
}

export interface Scene {
  routes: {
    /** Every drawn ascent: the rim under the lines, the dash over them and the hit area. */
    filter: FilterSpecification;
    /**
     * The same ascents split by status, one line layer each (`ROUTE_LINES`),
     * so a rideable road is drawn over a closed one where two cross. The
     * status is feature state, and feature state cannot order a layer.
     */
    byStatus: Record<Status, FilterSpecification>;
    /** Which ascents are drawn as the shadows' thin grey lines (`ROUTE_GHOST`). */
    ghosts: FilterSpecification;
    state: Record<string, RouteState>;
  };
  tours: { filter: FilterSpecification; state: Record<string, TourState> };
  passes: FeatureCollection<Point, PassProps>;
  /** Keyed by slug, every drawn pass. */
  passState: Record<string, PassState>;
  /** The same for the towns, whose names join from zoom 8. */
  townState: Record<string, PassState>;
  /** The roads the filters leave out, as shadows; empty while the roads are off the map. */
  ghosts: FeatureCollection<Point, GhostProps>;
  towns: FeatureCollection<Point, TownProps>;
  /** The destination outlines, under everything else; empty when their switch is off. */
  destinations: FeatureCollection<Polygon, DestinationProps>;
  /** Where each destination's name stands: the roomiest spot in its outline (`labelSpot`). */
  destinationLabels: FeatureCollection<Point, DestinationProps>;
  hover: {
    mark: FeatureCollection<Point, HoverProps>;
    /** The hovered town's reach hull, straight out of `townReach`. */
    hull: Ring | null;
    popup: PopupContent | null;
  };
  /** The area whose roads are named round it (`fanTarget`), or nothing. */
  fan: SceneFan | null;
  /**
   * The area the fan should show (`fanTarget`), which `fan` follows after a
   * delay: the pass map holds it, the scene only says where it is going.
   */
  fanNext: string | null;
  /** The road point under the elevation-profile cursor. */
  cursor: FeatureCollection<Point, Record<string, never>>;
  /**
   * Where the visitor is; `halo` is how far off the fix may be, in pixels at
   * zoom 0 at its own latitude, which the layer doubles per zoom step.
   */
  you: FeatureCollection<Point, { halo: number }>;
  /** What "fit to visible" frames; `null` while nothing is drawn. */
  bounds: Bounds | null;
  /**
   * What the map opens on: the drawn roads and loops of the home range
   * (`HOME_RANGE`), or everything drawn when none of it is there – a range
   * chip pressed before the map was ready, say. The Alps and the Pyrenees are
   * 600 km apart, and a first screen holding both shows neither
   * (docs/plans/26-pyrenees.md).
   */
  opening: Bounds | null;
}

export interface SceneInput {
  rows: Rows;
  /**
   * The roads the filters leave out, with the status they would have: drawn
   * as shadows, and drawn whole once selected – a road opened from its shadow
   * is shown like any other, lines and all.
   */
  ghosts: readonly PassRow[];
  shown: Shown;
  selection: Selection | null;
  hovered: Selection | null;
  townReach: TownReach;
  /** Per tour slug, the box its line covers – where a tour's label points. */
  tourBounds: Record<string, Bounds>;
  profileCursor: LatLon | null;
  /** The visitor's position, once they have asked for it; never stored, never in a link. */
  you: Fix | null;
  /** The area whose roads are fanned out round it now (`Scene.fanNext` a moment ago). */
  fan: string | null;
  /** Whether the pointer is on the open fan's names, which holds it open. */
  overFan: boolean;
  /**
   * The zoom and the size of what the panels leave of the map, for whether an
   * area is small enough to fan out (`fanFits`); `null` before the map is.
   */
  view: FitView | null;
  /**
   * What the pointer can do here. A coarse pointer has no hover to speak of:
   * a finger that touches a mark has already tapped it, and a label under the
   * finger would cover what was just tapped, so the scene carries no popup
   * (docs/plans/11-smaller-items.md, item 16). That is by design – the panel a
   * tap opens says all of it and more.
   */
  env: { coarse: boolean };
  /** The page's words: what the popup says. */
  w: Messages;
}

const collection = <P>(
  features: { at: readonly [number, number]; props: P }[],
): FeatureCollection<Point, P> => ({
  features: features.map(({ at, props }) => ({
    geometry: { coordinates: [at[0], at[1]], type: "Point" },
    properties: props,
    type: "Feature",
  })),
  type: "FeatureCollection",
});

/** Which lines of a kind are drawn – the hit layer carries the same filter. */
const slugFilter = (slugs: readonly string[]): FilterSpecification =>
  ["in", ["get", "slug"], ["literal", slugs]] as unknown as FilterSpecification;

const slugOf = (sel: Selection | null, kind: Selection["kind"]) =>
  sel?.kind === kind ? sel.slug : null;

/**
 * The one line under a road's name: how high it goes and what kind of road it
 * is – and, for a shadow, why it is grey.
 */
const roadSubtitle = (row: PassRow, w: Messages, ghost = false) =>
  [
    fmtUnit(row.pass.elevation, "m", 0, w.lang),
    typeWord(row.pass.type, w),
    surfaceWord(row.pass.surface, w),
    ghost && w.map.filteredOut,
  ]
    .filter(Boolean)
    .join(" · ");

/** What the hover source holds: where the ring goes, and around which kind. */
const hoverMark = (
  road: PassRow | undefined,
  ghost: boolean,
  town: TownRow | undefined,
): { at: readonly [number, number]; props: HoverProps }[] => {
  if (road)
    return [
      {
        at: [road.pass.lon, road.pass.lat],
        props: { kind: ghost ? "ghost" : "pass" },
      },
    ];
  return town
    ? [{ at: [town.town.lon, town.town.lat], props: { kind: "town" } }]
    : [];
};

/** A road by slug, among the drawn ones or else the shadows – and which of the two. */
const roadAt = (
  drawn: readonly PassRow[],
  ghosts: readonly PassRow[],
  slug: string | null,
): { row: PassRow | undefined; ghost: boolean } => {
  // A selected shadow is among the drawn ones, and still a shadow.
  const ghost = ghosts.find((r) => r.pass.slug === slug);
  return {
    ghost: ghost !== undefined,
    row: drawn.find((r) => r.pass.slug === slug) ?? ghost,
  };
};

/** The shadows: every road the filters leave out, but the selected one, which is drawn whole. */
const shadows = (ghosts: readonly PassRow[], selPass: string | null) =>
  collection<GhostProps>(
    ghosts
      .filter((row) => row.pass.slug !== selPass)
      .map((row) => ({
        at: [row.pass.lon, row.pass.lat],
        props: {
          fame: row.pass.fame,
          name: row.pass.name,
          slug: row.pass.slug,
        },
      })),
  );

const labelled = (tags: readonly Tag[], w: Messages) =>
  tags.map((tag) => [tag, tagLabel(tag, w)] as const);

/** A loop's one line: how long it is and how much it climbs. */
const tourSubtitle = ({ tour }: TourRow, w: Messages) =>
  `${w.vocab.unit.approx} ${fmtUnit(tour.km, "km", 0, w.lang)} · ${fmtUnit(tour.elevationGain, w.vocab.unit.climb, 0, w.lang)}`;

/** The northernmost corner of a ring, `[lon, lat]`. */
const topOf = (ring: Ring): [number, number] => {
  let [lon, lat] = ring[0] ?? [0, 0];
  for (const [x, y] of ring) if (y > lat) [lon, lat] = [x, y];
  return [lon, lat];
};

/**
 * Metres per pixel at zoom 0 on the equator, for 512-pixel tiles; a parallel
 * shrinks with the cosine of its latitude.
 */
const METRES_PER_PX_Z0 = 78_271.517;

/** A fix's accuracy as a radius in pixels at zoom 0, where it was taken. */
const haloPx = ({ accuracy, lat }: Fix) =>
  accuracy / (METRES_PER_PX_Z0 * Math.cos((lat * Math.PI) / 180));

/**
 * The feature state of every tour the rows hold, and the one selected tour
 * they do not: a selected tour the filters leave out is drawn all the same,
 * as a selected shadow is – the panel shows it, so the map has to. Its line
 * is in the tour file whatever the filters say; only the filter and the state
 * ask for it.
 */
const toursDrawn = (
  rows: SceneInput["rows"]["tour"],
  shown: SceneInput["shown"],
  selTour: string | null,
  hoverTour: string | null,
): { strayTour: string | null; tourState: Record<string, TourState> } => {
  const tourState: Record<string, TourState> = {};
  for (const { tour } of rows)
    tourState[tour.slug] = {
      hovered: flag(tour.slug === hoverTour),
      selected: flag(tour.slug === selTour),
    };
  const strayTour =
    selTour &&
    !rows.some(({ tour }) => tour.slug === selTour) &&
    isShown(shown, "tour", selTour)
      ? selTour
      : null;
  if (strayTour)
    tourState[strayTour] = {
      hovered: flag(strayTour === hoverTour),
      selected: 1,
    };
  return { strayTour, tourState };
};

/**
 * What the fan is built from: the scene's input and the roads it draws – and
 * the fans already built for it, since one scene asks after the same area
 * several times.
 */
interface FanSource {
  input: SceneInput;
  drawn: readonly PassRow[];
  built: Map<string, SceneFan | null>;
}

/** A loop's point nearest a centre: where the fan's line to it ends. */
const nearestOn = (waypoints: readonly LatLon[], to: LatLon): LatLon => {
  let best = waypoints[0]!;
  for (const p of waypoints) if (nearness(to, p) < nearness(to, best)) best = p;
  return best;
};

/**
 * The fan's half of the scene: the area, if the map draws it, and the roads,
 * towns and loops of it the filters draw – nothing when there is only one to
 * name, or when the area is too large on the screen for a fan (`fanFits`).
 */
const buildFan = (
  slug: string,
  { drawn, input }: FanSource,
): SceneFan | null => {
  const { rows, shown, view, w } = input;
  const row = shown.destinations
    ? rows.destination.find((r) => r.destination.slug === slug)
    : undefined;
  if (!row || !fanFits(row.members.bounds, view)) return null;
  const { center } = row.destination;
  const { members } = row;
  const roads = shown.passes
    ? drawn.filter((r) => members.passes.includes(r.pass.slug))
    : [];
  const towns = rows.town.filter((r) => members.towns.includes(r.town.slug));
  // A loop through more areas than `TOUR_AREAS_MAX` is a journey, not one of
  // the area's loops: it opens no fan, and no fan names it.
  const areasHolding = (tour: string) =>
    rows.destination.filter((r) => r.members.tours.includes(tour)).length;
  const tours = rows.tour.filter(
    (r) =>
      members.tours.includes(r.tour.slug) &&
      isShown(shown, "tour", r.tour.slug) &&
      areasHolding(r.tour.slug) <= TOUR_AREAS_MAX,
  );
  const items: SceneFan["items"] = [
    ...roads.map((r) => ({
      classic: r.pass.fame >= CLASSIC_FAME,
      detail: fmtUnit(r.pass.elevation, "m", 0, w.lang),
      kind: "pass" as const,
      lat: r.pass.lat,
      lon: r.pass.lon,
      name: r.pass.name,
      slug: r.pass.slug,
      status: r.status,
    })),
    ...towns.map((r) => ({
      classic: false,
      detail:
        labelled(r.town.tags, w)
          .map(([, label]) => label)
          .join(" · ") || null,
      kind: "town" as const,
      lat: r.town.lat,
      lon: r.town.lon,
      name: r.town.name,
      slug: r.town.slug,
      status: null,
    })),
    ...tours.map((r) => ({
      classic: false,
      detail: tourSubtitle(r, w),
      kind: "tour" as const,
      ...nearestOn(r.tour.waypoints, center),
      name: r.tour.name,
      slug: r.tour.slug,
      status: r.status,
    })),
  ];
  if (items.length < FAN_MIN_ENTRIES) return null;
  return {
    items,
    name: row.destination.name,
    outline: members.outline,
    slug: row.destination.slug,
  };
};

/** One area's fan, built once per scene (`buildFan`). */
const fanOf = (slug: string | null, src: FanSource): SceneFan | null => {
  if (slug === null) return null;
  if (!src.built.has(slug)) src.built.set(slug, buildFan(slug, src));
  return src.built.get(slug) ?? null;
};

/**
 * Which area the fan should show, and which outline answers the pointer – one
 * decision for the fan, the labels it replaces and the outline, so the three
 * cannot disagree. A road, town or tour offers only the areas that have a fan
 * to open (`fanOf`); its outline lights even where there is none.
 */
const fanDecision = (src: FanSource) => {
  const { env, fan, ghosts, hovered, overFan, rows, selection, tourBounds } =
    src.input;
  const index = { ...rows, pass: [...src.drawn, ...ghosts], tourBounds };
  const areas = (sel: Selection) => areasOf(sel, index);
  const opens = (a: string | null) => fanOf(a, src) !== null;
  // A finger has no hover, and beside the drawer a fan has no room: on a
  // phone the names come with the zoom instead (`appLayers`).
  const target = env.coarse
    ? null
    : fanTarget({
        areasOf: (sel) => areas(sel).filter(opens),
        current: fan,
        // An area pointed at that is too large for a fan is as good as
        // nothing pointed at: the fan open or in the panel stays.
        hovered:
          hovered?.kind === "destination" && !opens(hovered.slug)
            ? null
            : hovered,
        overFan: fan !== null && overFan,
        selection,
      });
  // An area pointed at or open in the panel is no exception to the rule:
  // too large on the screen, it has no fan either.
  const next = opens(target) ? target : null;
  const own = hovered ? areas(hovered) : [];
  const pointed =
    slugOf(hovered, "destination") ??
    (next !== null && own.includes(next) ? next : own[0]);
  // What the fan is about to name, so no popup flashes before it opens.
  const fanning = new Set(fanOf(next, src)?.items.map(fanKey));
  return { fanning, hoverArea: pointed, next };
};

/** Which drawn marks of a kind the fan names, so their own labels step aside meanwhile. */
const fannedState = (
  slugs: readonly string[],
  kind: FanKind,
  fan: SceneFan | null,
): Record<string, PassState> => {
  const named = new Set(fan?.items.map(fanKey));
  return Object.fromEntries(
    slugs.map((slug) => [
      slug,
      { fanned: flag(named.has(fanKey({ kind, slug }))) },
    ]),
  );
};

export const buildScene = (input: SceneInput): Scene => {
  const {
    env,
    fan,
    ghosts,
    hovered,
    profileCursor,
    rows,
    selection,
    shown,
    tourBounds,
    townReach,
    w,
    you,
  } = input;
  const selDestination = slugOf(selection, "destination");
  const selPass = slugOf(selection, "pass");
  const selTour = slugOf(selection, "tour");
  const selTown = slugOf(selection, "town");
  const hoverDestination = slugOf(hovered, "destination");
  const hoverPass = slugOf(hovered, "pass");
  const hoverTour = slugOf(hovered, "tour");
  const hoverTown = slugOf(hovered, "town");

  // A shadow that is selected is drawn whole: dot, ascents and all.
  const selGhost = ghosts.find((r) => r.pass.slug === selPass);
  const drawn = selGhost ? [...rows.pass, selGhost] : rows.pass;

  const routeState: Record<string, RouteState> = {};
  for (const row of drawn) {
    const { slug } = row.pass;
    for (const [i] of row.pass.ascents.entries())
      routeState[ascentKey(slug, i)] = {
        hovered: flag(slug === hoverPass),
        selected: flag(slug === selPass),
        status: row.status,
      };
  }

  const visibleTours = rows.tour.filter(({ tour }) =>
    isShown(shown, "tour", tour.slug),
  );
  const { strayTour, tourState } = toursDrawn(
    rows.tour,
    shown,
    selTour,
    hoverTour,
  );

  const { ghost: ghostRow, row: passRow } = roadAt(drawn, ghosts, hoverPass);
  const townRow = hoverTown
    ? rows.town.find((r) => r.town.slug === hoverTown)
    : undefined;
  const tourRow = hoverTour
    ? visibleTours.find((r) => r.tour.slug === hoverTour)
    : undefined;
  const destinationRow = hoverDestination
    ? rows.destination.find((r) => r.destination.slug === hoverDestination)
    : undefined;
  // Only what is drawn answers a hover: a kind switched off the map has no
  // mark to ring, no hull to outline and nothing to label.
  const markedPass = shown.passes ? passRow : undefined;
  const markedTown = shown.destinations ? townRow : undefined;
  const markedDestination = shown.destinations ? destinationRow : undefined;
  const box = hoverTour ? tourBounds[hoverTour] : undefined;

  const src: FanSource = { built: new Map(), drawn, input };
  const fanned = fanOf(fan, src);
  const { fanning, hoverArea, next: fanNext } = fanDecision(src);
  const fanNames = (kind: FanKind, slug: string) =>
    fanning.has(fanKey({ kind, slug }));

  const popup = (): PopupContent | null => {
    if (env.coarse) return null;
    // A road, town or loop the fan names has its say there – its name and
    // its line beside the area – so it carries no hover label of its own,
    // not even in the moment before its fan opens. One outside every area,
    // alone in its area, in an area too large for a fan, or a shadow, still
    // does.
    if (markedPass && fanNames("pass", markedPass.pass.slug)) return null;
    if (markedTown && fanNames("town", markedTown.town.slug)) return null;
    if (tourRow && fanNames("tour", tourRow.tour.slug)) return null;
    if (markedPass)
      return {
        anchor: [markedPass.pass.lon, markedPass.pass.lat],
        name: markedPass.pass.name,
        subtitle: roadSubtitle(markedPass, w, ghostRow),
        tags: labelled(markedPass.pass.tags ?? [], w),
      };
    if (markedTown)
      return {
        anchor: [markedTown.town.lon, markedTown.town.lat],
        // What a town is, is what its labels say; it needs no second line.
        name: markedTown.town.name,
        subtitle: null,
        tags: labelled(markedTown.town.tags, w),
      };
    if (tourRow && box)
      return {
        anchor: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2],
        name: tourRow.tour.name,
        subtitle: tourSubtitle(tourRow, w),
        tags: [],
      };
    if (markedDestination)
      return {
        // The outline's northernmost point, not its centre: the popup stands
        // above its anchor, so it sits on the area's edge instead of over the
        // roads the pointer is exploring.
        anchor: topOf(markedDestination.members.outline),
        name: markedDestination.destination.name,
        subtitle: markedDestination.text,
        tags: [],
      };
    return null;
  };

  const loops = (list: readonly TourRow[]) =>
    list.map(({ tour }) => ({
      slug: tour.slug,
      visible: isShown(shown, "tour", tour.slug),
    }));
  const bounds = visibleBounds(
    rows.pass.map((r) => r.pass),
    loops(rows.tour),
    tourBounds,
    shown.passes,
  );
  const opening = visibleBounds(
    rows.pass
      .map((r) => r.pass)
      .filter((p) => rangeOf(p.region) === HOME_RANGE),
    loops(rows.tour.filter((r) => r.range === HOME_RANGE)),
    tourBounds,
    shown.passes,
  );

  const destinations = (shown.destinations ? rows.destination : []).map(
    (row) => ({
      props: {
        favorite: flag(row.favorite),
        hovered: flag(row.destination.slug === hoverArea),
        name: row.destination.name,
        selected: flag(row.destination.slug === selDestination),
        share: row.verdict.total
          ? (row.verdict.counts.best + row.verdict.counts.good) /
            row.verdict.total
          : 0,
        slug: row.destination.slug,
      },
      row,
    }),
  );

  return {
    bounds,
    cursor: collection(
      profileCursor
        ? [{ at: [profileCursor.lon, profileCursor.lat], props: {} }]
        : [],
    ),
    destinationLabels: collection(
      destinations.map(({ props, row }) => ({
        at: [row.members.label.lon, row.members.label.lat] as const,
        props,
      })),
    ),
    destinations: {
      features: destinations.map(({ props, row }) => ({
        geometry: {
          coordinates: [row.members.outline.map(([lon, lat]) => [lon, lat])],
          type: "Polygon",
        },
        properties: props,
        type: "Feature",
      })),
      type: "FeatureCollection",
    },
    fan: fanned,
    fanNext,
    ghosts: shadows(shown.passes ? ghosts : [], selPass),
    hover: {
      hull: (markedTown && townReach[markedTown.town.slug]) ?? null,
      mark: collection<HoverProps>(
        hoverMark(
          markedPass,
          ghostRow && markedPass?.pass.slug !== selPass,
          markedTown,
        ),
      ),
      popup: popup(),
    },
    opening: opening ?? bounds,
    passState: fannedState(
      drawn.map((r) => r.pass.slug),
      "pass",
      fanned,
    ),
    passes: collection<PassProps>(
      (shown.passes ? drawn : []).map((row) => ({
        at: [row.pass.lon, row.pass.lat],
        props: {
          fame: row.pass.fame,
          favorite: flag(row.favorite),
          name: row.pass.name,
          rank: rankOf(row.pass),
          selected: flag(row.pass.slug === selPass),
          short: shortName(row.pass.name),
          slug: row.pass.slug,
          status: row.status,
          surface: row.pass.surface,
        },
      })),
    ),
    routes: {
      byStatus: Object.fromEntries(
        STATUSES.map((status) => [
          status,
          slugFilter(
            shown.passes
              ? drawn.filter((r) => r.status === status).map((r) => r.pass.slug)
              : [],
          ),
        ]),
      ) as Record<Status, FilterSpecification>,
      filter: slugFilter(shown.passes ? drawn.map((r) => r.pass.slug) : []),
      ghosts: slugFilter(
        shown.passes
          ? ghosts.map((r) => r.pass.slug).filter((slug) => slug !== selPass)
          : [],
      ),
      state: routeState,
    },
    tours: {
      filter: slugFilter([
        ...visibleTours.map(({ tour }) => tour.slug),
        ...(strayTour ? [strayTour] : []),
      ]),
      state: tourState,
    },
    townState: fannedState(
      rows.town.map((r) => r.town.slug),
      "town",
      fanned,
    ),
    towns: collection<TownProps>(
      (shown.destinations ? rows.town : []).map((row) => ({
        at: [row.town.lon, row.town.lat],
        props: {
          favorite: flag(row.favorite),
          name: row.town.name,
          selected: flag(row.town.slug === selTown),
          slug: row.town.slug,
        },
      })),
    ),
    you: collection(
      you ? [{ at: [you.lon, you.lat], props: { halo: haloPx(you) } }] : [],
    ),
  };
};
