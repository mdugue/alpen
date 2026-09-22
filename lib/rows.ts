import { HEAT_NONE, WET_NONE } from "@/lib/app-state";
import type { EntityKind, Filters, PassSort } from "@/lib/app-state";
import { periodIndex, PERIODS } from "@/lib/period";
import {
  matches,
  passHaystack,
  tourHaystack,
  townHaystack,
} from "@/lib/search";
import {
  daysOf,
  GRADE_ORDER,
  inputAt,
  signalsOf,
  statusRank,
  tourWindowWord,
  valleyTmax,
} from "@/lib/status";
import type {
  Grade,
  PassIndex,
  Signals,
  StatusReason,
  VerdictInput,
  YearCell,
  Years,
} from "@/lib/status";
import type { Pass, Period, Status, Tour, Town } from "@/lib/types";

/**
 * One filtered list per entity kind. Search and the favourites toggle apply
 * to all three, the status filter and the pass criteria to passes and, via
 * their passes, to tours; towns know no criteria. Map visibility (hidden
 * tours, towns on/off) is a layer toggle, not a filter; what the map draws
 * per kind is what the list of that kind shows.
 */

interface Query {
  matches: (haystack: string) => boolean;
  favoritesOnly: boolean;
  isFavorite: (kind: EntityKind, slug: string) => boolean;
}

const query = (filters: Filters, isFavorite: Query["isFavorite"]): Query => {
  const q = filters.query.trim();
  return {
    favoritesOnly: filters.favoritesOnly,
    isFavorite,
    matches: (haystack) => !q || matches(haystack, q),
  };
};

/**
 * Lower bounds, "at least this interesting": a tour needs one pass that clears
 * them. The road type belongs here rather than among the upper bounds: a loop
 * over one spur and three passes is still a loop worth showing when spurs are
 * asked for.
 */
const interesting = (pass: Pass, f: Filters) =>
  pass.elevation >= f.minElevation &&
  pass.fame >= f.minFame &&
  pass.beauty >= f.minBeauty &&
  pass.difficulty >= f.difficulty[0] &&
  f.types.includes(pass.type);

/**
 * Upper bounds, "not harder, busier, hotter or wetter than": every pass of a
 * tour has to respect them. The summer signals read the chosen half-month; a
 * pass without the value does not pass an active one – "unknown" is not
 * "under 28 °C".
 */
const withinLimits = (pass: Pass, f: Filters, input: VerdictInput) => {
  if (pass.difficulty > f.difficulty[1] || pass.traffic > f.maxTraffic)
    return false;
  const b = input.bucket;
  if (f.maxValleyTmax < HEAT_NONE) {
    const valley = b ? valleyTmax(pass, b, input.valley) : null;
    if (valley === null || valley >= f.maxValleyTmax) return false;
  }
  // Rounded to days first, because days are what the filter asks in and what
  // the panel and the reason text both show; comparing the raw share would let
  // a pass shown as "6 von 15" fail a "bis 6 von 15" filter.
  if (f.maxWetDays < WET_NONE && (!b || daysOf(b.wetPct) > f.maxWetDays))
    return false;
  return true;
};

/** Everything about a pass except its status: criteria, favourites, search. */
const passMatches = (
  pass: Pass,
  filters: Filters,
  q: Query,
  input: VerdictInput,
): boolean => {
  if (!interesting(pass, filters) || !withinLimits(pass, filters, input))
    return false;
  // And-semantics: every selected label has to be present. Or-semantics would
  // make "autofrei + Gletscher" mean "either", which is never what a planner
  // asks two filters for. Roads only – a label describes one road, so it never
  // reaches a tour.
  if (!filters.tags.every((t) => pass.tags?.includes(t))) return false;
  if (q.favoritesOnly && !q.isFavorite("pass", pass.slug)) return false;
  return q.matches(passHaystack(pass));
};

/** The pass criteria reach a tour through the passes it crosses. */
const tourMatches = (
  tour: Tour,
  passes: PassIndex,
  filters: Filters,
  q: Query,
  signals?: Signals,
): boolean => {
  const own = tour.passes
    .map((s) => passes.get(s))
    .filter((p) => p !== undefined);
  if (own.length && !own.some((p) => interesting(p, filters))) return false;
  if (
    !own.every((p) =>
      withinLimits(
        p,
        filters,
        inputAt(signalsOf(signals, p.slug), filters.period),
      ),
    )
  )
    return false;
  return q.matches(
    tourHaystack(
      tour,
      own.map((p) => p.name),
    ),
  );
};

/**
 * How many passes a filter set keeps. `buildPassRows` would answer the same
 * question, but it builds a row per survivor – the favourite flag, the season
 * strip, the word next to the dot – and a count uses none of it; the filter
 * panel asks this once per option on every keystroke. Counting is therefore
 * its own path over the same two predicates.
 */
const countPasses = (
  passes: Pass[],
  years: Years,
  filters: Filters,
  isFavorite: Query["isFavorite"],
  signals?: Signals,
): number => {
  const q = query(filters, isFavorite);
  const i = periodIndex(filters.period);
  let n = 0;
  for (const pass of passes) {
    const input = inputAt(signalsOf(signals, pass.slug), filters.period);
    if (!passMatches(pass, filters, q, input)) continue;
    const cell = years.passes[pass.slug]?.cells[i];
    if (!cell || !filters.status.includes(cell.status)) continue;
    n += 1;
  }
  return n;
};

/**
 * The word next to the dot. Only a limited cell carries one: "oft gesperrt"
 * already says why it is closed, and an open cell has nothing to add.
 */
const reasonOf = (cell: YearCell): StatusReason | null =>
  cell.status === "risky" ? (cell.reasons[0] ?? null) : null;

export interface PassRow {
  pass: Pass;
  status: Status;
  /** The first reason of a limited status – the word next to the dot. */
  reason: StatusReason | null;
  favorite: boolean;
  /** The 24 cells for the season strip; the pass's own `Year`, not a copy. */
  season: YearCell[];
}

export const PASS_SORT_LABEL: Record<PassSort, string> = {
  beauty: "Schönheit",
  difficulty: "Schwierigkeit",
  elevation: "Höhe",
  fame: "Bekanntheit",
  name: "Name",
  status: "Status",
  traffic: "Verkehr",
};

const byName = (a: PassRow, b: PassRow) =>
  a.pass.name.localeCompare(b.pass.name, "de");

/** Direction is fixed per key: the "best" value first. */
export const sortPassRows = (rows: PassRow[], sort: PassSort): PassRow[] => {
  const cmp: Record<PassSort, (a: PassRow, b: PassRow) => number> = {
    beauty: (a, b) => b.pass.beauty - a.pass.beauty,
    difficulty: (a, b) => b.pass.difficulty - a.pass.difficulty,
    elevation: (a, b) => b.pass.elevation - a.pass.elevation,
    fame: (a, b) => b.pass.fame - a.pass.fame,
    name: byName,
    status: (a, b) =>
      statusRank(a.status) - statusRank(b.status) ||
      b.pass.elevation - a.pass.elevation,
    traffic: (a, b) => a.pass.traffic - b.pass.traffic,
  };
  return rows.toSorted((a, b) => cmp[sort](a, b) || byName(a, b));
};

/**
 * The status, the word next to it and the strip all come out of one `Year`
 * (`getYears`, lib/data.ts), which is what keeps the row and the detail panel
 * from ever disagreeing about the same pass. The criteria filters still read
 * the raw signals: they ask about the chosen half-month's heat and rain, not
 * about the verdict.
 *
 * The sort is applied here rather than in the list, because `Filters.sort` is
 * a member of `Filters` like any other: the rows that cross this seam are the
 * rows the list draws, the map orders its markers by and the headline counts,
 * and sorting past it gave the three of them three orderings.
 */
export const buildPassRows = (
  passes: Pass[],
  years: Years,
  filters: Filters,
  isFavorite: Query["isFavorite"],
  signals?: Signals,
): PassRow[] => {
  const q = query(filters, isFavorite);
  const i = periodIndex(filters.period);
  const rows: PassRow[] = [];
  for (const pass of passes) {
    const input = inputAt(signalsOf(signals, pass.slug), filters.period);
    if (!passMatches(pass, filters, q, input)) continue;
    const year = years.passes[pass.slug];
    if (!year) continue;
    const cell = year.cells[i];
    if (!cell || !filters.status.includes(cell.status)) continue;
    rows.push({
      favorite: isFavorite("pass", pass.slug),
      pass,
      reason: reasonOf(cell),
      season: year.cells,
      status: cell.status,
    });
  }
  return sortPassRows(rows, filters.sort);
};

export interface TourRow {
  tour: Tour;
  status: Status;
  /** The first reason of the pass that limits the tour – the word next to the dot. */
  reason: StatusReason | null;
  favorite: boolean;
  season: YearCell[];
  /** The loop's window in the row's words: "Anfang Mai bis Ende Oktober" or "wie ihre Pässe". */
  window: string;
}

export const buildTourRows = (
  tours: Tour[],
  passes: PassIndex,
  years: Years,
  filters: Filters,
  isFavorite: Query["isFavorite"],
  signals?: Signals,
): TourRow[] => {
  const q = query(filters, isFavorite);
  const i = periodIndex(filters.period);
  const rows: TourRow[] = [];
  for (const tour of tours) {
    const favorite = isFavorite("tour", tour.slug);
    if (q.favoritesOnly && !favorite) continue;
    if (!tourMatches(tour, passes, filters, q, signals)) continue;
    const year = years.tours[tour.slug];
    if (!year) continue;
    const cell = year.cells[i];
    if (!cell || !filters.status.includes(cell.status)) continue;
    rows.push({
      favorite,
      reason: reasonOf(cell),
      season: year.cells,
      status: cell.status,
      tour,
      window: tourWindowWord(tour),
    });
  }
  return rows.toSorted((a, b) => b.tour.elevationGain - a.tour.elevationGain);
};

export interface TownRow {
  town: Town;
  favorite: boolean;
}

export const buildTownRows = (
  towns: Town[],
  filters: Filters,
  isFavorite: Query["isFavorite"],
): TownRow[] => {
  const q = query(filters, isFavorite);
  const rows: TownRow[] = [];
  for (const town of towns) {
    const favorite = isFavorite("town", town.slug);
    if (q.favoritesOnly && !favorite) continue;
    if (!q.matches(townHaystack(town))) continue;
    rows.push({ favorite, town });
  }
  return rows.toSorted((a, b) => a.town.name.localeCompare(b.town.name, "de"));
};

/**
 * The three filtered lists, as the explorer builds them once and hands them
 * on. The sidebar draws one of them at a time, the map draws all three as
 * marks; both read the same object, which is why it is one type rather than
 * the same three fields spelled out at each end.
 */
export interface Rows {
  pass: readonly PassRow[];
  tour: readonly TourRow[];
  town: readonly TownRow[];
}

/**
 * How many roads a filter chip would leave, counted **disjunctively**: the
 * patch carries both the option and the lifting of its own group's filter,
 * because a group's own selection must not decide its own options' numbers.
 * Count them conjunctively instead – with the group's current choice still in
 * force – and in a group where one chip is pressed every other chip reads 0,
 * although each of them is one tap away. Search engines call the same trick
 * `excludeTags` (Solr), `disjunctiveFacets` (Algolia) or a `post_filter` with
 * one aggregation per facet (Elasticsearch).
 *
 * It buys a second thing for free: because a group's numbers ignore that
 * group's own state, they do not move while the group is being operated. Only
 * a change in another group makes them jump, so nothing shifts under the
 * thumb that is doing the tapping.
 *
 * The same idea is already in this file: `statusHistogram` below drops the
 * status filter and the summer filters, for exactly this reason – on the
 * period axis.
 */
export const facetCount = (
  passes: Pass[],
  years: Years,
  filters: Filters,
  isFavorite: Query["isFavorite"],
  patch: Partial<Filters>,
  signals?: Signals,
): number =>
  countPasses(passes, years, { ...filters, ...patch }, isFavorite, signals);

export interface HistogramBar {
  period: Period;
  best: number;
  good: number;
  limited: number;
  closed: number;
}

/** The stack of one bar, top to bottom. */
export const barTotal = (b: HistogramBar) =>
  b.best + b.good + b.limited + b.closed;

/**
 * One half-month of the season band: how many passes are at their best, good,
 * limited or closed, what the grade of most of them is, and the climate they
 * average out to.
 */
export interface SeasonBar extends HistogramBar {
  /** What most of the counted passes are graded – the band's ribbon. */
  grade: Grade | null;
  /**
   * Means over the counted passes that carry a climate series, null when none
   * does. They are means over *summits of different heights*, so they are a
   * property of the current selection and never of "the Alps"; whatever shows
   * them has to say so (`docs/scales.md`).
   */
  tmax: number | null;
  tmin: number | null;
  snowPct: number | null;
  wetPct: number | null;
}

export interface SeasonBand {
  bars: SeasonBar[];
  /** Mean latitude of the counted passes; what a day length is computed for. */
  lat: number | null;
}

/**
 * The grade most of a bar's passes are in. A tie goes to the better grade –
 * `GRADE_ORDER` runs from best to closed and only a strict majority displaces
 * what leads – so a half-month split evenly between "gut" and "eingeschränkt"
 * is not talked down.
 */
const dominantGrade = (bar: HistogramBar): Grade | null => {
  if (barTotal(bar) === 0) return null;
  let lead = GRADE_ORDER[0]!;
  for (const grade of GRADE_ORDER) if (bar[grade] > bar[lead]) lead = grade;
  return lead;
};

/**
 * Which passes the period axis is drawn for. The status filter is deliberately
 * ignored: it would hide exactly the alternatives the band is there to show.
 * The summer-signal filters read the chosen half-month and are ignored for the
 * same reason.
 */
const bandPasses = (
  passes: Pass[],
  filters: Filters,
  isFavorite: Query["isFavorite"],
  signals?: Signals,
): Pass[] => {
  const q = query(filters, isFavorite);
  const unbounded = {
    ...filters,
    maxValleyTmax: HEAT_NONE,
    maxWetDays: WET_NONE,
  };
  return passes.filter((pass) =>
    passMatches(
      pass,
      unbounded,
      q,
      inputAt(signalsOf(signals, pass.slug), filters.period),
    ),
  );
};

/**
 * The whole year of the current selection in 24 bars – what the season band
 * draws. Three quantities per half-month, all of them over the same set of
 * passes: the grade counts (bar and ribbon), the mean day temperature (bar
 * height) and the mean share of days with snowfall (the hanging bar).
 *
 * Nothing is graded here: the cells come from `getYears`, as everywhere else.
 */
export const seasonBand = (
  passes: Pass[],
  years: Years,
  filters: Filters,
  isFavorite: Query["isFavorite"],
  signals?: Signals,
): SeasonBand => {
  const bars: SeasonBar[] = PERIODS.map((period) => ({
    best: 0,
    closed: 0,
    good: 0,
    grade: null,
    limited: 0,
    period,
    snowPct: null,
    tmax: null,
    tmin: null,
    wetPct: null,
  }));
  // Sums and their own counts: a pass without a climate series still counts
  // towards the grades, so the two denominators are not the same number.
  const sums = PERIODS.map(() => ({
    n: 0,
    snowPct: 0,
    tmax: 0,
    tmin: 0,
    wetPct: 0,
  }));
  let latSum = 0;
  let counted = 0;
  for (const pass of bandPasses(passes, filters, isFavorite, signals)) {
    const cells = years.passes[pass.slug]?.cells;
    if (!cells) continue;
    latSum += pass.lat;
    counted += 1;
    const { climate } = signalsOf(signals, pass.slug);
    for (let i = 0; i < bars.length; i += 1) {
      bars[i]![cells[i]!.grade] += 1;
      const bucket = climate?.[i];
      if (!bucket) continue;
      const s = sums[i]!;
      s.n += 1;
      s.tmax += bucket.tmax;
      s.tmin += bucket.tmin;
      s.snowPct += bucket.snowPct;
      s.wetPct += bucket.wetPct;
    }
  }
  for (const [i, bar] of bars.entries()) {
    const s = sums[i]!;
    if (s.n) {
      bar.tmax = s.tmax / s.n;
      bar.tmin = s.tmin / s.n;
      bar.snowPct = s.snowPct / s.n;
      bar.wetPct = s.wetPct / s.n;
    }
    bar.grade = dominantGrade(bar);
  }
  return { bars, lat: counted ? latSum / counted : null };
};

/** The bar of the chosen half-month – what the headline and the band's label both read. */
export const currentBar = (band: SeasonBand, period: Period): SeasonBar =>
  band.bars[periodIndex(period)]!;

/**
 * How many rows share one block of a list, and the blocks themselves.
 *
 * The blocks exist so an off-screen one is skipped whole (`RowList`,
 * components/sidebar/row-list.tsx), and one that is on screen is paid for in
 * full; what that still buys is in docs/ui-conventions.md ("A long list comes
 * in blocks of ten"). Ten is about a screenful of the
 * bottom sheet at its lower snap point, so at rest one block is rendered and
 * the rest are not; smaller blocks buy little more and cost a wrapper each.
 */
export const ROWS_PER_BLOCK = 10;

export const rowBlocks = <T>(rows: readonly T[]): T[][] => {
  const blocks: T[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_BLOCK)
    blocks.push(rows.slice(i, i + ROWS_PER_BLOCK));
  return blocks;
};
