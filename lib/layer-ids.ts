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
 * out twice: the labels are one id per fame level, and a sixth level added to
 * the ladder below would have been drawn and would silently have stopped
 * answering the pointer.
 */

/** The GeoJSON sources; the three at the end are written by the scene alone. */
export const SOURCE = {
  cursor: "cursor",
  hover: "hover",
  passes: "passes",
  reach: "reach",
  routes: "routes",
  tours: "tours",
  towns: "towns",
} as const;

/**
 * The label ladder: a pass's name appears at the zoom its fame earns, and
 * MapLibre resolves what collides. A dot always appears before its name
 * (`lib/prominence.ts` holds the dots' own, coarser ladder).
 */
export const PASS_LABELS = [
  { fame: 5, minzoom: 0 },
  { fame: 4, minzoom: 7 },
  { fame: 3, minzoom: 8 },
  { fame: 2, minzoom: 9.5 },
  { fame: 1, minzoom: 10.5 },
] as const;

/** The one spelling of a pass label's id. */
export const passLabelId = (fame: number) => `pass-label-${fame}`;

/** What one kind is drawn with: its mark, the names beside it, its hit area. */
export interface LayerSet {
  /** The drawn mark – a dot, a disc, a line. */
  mark: string;
  /** The names, most prominent first. */
  labels: readonly string[];
  /** The transparent layer over the mark, as wide as the pointer needs. */
  hit: string;
  /** The source all three read. */
  source: string;
}

/**
 * The four kinds the map draws. `route` is a pass's ascents: its own lines and
 * its own hit layer, but never its own selection – an ascent belongs to its
 * pass, which is what `pick` answers with.
 */
export const LAYERS = {
  pass: {
    hit: "passes-hit",
    labels: PASS_LABELS.map((l) => passLabelId(l.fame)),
    mark: "passes",
    source: SOURCE.passes,
  },
  route: {
    hit: "routes-hit",
    labels: [],
    mark: "routes",
    source: SOURCE.routes,
  },
  tour: {
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
 * around the mark under the pointer, the mark drawn again beneath it where the
 * level of detail would hide it, the hull of what a town reaches – and the
 * profile cursor, which belongs to the panel's chart rather than to the map.
 * None of them is a target: they are drawn on top of what was aimed at.
 */
export const OVERLAY = {
  cursor: "profile-cursor",
  hull: "town-reach-fill",
  hullEdge: "town-reach-line",
  mark: "hover-mark",
  ring: "hover-ring",
} as const;

/** What one kind is drawn with, in one list – all of it carries its filter. */
export const layersOf = (set: LayerSet): string[] => [
  set.mark,
  ...set.labels,
  set.hit,
];

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
export const HIT_GROUPS: readonly (readonly string[])[] = [
  [LAYERS.pass.hit, LAYERS.town.hit],
  [...LAYERS.pass.labels, ...LAYERS.town.labels],
  [...LAYERS.tour.labels],
  [LAYERS.route.hit],
  [LAYERS.tour.hit],
];

export const HIT_LAYERS: readonly string[] = HIT_GROUPS.flat();
