import {
  ALL_RANGES,
  ALL_STATUS,
  ALL_SURFACES,
  ALL_TOUR_TYPES,
  ALL_TYPES,
  DEFAULT_FILTERS,
  BEAUTY_OPTIONS,
  ELEVATION_OPTIONS,
  FAME_OPTIONS,
  HEAT_OPTIONS,
  NO_FILTERS,
  pickedMembers,
  RATING_MAX,
  RATING_MIN,
  TRAFFIC_OPTIONS,
  WET_OPTIONS,
} from "@/lib/app-state";
import type { Filters, OptionLabel, Options } from "@/lib/app-state";
import type { Messages } from "@/lib/i18n";
import { fill } from "@/lib/i18n/fill";
import { periodLabel } from "@/lib/period";
import { CLASSIC_FAME } from "@/lib/regions";
import { fmt, listOr } from "@/lib/utils";

/**
 * Every criterion the filter bar knows, in the order its tokens stand and
 * its "+" menu lists them, each under the question it answers: where, which
 * road, how the half-month treats it, which tour. One table, so the bar, the
 * menu and the tokens can never list a criterion twice or forget one. The
 * period, the sort and the search text are not criteria: the period has the
 * scrubber, the sort is a preference, and the search field shows itself.
 */
export const CRITERIA = [
  { group: "where", id: "ranges" },
  { group: "where", id: "favorites" },
  { group: "road", id: "fame" },
  { group: "road", id: "difficulty" },
  { group: "road", id: "elevation" },
  { group: "road", id: "types" },
  { group: "road", id: "surfaces" },
  { group: "road", id: "tags" },
  { group: "road", id: "traffic" },
  { group: "road", id: "beauty" },
  { group: "season", id: "status" },
  { group: "season", id: "heat" },
  { group: "season", id: "wet" },
  { group: "tour", id: "tourTypes" },
  { group: "tour", id: "onDate" },
  { group: "tour", id: "pastEditions" },
] as const;
export type CriterionId = (typeof CRITERIA)[number]["id"];
export type CriterionGroup = (typeof CRITERIA)[number]["group"];
export const CRITERION_GROUPS: readonly CriterionGroup[] = [
  "where",
  "road",
  "season",
  "tour",
];

/**
 * The criteria that are a switch rather than a choice, and what switching
 * them on sets: the "+" menu applies them on the spot, because a popover
 * holding one chip is a question asked twice.
 */
export const SWITCHES: Partial<Record<CriterionId, Partial<Filters>>> = {
  favorites: { favoritesOnly: true },
  onDate: { onDate: true },
  pastEditions: { pastEditions: true },
};

/**
 * One applied filter as the bar over the map shows it: a short label and the
 * update that lifts exactly this criterion and nothing else. What is on the
 * map has to be readable without opening anything, and one tap has to undo
 * one decision – that is what the token is for.
 */
export interface AppliedFilter {
  /** Stable, one per criterion – the React key, and which editor it opens. */
  key: CriterionId;
  label: string;
  clear: (f: Filters) => Filters;
}

/** The label of one threshold chip in the page's language: "ab 3", "unter 26 °C". */
export const optionText = (o: OptionLabel, w: Messages): string => {
  const say = w.vocab.option;
  if (o.kind === "any") return say.any;
  if (o.kind === "elevationFrom")
    return fill(say.elevationFrom, { m: fmt(o.m, 0, w.lang) });
  return fill(say[o.kind], { n: fmt(o.n, 0, w.lang) });
};

/** The label of the option a value picks; the empty string for a value no chip carries. */
const optionLabel = (options: Options, value: number, w: Messages): string => {
  const label = options.find(([v]) => v === value)?.[1];
  return label ? optionText(label, w) : "";
};

/** "Schwierigkeit 3" for one level, "Schwierigkeit 2–4" for a window. */
export const difficultyLabel = (
  [lo, hi]: readonly [number, number],
  w: Messages,
) =>
  lo === hi
    ? fill(w.vocab.filter.difficultyOne, { level: lo })
    : fill(w.vocab.filter.difficulty, { hi, lo });

export const appliedFilters = (f: Filters, w: Messages): AppliedFilter[] => {
  const v = w.vocab;
  const out: AppliedFilter[] = [];
  const add = (
    key: CriterionId,
    label: string | undefined,
    clear: (f: Filters) => Filters,
  ) => {
    if (label) out.push({ clear, key, label });
  };

  if (f.favoritesOnly)
    add("favorites", v.filter.favoritesOnly, (g) => ({
      ...g,
      favoritesOnly: false,
    }));
  const ranges = pickedMembers(f.ranges, ALL_RANGES);
  if (ranges.length)
    add("ranges", ranges.map((r) => v.range[r].label).join(", "), (g) => ({
      ...g,
      ranges: ALL_RANGES,
    }));
  const status = pickedMembers(f.status, ALL_STATUS);
  if (status.length)
    add(
      "status",
      listOr(
        status.map((s) => w.status.label[s]),
        w.lang,
      ),
      (g) => ({
        ...g,
        status: ALL_STATUS,
      }),
    );
  const types = pickedMembers(f.types, ALL_TYPES);
  if (types.length)
    add("types", types.map((t) => v.roadType[t].label).join(", "), (g) => ({
      ...g,
      types: ALL_TYPES,
    }));
  const surfaces = pickedMembers(f.surfaces, ALL_SURFACES);
  if (surfaces.length)
    add(
      "surfaces",
      surfaces.map((x) => v.surface[x].label).join(", "),
      (g) => ({
        ...g,
        surfaces: ALL_SURFACES,
      }),
    );
  const tourTypes = pickedMembers(f.tourTypes, ALL_TOUR_TYPES);
  if (tourTypes.length)
    add(
      "tourTypes",
      tourTypes.map((x) => v.tourType[x].label).join(", "),
      (g) => ({ ...g, tourTypes: ALL_TOUR_TYPES }),
    );
  if (f.onDate)
    add(
      "onDate",
      fill(w.sidebar.filters.onDate, { period: periodLabel(f.period, w) }),
      (g) => ({ ...g, onDate: false }),
    );
  if (f.pastEditions)
    add("pastEditions", w.sidebar.filters.pastEditions, (g) => ({
      ...g,
      pastEditions: false,
    }));
  // The labels stack with and-semantics, so they read joined by "+".
  if (f.tags.length)
    add("tags", f.tags.map((tag) => v.roadTag[tag].label).join(" + "), (g) => ({
      ...g,
      tags: [],
    }));
  const [lo, hi] = f.difficulty;
  if (lo > RATING_MIN || hi < RATING_MAX)
    add("difficulty", difficultyLabel(f.difficulty, w), (g) => ({
      ...g,
      difficulty: [RATING_MIN, RATING_MAX],
    }));
  if (f.minElevation > 0)
    add(
      "elevation",
      optionLabel(ELEVATION_OPTIONS, f.minElevation, w),
      (g) => ({
        ...g,
        minElevation: 0,
      }),
    );
  if (f.maxTraffic < RATING_MAX)
    add(
      "traffic",
      fill(v.filter.traffic, {
        option: optionLabel(TRAFFIC_OPTIONS, f.maxTraffic, w),
      }),
      (g) => ({ ...g, maxTraffic: RATING_MAX }),
    );
  if (f.minBeauty > RATING_MIN)
    add(
      "beauty",
      fill(v.filter.beauty, {
        option: optionLabel(BEAUTY_OPTIONS, f.minBeauty, w),
      }),
      (g) => ({ ...g, minBeauty: RATING_MIN }),
    );
  if (f.minFame > RATING_MIN)
    add(
      "fame",
      // The floor the app opens on has a name of its own, the one its chip
      // on the map carries.
      f.minFame === CLASSIC_FAME
        ? v.filter.classics
        : fill(v.filter.fame, {
            option: optionLabel(FAME_OPTIONS, f.minFame, w),
          }),
      (g) => ({
        ...g,
        minFame: RATING_MIN,
      }),
    );
  const heat = optionLabel(HEAT_OPTIONS, f.maxValleyTmax, w);
  if (heat && f.maxValleyTmax !== HEAT_OPTIONS[0][0])
    add("heat", fill(v.filter.valley, { option: heat }), (g) => ({
      ...g,
      maxValleyTmax: HEAT_OPTIONS[0][0],
    }));
  const wet = optionLabel(WET_OPTIONS, f.maxWetDays, w);
  if (wet && f.maxWetDays !== WET_OPTIONS[0][0])
    add("wet", fill(v.filter.wetDays, { option: wet }), (g) => ({
      ...g,
      maxWetDays: WET_OPTIONS[0][0],
    }));
  const order: readonly CriterionId[] = CRITERIA.map((c) => c.id);
  return out.toSorted((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
};

/**
 * The ranges a chip narrowed the list to, as one phrase for the headline –
 * "Jura" or "Jura, Vogesen" – and `null` while every range is in: the
 * headline says where it counts only once that is not everywhere.
 */
export const rangeWord = (f: Filters, w: Messages): string | null => {
  const picked = pickedMembers(f.ranges, ALL_RANGES);
  return picked.length
    ? picked.map((r) => w.vocab.range[r].label).join(", ")
    : null;
};

/** How many decisions the panel currently carries – the badge on its trigger. */
export const filterCount = (f: Filters, w: Messages) =>
  appliedFilters(f, w).length;

/**
 * Whether the filters are what the app opens on – the classics and nothing
 * else. The bar offers the way back ("Standard") only when they are not.
 */
export const isStandard = (f: Filters, w: Messages) =>
  f.minFame === DEFAULT_FILTERS.minFame && filterCount(f, w) === 1;

/**
 * Back to what the app opens on. The period, the sort and the search survive
 * it: the half-month lives in the season bar, the sort is a preference, and
 * the search field has its own way out.
 */
export const standardFilters = (f: Filters): Filters => ({
  ...DEFAULT_FILTERS,
  period: f.period,
  query: f.query,
  sort: f.sort,
});

/**
 * Back to no filter at all. The period and the sort survive it: the
 * half-month is the app's one domain control and lives in the season bar, and
 * the sort is a preference rather than a decision about what is shown. No
 * filter means every road, so the classics the app opens on go too.
 */
export const resetFilters = (f: Filters): Filters => ({
  ...NO_FILTERS,
  period: f.period,
  sort: f.sort,
});

/**
 * Which single applied filter, lifted on its own, brings the most back –
 * "ohne „ab 2.500 m" wären es 188". Only asked once a list is empty, so it
 * costs nothing while the panel is doing its job. An applied chip's `clear`
 * hands back a whole `Filters`, which is a valid patch for `countWith`, so no
 * second seam is needed; a filter that brings nothing back is no relief and
 * is left out.
 */
export const bestRelief = (
  f: Filters,
  countWith: (patch: Partial<Filters>) => number,
  w: Messages,
): { chip: AppliedFilter; n: number } | undefined =>
  appliedFilters(f, w)
    .map((chip) => ({ chip, n: countWith(chip.clear(f)) }))
    .filter((r) => r.n > 0)
    .toSorted((a, b) => b.n - a.n)[0];
