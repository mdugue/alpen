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
 * An area's roads laid out round its outline (lib/fan.ts): which area, its
 * outline and the drawn roads it holds, on the map's coordinates. Where they
 * go on the screen is the overlay's to work out, because only the map knows
 * where a coordinate is drawn.
 */
export interface SceneFan {
  slug: string;
  name: string;
  outline: Ring;
  roads: {
    slug: string;
    name: string;
    status: Status;
    classic: boolean;
    lon: number;
    lat: number;
  }[];
}

/**
 * A pass dot's feature state: whether the fan names it right now
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
  /** The area whose roads are fanned out round it (`fanTarget`, lib/fan.ts). */
  fan: string | null;
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
 * The fan's half of the scene: the area, if the map draws it, and the roads
 * of it the filters draw – nothing when there are none to name.
 */
const fanOf = (
  slug: string | null,
  rows: Rows,
  shown: Shown,
  drawn: readonly PassRow[],
): SceneFan | null => {
  const row = shown.destinations
    ? rows.destination.find((r) => r.destination.slug === slug)
    : undefined;
  const roads =
    row && shown.passes
      ? drawn.filter((r) => row.members.passes.includes(r.pass.slug))
      : [];
  if (!row || roads.length === 0) return null;
  return {
    name: row.destination.name,
    outline: row.members.outline,
    roads: roads.map((r) => ({
      classic: r.pass.fame >= CLASSIC_FAME,
      lat: r.pass.lat,
      lon: r.pass.lon,
      name: r.pass.name,
      slug: r.pass.slug,
      status: r.status,
    })),
    slug: row.destination.slug,
  };
};

/** Which drawn roads the fan names, so their own labels step aside meanwhile. */
const passStateOf = (
  drawn: readonly PassRow[],
  fan: SceneFan | null,
): Record<string, PassState> => {
  const named = new Set(fan?.roads.map((r) => r.slug));
  return Object.fromEntries(
    drawn.map((r) => [r.pass.slug, { fanned: flag(named.has(r.pass.slug)) }]),
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

  const popup = (): PopupContent | null => {
    if (env.coarse) return null;
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
        subtitle: `${w.vocab.unit.approx} ${fmtUnit(tourRow.tour.km, "km", 0, w.lang)} · ${fmtUnit(tourRow.tour.elevationGain, w.vocab.unit.climb, 0, w.lang)}`,
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

  const fanned = fanOf(fan, rows, shown, drawn);

  const destinations = (shown.destinations ? rows.destination : []).map(
    (row) => ({
      props: {
        favorite: flag(row.favorite),
        hovered: flag(row.destination.slug === hoverDestination),
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
    passState: passStateOf(drawn, fanned),
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
