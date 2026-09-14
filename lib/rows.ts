import { HEAT_NONE, statusMatches, WET_NONE } from "@/lib/app-state";
import type { EntityKind, Filters, PassSort } from "@/lib/app-state";
import {
  matches,
  passHaystack,
  tourHaystack,
  townHaystack,
} from "@/lib/search";
import {
  daysOf,
  inputAt,
  passGrades,
  passVerdict,
  PERIODS,
  signalsOf,
  tourGrades,
  tourVerdict,
  valleyTmax,
} from "@/lib/status";
import type {
  Grade,
  PassIndex,
  Signals,
  StatusReason,
  VerdictInput,
} from "@/lib/status";
import type { Pass, Period, Status, Tour, Town } from "@/lib/types";

export type { PassSort } from "@/lib/app-state";

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
 * question, but it also grades every surviving pass for all 24 half-months for
 * the season strip – around forty times the work of the verdict a count needs,
 * and a filter panel asks this once per option on every keystroke. Counting is
 * therefore its own path over the same two predicates.
 */
const countPasses = (
  passes: Pass[],
  filters: Filters,
  isFavorite: Query["isFavorite"],
  signals?: Signals,
): number => {
  const q = query(filters, isFavorite);
  let n = 0;
  for (const pass of passes) {
    const input = inputAt(signalsOf(signals, pass.slug), filters.period);
    if (!passMatches(pass, filters, q, input)) continue;
    if (
      !statusMatches(
        passVerdict(pass, filters.period, input).status,
        filters.status,
      )
    )
      continue;
    n += 1;
  }
  return n;
};

export interface PassRow {
  pass: Pass;
  status: Status;
  /** The first reason of a limited status – the word next to the dot. */
  reason: StatusReason | null;
  favorite: boolean;
  /** 24 grades for the season strip, one per half-month. */
  season: Grade[];
}

export const buildPassRows = (
  passes: Pass[],
  filters: Filters,
  isFavorite: Query["isFavorite"],
  signals?: Signals,
): PassRow[] => {
  const q = query(filters, isFavorite);
  const rows: PassRow[] = [];
  for (const pass of passes) {
    const own = signalsOf(signals, pass.slug);
    const input = inputAt(own, filters.period);
    if (!passMatches(pass, filters, q, input)) continue;
    const { status, reasons } = passVerdict(pass, filters.period, input);
    if (!statusMatches(status, filters.status)) continue;
    rows.push({
      favorite: isFavorite("pass", pass.slug),
      pass,
      reason: status === "risky" ? (reasons[0] ?? null) : null,
      season: passGrades(pass, own),
      status,
    });
  }
  return rows;
};

export interface TourRow {
  tour: Tour;
  status: Status;
  /** The first reason of the pass that limits the tour – the word next to the dot. */
  reason: StatusReason | null;
  favorite: boolean;
  season: Grade[];
}

export const buildTourRows = (
  tours: Tour[],
  passes: PassIndex,
  filters: Filters,
  isFavorite: Query["isFavorite"],
  signals?: Signals,
): TourRow[] => {
  const q = query(filters, isFavorite);
  const rows: TourRow[] = [];
  for (const tour of tours) {
    const favorite = isFavorite("tour", tour.slug);
    if (q.favoritesOnly && !favorite) continue;
    if (!tourMatches(tour, passes, filters, q, signals)) continue;
    const { status, reasons } = tourVerdict(
      tour,
      passes,
      filters.period,
      signals,
    );
    if (!statusMatches(status, filters.status)) continue;
    rows.push({
      favorite,
      reason: status === "risky" ? (reasons[0] ?? null) : null,
      season: tourGrades(tour, passes, signals),
      status,
      tour,
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
  filters: Filters,
  isFavorite: Query["isFavorite"],
  patch: Partial<Filters>,
  signals?: Signals,
): number => countPasses(passes, { ...filters, ...patch }, isFavorite, signals);

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
 * How many of the currently interesting passes are at their best, good,
 * limited or closed per half-month – the backdrop of the period scrubber. The
 * status filter is deliberately ignored: it would hide exactly the
 * alternatives the histogram is there to show. The summer-signal filters read
 * the chosen half-month and are ignored for the same reason.
 */
export const statusHistogram = (
  passes: Pass[],
  filters: Filters,
  isFavorite: Query["isFavorite"],
  signals?: Signals,
): HistogramBar[] => {
  const q = query(filters, isFavorite);
  const unbounded = {
    ...filters,
    maxValleyTmax: HEAT_NONE,
    maxWetDays: WET_NONE,
  };
  const bars: HistogramBar[] = PERIODS.map((period) => ({
    best: 0,
    closed: 0,
    good: 0,
    limited: 0,
    period,
  }));
  for (const pass of passes) {
    const own = signalsOf(signals, pass.slug);
    if (!passMatches(pass, unbounded, q, inputAt(own, filters.period)))
      continue;
    const season = passGrades(pass, own);
    for (let i = 0; i < bars.length; i += 1) bars[i]![season[i]!] += 1;
  }
  return bars;
};

/** The sort menu, in the order it is offered. */
export const PASS_SORTS: readonly PassSort[] = [
  "elevation",
  "name",
  "status",
  "beauty",
  "fame",
  "difficulty",
  "traffic",
];

export const PASS_SORT_LABEL: Record<PassSort, string> = {
  beauty: "Schönheit",
  difficulty: "Schwierigkeit",
  elevation: "Höhe",
  fame: "Bekanntheit",
  name: "Name",
  status: "Status",
  traffic: "Verkehr",
};

const STATUS_RANK: Record<Status, number> = { closed: 2, open: 0, risky: 1 };

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
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      b.pass.elevation - a.pass.elevation,
    traffic: (a, b) => a.pass.traffic - b.pass.traffic,
  };
  return rows.toSorted((a, b) => cmp[sort](a, b) || byName(a, b));
};
