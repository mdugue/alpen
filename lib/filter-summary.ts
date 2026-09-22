import {
  ALL_RANGES,
  ALL_STATUS,
  ALL_SURFACES,
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
import type { Filters, OptionLabel, Options } from "@/lib/app-state";
import { DEFAULT_LANG, vocabOf } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import { fmt } from "@/lib/utils";

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

/** The label of one threshold chip in the page's language: "ab 3", "unter 26 °C". */
export const optionText = (
  o: OptionLabel,
  lang: Lang = DEFAULT_LANG,
): string => {
  const w = vocabOf(lang).option;
  if (o.kind === "any") return w.any;
  if (o.kind === "elevationFrom") return w.elevationFrom(fmt(o.m, 0, lang));
  return w[o.kind](o.n);
};

/** The label of the option a value picks; the empty string for a value no chip carries. */
const optionLabel = (options: Options, value: number, lang: Lang): string => {
  const label = options.find(([v]) => v === value)?.[1];
  return label ? optionText(label, lang) : "";
};

/** "Schwierigkeit 3" for one level, "Schwierigkeit 2–4" for a window. */
export const difficultyLabel = (
  [lo, hi]: readonly [number, number],
  lang: Lang = DEFAULT_LANG,
) => vocabOf(lang).filter.difficulty(lo, hi);

export const appliedFilters = (
  f: Filters,
  lang: Lang = DEFAULT_LANG,
): AppliedFilter[] => {
  const v = vocabOf(lang);
  const out: AppliedFilter[] = [];
  const add = (
    key: string,
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
      status.map((s) => statusLabel(s, lang)).join(v.filter.statusOr),
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
  // One chip per label: they stack with and-semantics, so each one is its own decision.
  for (const tag of f.tags)
    add(`tag:${tag}`, v.roadTag[tag].label, (g) => ({
      ...g,
      tags: g.tags.filter((t) => t !== tag),
    }));
  const [lo, hi] = f.difficulty;
  if (lo > RATING_MIN || hi < RATING_MAX)
    add("difficulty", difficultyLabel(f.difficulty, lang), (g) => ({
      ...g,
      difficulty: [RATING_MIN, RATING_MAX],
    }));
  if (f.minElevation > 0)
    add(
      "elevation",
      optionLabel(ELEVATION_OPTIONS, f.minElevation, lang),
      (g) => ({
        ...g,
        minElevation: 0,
      }),
    );
  if (f.maxTraffic < RATING_MAX)
    add(
      "traffic",
      v.filter.traffic(optionLabel(TRAFFIC_OPTIONS, f.maxTraffic, lang)),
      (g) => ({ ...g, maxTraffic: RATING_MAX }),
    );
  if (f.minBeauty > RATING_MIN)
    add(
      "beauty",
      v.filter.beauty(optionLabel(BEAUTY_OPTIONS, f.minBeauty, lang)),
      (g) => ({ ...g, minBeauty: RATING_MIN }),
    );
  if (f.minFame > 1)
    add(
      "fame",
      v.filter.fame(optionLabel(FAME_OPTIONS, f.minFame, lang)),
      (g) => ({
        ...g,
        minFame: 1,
      }),
    );
  const heat = optionLabel(HEAT_OPTIONS, f.maxValleyTmax, lang);
  if (heat && f.maxValleyTmax !== HEAT_OPTIONS[0][0])
    add("heat", v.filter.valley(heat), (g) => ({
      ...g,
      maxValleyTmax: HEAT_OPTIONS[0][0],
    }));
  const wet = optionLabel(WET_OPTIONS, f.maxWetDays, lang);
  if (wet && f.maxWetDays !== WET_OPTIONS[0][0])
    add("wet", v.filter.wetDays(wet), (g) => ({
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
export const rangeWord = (
  f: Filters,
  lang: Lang = DEFAULT_LANG,
): string | null => {
  const picked = pickedMembers(f.ranges, ALL_RANGES);
  return picked.length
    ? picked.map((r) => vocabOf(lang).range[r].label).join(", ")
    : null;
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
  lang: Lang = DEFAULT_LANG,
): { chip: AppliedFilter; n: number } | undefined =>
  appliedFilters(f, lang)
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
