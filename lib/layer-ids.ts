/**
 * The id of every layer the app draws over the basemap, and of the source
 * under it, as one table. Ids only – what those layers are *painted* with is
 * `components/map/app-layers.ts`.
 *
 * Four sides read the same ids: the style builds the layers from it
 * (`appLayers`), the applier addresses them by it (`applyScene`), the pick
 * ranks them by it (`lib/map-pick.ts`) and the e2e asks the running map
 * whether it has them. `HIT_GROUPS` is derived here
 * rather than written out a second time, because the two used to be written
 * out twice: the labels are one id per rank, and a sixth level added to
 * the ladder below would have been drawn and would silently have stopped
 * answering the pointer.
 */

/** The GeoJSON sources; all but the two static files are written by the scene alone. */
export const SOURCE = {
  cursor: "cursor",
  /** One point per area, where its name stands (a polygon labels itself once per tile). */
  destinationLabels: "destination-labels",
  destinations: "destinations",
  /** The roads the filters leave out, as shadows (`Scene.ghosts`). */
  ghosts: "ghosts",
  hover: "hover",
  passes: "passes",
  reach: "reach",
  routes: "routes",
  tours: "tours",
  towns: "towns",
  /** Where the visitor is, once they have asked (`useGeolocation`). */
  you: "you",
} as const;

/**
 * The label ladder: a pass's name appears at the zoom its rank earns
 * (`rankOf`, lib/prominence.ts), and MapLibre resolves what collides. Only
 * the names wait for the zoom – every dot the filters keep is drawn at every
 * zoom; the last step takes every rank below it too.
 */
export const PASS_LABELS = [
  { minzoom: 0, rank: 5 },
  { minzoom: 7, rank: 4 },
  { minzoom: 8, rank: 3 },
  { minzoom: 9.5, rank: 2 },
  { minzoom: 10.5, rank: 1 },
] as const;

/** The one spelling of a pass label's id. */
export const passLabelId = (rank: number) => `pass-label-${rank}`;

/** What one kind is drawn with: its mark, the names beside it, its hit area. */
export interface LayerSet {
  /** The drawn mark – a dot, a disc, a line. */
  mark: string;
  /** The names, most prominent first. */
  labels: readonly string[];
  /** The transparent layer over the mark, as wide as the pointer needs. */
  hit: string;
  /**
   * Layers drawn with the mark and filtered with it, but neither a name nor
   * a target: the dash over an unpaved ascent, the edge of an area's
   * outline, the inside of a tour's tube. They are never aimed at.
   */
  companions?: readonly string[];
  /** The source the mark, its companions and its hit area read; a name may stand on a source of its own. */
  source: string;
}

/**
 * The dash laid over an unpaved ascent (plan 27). A companion of the route
 * set below – it carries the same filter – rather than a layer of its own: a
 * gravel line hidden by the list must not keep its dashes.
 */
export const ROUTE_DASH = "routes-dash";
/**
 * The paper edge under every ascent: the line a road is drawn with has a rim,
 * like the tube a tour is drawn as, so an ascent reads the same inside a tour
 * and on its own (`docs/map-rendering.md`).
 */
export const ROUTE_CASING = "routes-casing";

/**
 * The ascent lines, one layer per status, drawn closed first and rideable
 * last, so a green road lies over a red one where two cross (the scene's
 * `routes.byStatus`). The rideable one is the route set's own mark. Not
 * companions: each carries a filter of its own, not the route set's.
 */
export const ROUTE_LINES = {
  closed: "routes-closed",
  open: "routes",
  risky: "routes-risky",
} as const;

/**
 * The ascents of the roads the filters leave out: a thin grey line under
 * everything, the shadow's lines as the grey dot is its mark. Not a companion
 * of the route set – it carries the shadows' filter, not the drawn roads' –
 * and no target: the dot answers for its road.
 */
export const ROUTE_GHOST = "routes-ghost";

/**
 * A tour is a tube: its mark is the tube's wall in the tour's colour, and
 * these are the rest of it – the pale inside, the road along its middle and
 * the arrows that say which way round it is ridden.
 */
export const TOUR_PARTS = {
  arrows: "tours-arrows",
  inside: "tours-inside",
  road: "tours-road",
} as const;

/**
 * The six kinds the map draws. `route` is a pass's ascents: its own lines and
 * its own hit layer, but never its own selection – an ascent belongs to its
 * pass, which is what `pick` answers with. `destination` is the outline of
 * an area under everything else, thinner past the overview
 * (`DESTINATION_MAX_ZOOM`); its name stands on a point source of its own.
 */
export const LAYERS = {
  destination: {
    /** The outline's edge; the fill is the mark. */
    companions: ["destinations-edge"],
    hit: "destinations-hit",
    labels: ["destinations-label"],
    mark: "destinations",
    source: SOURCE.destinations,
  },
  /**
   * A road the filters leave out: a shadow of its dot – no name, and its
   * ascents only as the hairline `ROUTE_GHOST`. It answers the pointer as its pass, below every road the
   * filters kept, so a shadow never takes a click meant for a real mark.
   */
  ghost: {
    hit: "ghosts-hit",
    labels: [],
    mark: "ghosts",
    source: SOURCE.ghosts,
  },
  pass: {
    hit: "passes-hit",
    labels: PASS_LABELS.map((l) => passLabelId(l.rank)),
    mark: "passes",
    source: SOURCE.passes,
  },
  route: {
    companions: [ROUTE_CASING, ROUTE_DASH],
    hit: "routes-hit",
    labels: [],
    mark: ROUTE_LINES.open,
    source: SOURCE.routes,
  },
  tour: {
    companions: [TOUR_PARTS.inside, TOUR_PARTS.road, TOUR_PARTS.arrows],
    hit: "tours-hit",
    labels: ["tours-label"],
    mark: "tours",
    source: SOURCE.tours,
  },
  town: {
    hit: "towns-hit",
    labels: ["towns-label"],
    mark: "towns",
    source: SOURCE.towns,
  },
} as const satisfies Record<string, LayerSet>;

/**
 * The layers that answer the hover rather than a kind of entity: the ring
 * around the mark under the pointer, the hull of what a town reaches – and the
 * profile cursor, which belongs to the panel's chart rather than to the map,
 * and the visitor's own position, which belongs to no list at all.
 * None of them is a target: they are drawn on top of what was aimed at.
 */
export const OVERLAY = {
  cursor: "profile-cursor",
  hull: "town-reach-fill",
  hullEdge: "town-reach-line",
  ring: "hover-ring",
  /** The visitor's own position: a dot, and the halo of how sure the fix is. */
  you: "you",
  youHalo: "you-halo",
} as const;

/** What one kind is drawn with, in one list – all of it carries its filter. */
export const layersOf = (set: LayerSet): string[] => [
  set.mark,
  ...set.labels,
  ...(set.companions ?? []),
  set.hit,
];

/**
 * The layers that answer hover and click, in falling priority. The order is
 * spelled out rather than taken from the style, because the two disagree:
 * marks first, then the names beside them, then the lines – a name is a small
 * deliberate target, a line covers half the map, and both would otherwise
 * swallow the dot they belong to; and the tour's tube lies *under* the ascents
 * but reaches past them, so a click inside it hits both and the ascent is the
 * more specific answer. Within a group the nearer mark wins – passes and
 * towns share the first one – so a generous hit area never steals the click
 * from the mark actually aimed at.
 */
export const HIT_GROUPS: readonly (readonly string[])[] = [
  [LAYERS.pass.hit, LAYERS.town.hit],
  [...LAYERS.pass.labels, ...LAYERS.town.labels],
  [...LAYERS.tour.labels],
  [LAYERS.route.hit],
  [LAYERS.tour.hit],
  // An area is the least specific answer there is: its name is a target,
  // the outline only answers where nothing else does. The shadows sit
  // between the two – drawn at every zoom, a couple of hundred grey dots
  // would otherwise take the overview's clicks meant for an area's name.
  [...LAYERS.destination.labels],
  [LAYERS.ghost.hit],
  [LAYERS.destination.hit],
];

export const HIT_LAYERS: readonly string[] = HIT_GROUPS.flat();
