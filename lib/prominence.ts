import type { Messages } from "@/lib/i18n";
import { CLASSIC_FAME, PEARL_BEAUTY } from "@/lib/regions";
import type { Pass, RoadType } from "@/lib/types";

/**
 * The overview draws by fame, the list draws everything.
 *
 * Two hundred dots read at zoom 7; three hundred and fifty do not, and most of
 * what the file grows by is small roads of fame 1 and 2
 * (docs/plans/24-depth-per-destination.md). So the map has a level of detail:
 * at the widest zooms only the classics and the most beautiful of the known
 * passes are drawn, and the rest join one rank per step until everything is
 * there from `PROMINENCE.at(-1).fromZoom` on. It
 * is not a filter – the list is untouched and no chip carries it – it is what a
 * paper map does with its type sizes, and the line under the map says which
 * level is showing.
 *
 * The ladder reads a road's `rankOf`, not its fame alone: a road that does not
 * cross anything – a spur up to a reservoir, a valley, a balcony – counts one
 * step lower than a pass of the same fame, because a dead end is a detour from
 * a base and not what a region is chosen for; a pearl (beauty 5) counts one
 * step higher, because it is. The classics (fame 4 and 5) are never moved:
 * the "Klassiker" chip keeps them, and the overview has to draw what that chip
 * keeps.
 *
 * A rank draws quiet first: at the zoom it joins, its dot is small and pale,
 * and it grows to its full size by the next step (`newcomerBelow`), so the step
 * reads as a map filling in rather than as a page of dots arriving at once.
 *
 * What is selected, hovered or marked as a favourite ignores the rule: a mark
 * the visitor put there or is pointing at is never hidden by the zoom.
 *
 * The names read the same rank on a finer ladder of their own (`PASS_LABELS`
 * in `lib/layer-ids.ts`: rank 4 from 7, rank 3 from 8, rank 2 from 9.5), each
 * step at or after its dot's, so a name never appears before its dot.
 *
 * The steps are whole zooms because MapLibre evaluates `["zoom"]` in a filter
 * at the tile's integer zoom: a step at 7.5 is drawn at 8 anyway, and the
 * legend and the quiet ramp would say 7.5.
 */
export const PROMINENCE = [
  { fromZoom: 0, level: "famous", minRank: 4 },
  { fromZoom: 8, level: "known", minRank: 3 },
  { fromZoom: 9, level: "most", minRank: 2 },
  { fromZoom: 10, level: null, minRank: 0 },
] as const;

/** The road types that end rather than cross: one step lower on the overview. */
export const STEPS_DOWN: readonly RoadType[] = [
  "spur",
  "valley",
  "balcony",
  "plateau",
];

/**
 * Where a road stands on the ladder: its fame, a step lower for a dead end and
 * a step higher for a pearl (`PEARL_BEAUTY`) – a road few people know but
 * everybody who rides it remembers is what a region is chosen for. A classic
 * keeps its fame whatever it is: the "Klassiker" chip keeps it, and the
 * overview draws what the chip keeps.
 */
export const rankOf = (pass: Pick<Pass, "beauty" | "fame" | "type">): number =>
  pass.fame >= CLASSIC_FAME
    ? pass.fame
    : pass.fame -
      (STEPS_DOWN.includes(pass.type) ? 1 : 0) +
      (pass.beauty >= PEARL_BEAUTY ? 1 : 0);

/**
 * Where the destination outlines step back: once most roads are drawn. Past
 * it the roads are the picture, so an area keeps only a trace of its fill and
 * a hairline edge – it stays, because an area that vanished while zooming into
 * it read as a bug.
 */
export const DESTINATION_MAX_ZOOM = PROMINENCE[2].fromZoom;

/** From which zoom on a road of this rank is drawn on the overview. */
export const minzoomOf = (rank: number): number =>
  PROMINENCE.find((p) => rank >= p.minRank)?.fromZoom ??
  PROMINENCE.at(-1)!.fromZoom;

/**
 * The legend line for a zoom: "Klassiker und …" while the overview is thinned,
 * `null` once every road is drawn and there is nothing to say.
 */
export const prominenceWord = (zoom: number, w: Messages): string | null => {
  const level = PROMINENCE.findLast((p) => zoom >= p.fromZoom)?.level;
  return level ? w.vocab.prominence[level] : null;
};

/**
 * A MapLibre filter that applies the rule: a top-level `step` on the zoom –
 * the one place a filter may read `["zoom"]` – with one branch per level.
 * `branch` builds the filter for one level from the rank floor it draws, or
 * from `null` where everything is drawn, so the caller adds what its layer
 * needs on top (a favourite is a star, not a dot; a selected pass is always
 * drawn) without this module knowing MapLibre's property names.
 */
export const prominenceFilter = <T>(branch: (minRank: number | null) => T) =>
  [
    "step",
    ["zoom"],
    ...PROMINENCE.flatMap((p, i) => {
      const b = branch(i === PROMINENCE.length - 1 ? null : p.minRank);
      return i === 0 ? [b] : [p.fromZoom, b];
    }),
  ] as const;

/** The two zooms a dot's size is given at; between and beyond, it is interpolated. */
export const SIZE_ZOOMS = { far: 6, near: 12 } as const;

/**
 * The zooms a dot's size is interpolated over: one stop per step of the
 * ladder, one step past the last – where its newcomers have grown – and the
 * two ends the dots were always sized at.
 */
export const SIZE_STOPS: readonly number[] = [
  SIZE_ZOOMS.far,
  ...PROMINENCE.slice(1).map((p) => p.fromZoom),
  PROMINENCE.at(-1)!.fromZoom + 1,
  SIZE_ZOOMS.near,
];

/**
 * The rank below which a dot is a newcomer at this stop – drawn quiet, because
 * the step it joined at is this one. `null` where nobody is new: the famous
 * are there from the start, and one step past the last everybody has grown.
 */
export const newcomerBelow = (stop: number): number | null => {
  const i = PROMINENCE.findIndex((p) => p.fromZoom === stop);
  return i > 0 ? PROMINENCE[i - 1]!.minRank : null;
};
