/**
 * The map's one hand: every name on the map – the basemap's and the app's –
 * is set from this scale (docs/map-rendering.md#one-hand-two-voices).
 *
 * Two voices share it. The app's names (roads, towns, areas, loops) speak in
 * SemiBold and in their kind's colour; the basemap's (places, regions,
 * countries) in Regular grey, a step below on the same scale. Both wear the
 * same halo, so neither reads as pasted on. An area is spaced, a point is
 * not, and nothing is set in capitals: on a map of passes the capitals were
 * the loudest word on the screen and said "Tirol".
 */

/** Sizes in px, the steps every label layer takes its size from. */
export const TYPE = {
  /** The app's body: most road names, a town at zoom 8, an area from 8. */
  body: 12.5,
  /** The app's lead: a road of rank 5; where a city stops growing. */
  lead: 13,
  /** A town up close (zoom 13): the one name that outgrows the roads. */
  near: 14,
  /** The basemap's towns up close; a city grows to `lead` and stops there. */
  place: 12,
  /** The basemap's quiet names: villages, regions, countries. */
  quiet: 10.5,
  /** The app's small names: a rank 1–2 road, a loop, an area at the overview. */
  small: 11,
} as const;

/**
 * The basemap names regions only on the overview: from here on the app's
 * areas are the regions (`OVERVIEW_ZOOM` in `lib/prominence.ts`, where they
 * are first named; a test holds the two equal).
 */
export const REGION_MAX_ZOOM = 6;

/** Countries a step longer than regions: they frame the areas, not replace them. */
export const COUNTRY_MAX_ZOOM = 7;

/** One halo for every name, in the card colour (`paper`). */
export const HALO_WIDTH = 1.5;

/** The letter-spacing of a name that stands for an area, not a point. */
export const AREA_SPACING = 0.08;

/** The opacity of the basemap's names while a fan is open. */
export const BASE_LABELS_QUIET = 0.35;
