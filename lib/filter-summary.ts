import {
  ALL_RANGES,
  ALL_STATUS,
  ALL_TYPES,
  DEFAULT_FILTERS,
  BEAUTY_OPTIONS,
  ELEVATION_OPTIONS,
  FAME_OPTIONS,
  HEAT_OPTIONS,
  pickedMembers,
  RATING_MAX,
  RATING_MIN,
  TRAFFIC_OPTIONS,
  WET_OPTIONS,
} from "@/lib/app-state";
import type { Filters, Options } from "@/lib/app-state";
import { RANGE, ROAD_TAG, ROAD_TYPE } from "@/lib/regions";
import { STATUS_LABEL } from "@/lib/status";

/**
 * One applied filter as the chip row under the search field shows it: a
 * short label and the update that lifts exactly this filter and nothing
 * else. What is on the map has to be readable without opening the filter
 * view, and one tap has to undo one decision – that is what the row is for.
 * The period, the sort and the search text are not in it: the period has the
 * scrubber, the sort is a preference, and the search field shows itself.
 */
export interface AppliedFilter {
  /** Stable, one per criterion – the React key. */
  key: string;
  label: string;
  clear: (f: Filters) => Filters;
}

const optionLabel = (options: Options, value: number) =>
  options.find(([v]) => v === value)?.[1];

/** "Schwierigkeit 3" for one level, "Schwierigkeit 2–4" for a window. */
export const difficultyLabel = ([lo, hi]: readonly [number, number]) =>
  lo === hi ? `Schwierigkeit ${lo}` : `Schwierigkeit ${lo}–${hi}`;

export const appliedFilters = (f: Filters): AppliedFilter[] => {
  const out: AppliedFilter[] = [];
  const add = (
    key: string,
    label: string | undefined,
    clear: (f: Filters) => Filters,
  ) => {
    if (label) out.push({ clear, key, label });
  };

  if (f.favoritesOnly)
    add("favorites", "nur Gemerkte", (g) => ({ ...g, favoritesOnly: false }));
  const ranges = pickedMembers(f.ranges, ALL_RANGES);
  if (ranges.length)
    add("ranges", ranges.map((r) => RANGE[r].label).join(", "), (g) => ({
      ...g,
      ranges: ALL_RANGES,
    }));
  const status = pickedMembers(f.status, ALL_STATUS);
  if (status.length)
    add("status", status.map((s) => STATUS_LABEL[s]).join(" oder "), (g) => ({
      ...g,
      status: ALL_STATUS,
    }));
  const types = pickedMembers(f.types, ALL_TYPES);
  if (types.length)
    add("types", types.map((t) => ROAD_TYPE[t].label).join(", "), (g) => ({
      ...g,
      types: ALL_TYPES,
    }));
  // One chip per label: they stack with and-semantics, so each one is its own decision.
  for (const tag of f.tags)
    add(`tag:${tag}`, ROAD_TAG[tag].label, (g) => ({
      ...g,
      tags: g.tags.filter((t) => t !== tag),
    }));
  const [lo, hi] = f.difficulty;
  if (lo > RATING_MIN || hi < RATING_MAX)
    add("difficulty", difficultyLabel(f.difficulty), (g) => ({
      ...g,
      difficulty: [RATING_MIN, RATING_MAX],
    }));
  if (f.minElevation > 0)
    add("elevation", optionLabel(ELEVATION_OPTIONS, f.minElevation), (g) => ({
      ...g,
      minElevation: 0,
    }));
  if (f.maxTraffic < RATING_MAX)
    add(
      "traffic",
      `Verkehr ${optionLabel(TRAFFIC_OPTIONS, f.maxTraffic)}`,
      (g) => ({ ...g, maxTraffic: RATING_MAX }),
    );
  if (f.minBeauty > RATING_MIN)
    add(
      "beauty",
      `Schönheit ${optionLabel(BEAUTY_OPTIONS, f.minBeauty)}`,
      (g) => ({ ...g, minBeauty: RATING_MIN }),
    );
  if (f.minFame > 1)
    add("fame", `Bekanntheit ${optionLabel(FAME_OPTIONS, f.minFame)}`, (g) => ({
      ...g,
      minFame: 1,
    }));
  const heat = optionLabel(HEAT_OPTIONS, f.maxValleyTmax);
  if (heat && heat !== "egal")
    add("heat", `Tal ${heat}`, (g) => ({
      ...g,
      maxValleyTmax: HEAT_OPTIONS[0][0],
    }));
  const wet = optionLabel(WET_OPTIONS, f.maxWetDays);
  if (wet && wet !== "egal")
    add("wet", `Regentage ${wet}`, (g) => ({
      ...g,
      maxWetDays: WET_OPTIONS[0][0],
    }));
  return out;
};

/**
 * The ranges a chip narrowed the list to, as one phrase for the headline –
 * "Jura" or "Jura, Vogesen" – and `null` while every range is in: the
 * headline says where it counts only once that is not everywhere.
 */
export const rangeWord = (f: Filters): string | null => {
  const picked = pickedMembers(f.ranges, ALL_RANGES);
  return picked.length ? picked.map((r) => RANGE[r].label).join(", ") : null;
};

/** How many decisions the panel currently carries – the badge on its trigger. */
export const filterCount = (f: Filters) => appliedFilters(f).length;

/**
 * Back to no filter at all. The period and the sort survive it: the
 * half-month is the app's one domain control and lives in the season bar, and
 * the sort is a preference rather than a decision about what is shown.
 */
export const resetFilters = (f: Filters): Filters => ({
  ...DEFAULT_FILTERS,
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
): { chip: AppliedFilter; n: number } | undefined =>
  appliedFilters(f)
    .map((chip) => ({ chip, n: countWith(chip.clear(f)) }))
    .filter((r) => r.n > 0)
    .toSorted((a, b) => b.n - a.n)[0];

/**
 * Whether anything in the second half of the panel is set. It decides whether
 * "Weitere Filter" opens by itself: a link that carries a traffic limit must
 * not hide the control that lifts it again.
 */
export const hasSecondaryFilters = (f: Filters) =>
  f.types.length !== ALL_TYPES.length ||
  f.tags.length > 0 ||
  f.maxTraffic < RATING_MAX ||
  f.minBeauty > RATING_MIN ||
  f.minFame > 1 ||
  f.maxValleyTmax < HEAT_OPTIONS[0][0] ||
  f.maxWetDays < WET_OPTIONS[0][0];
