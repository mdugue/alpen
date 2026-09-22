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
import { circleRing } from "@/lib/geo";
import type { Bounds } from "@/lib/geo";
import { visibleBounds } from "@/lib/map-camera";
import type { TownReach } from "@/lib/nearby";
import {
  HOME_RANGE,
  inBox,
  RANGE_BOUNDS,
  rangeOf,
  roadTypeWord,
} from "@/lib/regions";
import { ascentKey } from "@/lib/route-key";
import type { PassRow, Rows } from "@/lib/rows";
import type { LatLon, Status, Tag } from "@/lib/types";
import { fmt, fmtUnit } from "@/lib/utils";

/** MapLibre reads properties as numbers and strings; a flag is 0 or 1. */
type Flag = 0 | 1;

const flag = (on: boolean): Flag => (on ? 1 : 0);

/** What a pass dot is drawn from: status by hue, fame by size, the rest by state. */
export interface PassProps {
  fame: number;
  favorite: Flag;
  name: string;
  selected: Flag;
  slug: string;
  status: Status;
}

export interface TownProps {
  favorite: Flag;
  name: string;
  selected: Flag;
  slug: string;
}

/**
 * A destination's circle: its name, and how much of it is rideable in the
 * chosen half-month as a share from 0 to 1 – what the outline is tinted by.
 * The hover rides in the properties rather than in feature state because the
 * source is rewritten from the rows anyway, and one path is fewer than two.
 */
export interface DestinationProps {
  favorite: Flag;
  hovered: Flag;
  name: string;
  /** Rideable roads over all roads, 0 for an area without a graded road. */
  share: number;
  selected: Flag;
  slug: string;
  /** "7 von 9 Straßen gut" – the second line of the label. */
  text: string;
}

/**
 * The hovered mark, drawn from its own one-feature source: at a zoom where
 * the level of detail hides a pass's dot, a row hovered in the list would
 * otherwise ring an empty patch of map. A town needs nothing but its kind –
 * only the ring is drawn for it.
 */
export type HoverProps =
  | ({ kind: "pass" } & Omit<PassProps, "name" | "slug">)
  | { kind: "town" };

export interface RouteState {
  hovered: Flag;
  selected: Flag;
  status: Status;
}

export interface TourState {
  hovered: Flag;
  selected: Flag;
}

/** One hull ring as `lib/nearby.ts` stores it: `[lon, lat]`, open. */
export type Ring = readonly (readonly [number, number])[];

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
  tags: readonly Tag[];
}

export interface Scene {
  routes: { filter: FilterSpecification; state: Record<string, RouteState> };
  tours: { filter: FilterSpecification; state: Record<string, TourState> };
  passes: FeatureCollection<Point, PassProps>;
  towns: FeatureCollection<Point, TownProps>;
  /** The destination circles, under everything else; drawn in the overview only. */
  destinations: FeatureCollection<Polygon, DestinationProps>;
  hover: {
    mark: FeatureCollection<Point, HoverProps>;
    /** The hovered town's reach hull, straight out of `townReach`. */
    hull: Ring | null;
    popup: PopupContent | null;
  };
  /** The road point under the elevation-profile cursor. */
  cursor: FeatureCollection<Point, Record<string, never>>;
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
  shown: Shown;
  selection: Selection | null;
  hovered: Selection | null;
  townReach: TownReach;
  /** Per tour slug, the box its line covers – where a tour's label points. */
  tourBounds: Record<string, Bounds>;
  profileCursor: LatLon | null;
  /**
   * What the pointer can do here. A coarse pointer has no hover to speak of:
   * a finger that touches a mark has already tapped it, and a label under the
   * finger would cover what was just tapped, so the scene carries no popup
   * (docs/plans/11-smaller-items.md, item 16). That is by design – the panel a
   * tap opens says all of it and more.
   */
  env: { coarse: boolean };
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

/** The one line under a road's name: how high it goes and what kind of road it is. */
const roadSubtitle = (row: PassRow) =>
  [fmtUnit(row.pass.elevation, "m"), roadTypeWord(row.pass.type)]
    .filter(Boolean)
    .join(" · ");

export const buildScene = (input: SceneInput): Scene => {
  const {
    env,
    hovered,
    profileCursor,
    rows,
    selection,
    shown,
    tourBounds,
    townReach,
  } = input;
  const selDestination = slugOf(selection, "destination");
  const selPass = slugOf(selection, "pass");
  const selTour = slugOf(selection, "tour");
  const selTown = slugOf(selection, "town");
  const hoverDestination = slugOf(hovered, "destination");
  const hoverPass = slugOf(hovered, "pass");
  const hoverTour = slugOf(hovered, "tour");
  const hoverTown = slugOf(hovered, "town");

  const routeState: Record<string, RouteState> = {};
  for (const row of rows.pass) {
    const { slug } = row.pass;
    for (const [i] of row.pass.ascents.entries())
      routeState[ascentKey(slug, i)] = {
        hovered: flag(slug === hoverPass),
        selected: flag(slug === selPass),
        status: row.status,
      };
  }

  const tourState: Record<string, TourState> = {};
  for (const { tour } of rows.tour)
    tourState[tour.slug] = {
      hovered: flag(tour.slug === hoverTour),
      selected: flag(tour.slug === selTour),
    };

  const visibleTours = rows.tour.filter(({ tour }) =>
    isShown(shown, "tour", tour.slug),
  );

  const passRow = hoverPass
    ? rows.pass.find((r) => r.pass.slug === hoverPass)
    : undefined;
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
  const markedTown = shown.towns ? townRow : undefined;
  const box = hoverTour ? tourBounds[hoverTour] : undefined;

  const popup = (): PopupContent | null => {
    if (env.coarse) return null;
    if (markedPass)
      return {
        anchor: [markedPass.pass.lon, markedPass.pass.lat],
        name: markedPass.pass.name,
        subtitle: roadSubtitle(markedPass),
        tags: markedPass.pass.tags ?? [],
      };
    if (markedTown)
      return {
        anchor: [markedTown.town.lon, markedTown.town.lat],
        // What a town is, is what its labels say; it needs no second line.
        name: markedTown.town.name,
        subtitle: null,
        tags: markedTown.town.tags,
      };
    if (tourRow && box)
      return {
        anchor: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2],
        name: tourRow.tour.name,
        subtitle: `ca. ${fmt(tourRow.tour.km)} km · ${fmt(tourRow.tour.elevationGain)} hm`,
        tags: [],
      };
    if (destinationRow)
      return {
        anchor: [
          destinationRow.destination.center.lon,
          destinationRow.destination.center.lat,
        ],
        name: destinationRow.destination.name,
        subtitle: destinationRow.text,
        tags: [],
      };
    return null;
  };

  const tours = rows.tour.map(({ tour }) => ({
    slug: tour.slug,
    visible: isShown(shown, "tour", tour.slug),
  }));
  const bounds = visibleBounds(
    rows.pass.map((r) => r.pass),
    tours,
    tourBounds,
    shown.passes,
  );
  const home = RANGE_BOUNDS[HOME_RANGE];
  const opening = visibleBounds(
    rows.pass
      .map((r) => r.pass)
      .filter((p) => rangeOf(p.region) === HOME_RANGE),
    // A loop has no region: it is at home where its box's centre is.
    tours.filter(({ slug }) => {
      const b = tourBounds[slug];
      return (
        b && inBox(home, { lat: (b[1] + b[3]) / 2, lon: (b[0] + b[2]) / 2 })
      );
    }),
    tourBounds,
    shown.passes,
  );

  return {
    bounds,
    cursor: collection(
      profileCursor
        ? [{ at: [profileCursor.lon, profileCursor.lat], props: {} }]
        : [],
    ),
    destinations: {
      features: rows.destination.map((row) => ({
        geometry: {
          coordinates: [
            circleRing(row.destination.center, row.destination.radiusKm),
          ],
          type: "Polygon",
        },
        properties: {
          favorite: flag(row.favorite),
          hovered: flag(row.destination.slug === hoverDestination),
          name: row.destination.name,
          selected: flag(row.destination.slug === selDestination),
          share: row.verdict.total
            ? (row.verdict.counts.best + row.verdict.counts.good) /
              row.verdict.total
            : 0,
          slug: row.destination.slug,
          text: row.text,
        },
        type: "Feature",
      })),
      type: "FeatureCollection",
    },
    hover: {
      hull: (markedTown && townReach[markedTown.town.slug]) ?? null,
      mark: collection<HoverProps>(
        markedPass
          ? [
              {
                at: [markedPass.pass.lon, markedPass.pass.lat],
                props: {
                  fame: markedPass.pass.fame,
                  favorite: flag(markedPass.favorite),
                  kind: "pass",
                  selected: flag(markedPass.pass.slug === selPass),
                  status: markedPass.status,
                },
              },
            ]
          : markedTown
            ? [
                {
                  at: [markedTown.town.lon, markedTown.town.lat],
                  props: { kind: "town" },
                },
              ]
            : [],
      ),
      popup: popup(),
    },
    opening: opening ?? bounds,
    passes: collection<PassProps>(
      (shown.passes ? rows.pass : []).map((row) => ({
        at: [row.pass.lon, row.pass.lat],
        props: {
          fame: row.pass.fame,
          favorite: flag(row.favorite),
          name: row.pass.name,
          selected: flag(row.pass.slug === selPass),
          slug: row.pass.slug,
          status: row.status,
        },
      })),
    ),
    routes: {
      filter: slugFilter(shown.passes ? rows.pass.map((r) => r.pass.slug) : []),
      state: routeState,
    },
    tours: {
      filter: slugFilter(visibleTours.map(({ tour }) => tour.slug)),
      state: tourState,
    },
    towns: collection<TownProps>(
      (shown.towns ? rows.town : []).map((row) => ({
        at: [row.town.lon, row.town.lat],
        props: {
          favorite: flag(row.favorite),
          name: row.town.name,
          selected: flag(row.town.slug === selTown),
          slug: row.town.slug,
        },
      })),
    ),
  };
};
