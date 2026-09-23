import { ALL_RANGES, HEAT_NONE, WET_NONE } from "@/lib/app-state";
import type { EntityKind, Filters, ListTab, PassSort } from "@/lib/app-state";
import { areaScore, areaText, areaVerdict } from "@/lib/destination";
import type { DerivedVerdict, DestinationMembers } from "@/lib/destination";
import type { Messages } from "@/lib/i18n";
import { periodIndex, PERIODS } from "@/lib/period";
import { rangeOf } from "@/lib/regions";
import type { RangeName } from "@/lib/regions";
import {
  destinationHaystack,
  matcher,
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
  TownIndex,
  VerdictInput,
  YearCell,
  Years,
} from "@/lib/status";
import type {
  Destination,
  Pass,
  Period,
  Status,
  Tour,
  Town,
} from "@/lib/types";

/*
 * One filtered list per entity kind. Search, the favourites toggle and the
 * range apply to all four; the status filter and the road criteria to the
 * roads and, through their roads, to the loops; an area is judged on all of
 * its roads and a town on none. Map visibility (hidden loops, towns on/off) is
 * a layer toggle, not a filter; what the map draws per kind is what the list
 * of that kind shows.
 */

/**
 * What every list is built from besides the filters: the graded years, the
 * signals the summer filters read, the favourites and the page's words, which
 * the haystacks and the loop's window are built in. The explorer builds it
 * once; it used to be five arguments in the same order at every call.
 */
export interface ListInputs {
  years: Years;
  signals: Signals;
  isFavorite: (kind: EntityKind, slug: string) => boolean;
  w: Messages;
}

interface Query {
  matches: (haystack: string) => boolean;
  favoritesOnly: boolean;
  isFavorite: ListInputs["isFavorite"];
  w: Messages;
}

const query = (filters: Filters, { isFavorite, w }: ListInputs): Query => {
  const q = filters.query.trim();
  return {
    favoritesOnly: filters.favoritesOnly,
    isFavorite,
    matches: q ? matcher(q) : () => true,
    w,
  };
};

/** Whether the range filter lets an entity of this range through; one without a range passes only while no range is asked for. */
const inRanges = (filters: Filters, range: RangeName | undefined) =>
  filters.ranges.length === ALL_RANGES.length ||
  (range !== undefined && filters.ranges.includes(range));

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
  f.types.includes(pass.type) &&
  f.surfaces.includes(pass.surface) &&
  f.ranges.includes(rangeOf(pass.region));

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
  return q.matches(passHaystack(pass, q.w));
};

/** The pass criteria reach a tour through the passes it crosses. */
const tourMatches = (
  tour: Tour,
  passes: PassIndex,
  filters: Filters,
  q: Query,
  signals: Signals,
): boolean => {
  // A loop is ridden with what its roads demand, so it answers the surface
  // chip with its own surface rather than through one member.
  if (!filters.surfaces.includes(tour.surface)) return false;
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
  filters: Filters,
  inputs: ListInputs,
): PassRow[] => {
  const { years, signals, isFavorite } = inputs;
  const q = query(filters, inputs);
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
  /**
   * The range the loop lies in: that of its passes, which `data:check` holds
   * to one (`rangeOfRoads`). Absent when none of them is known. One
   * definition for the row, the scene's opening frame and the frame guard.
   */
  range?: RangeName;
}

/**
 * The range of a loop or an area: that of its roads – the first known one,
 * since `data:check` holds a loop's to one and an area is drawn around one
 * valley.
 */
export const rangeOfRoads = (
  slugs: readonly string[],
  passes: PassIndex,
): RangeName | undefined => {
  for (const slug of slugs) {
    const p = passes.get(slug);
    if (p) return rangeOf(p.region);
  }
  return undefined;
};

export const buildTourRows = (
  tours: Tour[],
  passes: PassIndex,
  filters: Filters,
  inputs: ListInputs,
): TourRow[] => {
  const { years, signals, isFavorite, w } = inputs;
  const q = query(filters, inputs);
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
      range: rangeOfRoads(tour.passes, passes),
      reason: reasonOf(cell),
      season: year.cells,
      status: cell.status,
      tour,
      window: tourWindowWord(tour, w),
    });
  }
  return rows.toSorted((a, b) => b.tour.elevationGain - a.tour.elevationGain);
};

export interface TownRow {
  town: Town;
  favorite: boolean;
  /** The range the town belongs to through its reach; the row names it once there is more than one. */
  range?: RangeName;
  /**
   * The areas the list holds the town under (`homeAreasOf`); the first is the
   * one its row names when none of them is listed.
   */
  areas: readonly Destination[];
}

/**
 * Towns know one criterion: the range, through the nearest road in their reach
 * (`townRanges`, computed on the server). A town far from every road has no
 * range: it is listed while no range is asked for, and it drops out once one
 * is – "the Jura's towns" cannot include a town no Jura road is near.
 */
export const buildTownRows = (
  towns: Town[],
  townRanges: Partial<Record<string, RangeName>>,
  filters: Filters,
  inputs: ListInputs,
  /** Per town slug, the areas the list holds it under (`homeAreasOf`). */
  townAreas: Partial<Record<string, readonly Destination[]>> = {},
): TownRow[] => {
  const q = query(filters, inputs);
  const rows: TownRow[] = [];
  for (const town of towns) {
    const favorite = inputs.isFavorite("town", town.slug);
    if (q.favoritesOnly && !favorite) continue;
    const range = townRanges[town.slug];
    if (!inRanges(filters, range)) continue;
    if (!q.matches(townHaystack(town, range, inputs.w))) continue;
    rows.push({ areas: townAreas[town.slug] ?? [], favorite, range, town });
  }
  return rows.toSorted((a, b) => a.town.name.localeCompare(b.town.name, "de"));
};

export interface DestinationRow {
  destination: Destination;
  /** What the area holds, as the server derived it. */
  members: DestinationMembers;
  /** The counts of the chosen half-month and the derived year (`areaVerdict`). */
  verdict: DerivedVerdict;
  /** "7 von 9 Straßen gut" – the row's line and the compare sheet's. */
  text: string;
  /** What the list is ranked by for the chosen half-month (`areaScore`). */
  score: number;
  favorite: boolean;
  /** The 24 derived cells for the season strip. */
  season: YearCell[];
  /** The towns named as bases, resolved; unknown slugs are dropped. */
  baseTowns: Town[];
  /** The range the area lies in: its first member road's. */
  range?: RangeName;
}

/**
 * The destinations, ranked by what is rideable in the chosen half-month.
 * Only search, favourites and the range reach them: the road criteria describe
 * one road, and an area is judged on all of its roads, filtered or not – a
 * planner asking for "ab 2.500 m" still wants to know what else the area
 * holds. The status filter is left out for the same reason the season band
 * leaves it out: it would hide the alternatives the list is there to show.
 */
export const buildDestinationRows = (
  destinations: readonly Destination[],
  members: Record<string, DestinationMembers>,
  passes: PassIndex,
  towns: TownIndex,
  filters: Filters,
  inputs: ListInputs,
): DestinationRow[] => {
  const { years, isFavorite, w } = inputs;
  const q = query(filters, inputs);
  const rows: DestinationRow[] = [];
  for (const destination of destinations) {
    const favorite = isFavorite("destination", destination.slug);
    if (q.favoritesOnly && !favorite) continue;
    const own = members[destination.slug];
    if (!own) continue;
    const range = rangeOfRoads(own.passes, passes);
    if (!inRanges(filters, range)) continue;
    const baseTowns = destination.baseTowns
      .map((slug) => towns.get(slug))
      .filter((t) => t !== undefined);
    if (
      !q.matches(
        destinationHaystack(
          destination,
          baseTowns.map((t) => t.name),
          range,
          w,
        ),
      )
    )
      continue;
    const verdict = areaVerdict(own.passes, years, filters.period);
    rows.push({
      baseTowns,
      destination,
      favorite,
      members: own,
      range,
      score: areaScore(own.passes, passes, years, filters.period),
      season: verdict.year.cells,
      text: areaText(verdict, w),
      verdict,
    });
  }
  return rows.toSorted(
    (a, b) =>
      b.score - a.score ||
      a.destination.name.localeCompare(b.destination.name, "de"),
  );
};

/**
 * One group of the areas' list: an area with the towns listed under it, or –
 * `area: null`, last – the towns no listed area holds.
 */
export interface AreaGroup {
  area: DestinationRow | null;
  towns: TownRow[];
}

/**
 * The areas and the towns as one list: each town under every listed area it
 * is held under (`TownRow`'s `areas`), and the others – in no area, or only
 * in ones the filters dropped – in a last group. Both keep their own filters
 * (`buildDestinationRows`, `buildTownRows`); this only says where a town is
 * shown, because an area is where one goes and a town is where in it one
 * sleeps (docs/ui-conventions.md, "One list at a time").
 */
export const nestTowns = (
  areas: readonly DestinationRow[],
  towns: readonly TownRow[],
): AreaGroup[] => {
  const listed = new Set(areas.map((a) => a.destination.slug));
  const groups = areas.map((area) => ({
    area,
    towns: towns.filter((t) =>
      t.areas.some((d) => d.slug === area.destination.slug),
    ),
  }));
  const rest = towns.filter((t) => !t.areas.some((d) => listed.has(d.slug)));
  return rest.length > 0 ? [...groups, { area: null, towns: rest }] : groups;
};

/**
 * The number on each tab. The areas' tab counts what its list answers with:
 * an area, or a town outside every listed area – a town under its area is
 * part of that answer, not one of its own.
 */
export const tabCounts = (rows: Rows): Record<ListTab, number> => ({
  destination: nestTowns(rows.destination, rows.town).reduce(
    (n, g) => n + (g.area ? 1 : g.towns.length),
    0,
  ),
  pass: rows.pass.length,
  tour: rows.tour.length,
});

/**
 * The four filtered lists, as the explorer builds them once and hands them
 * on. The sidebar draws one of them at a time, the map draws all four as
 * marks; both read the same object, which is why it is one type rather than
 * the same four fields spelled out at each end.
 */
export interface Rows {
  destination: readonly DestinationRow[];
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
  filters: Filters,
  patch: Partial<Filters>,
  inputs: ListInputs,
): number => {
  // The same two predicates as `buildPassRows`, without a row per survivor:
  // the filter panel asks this once per chip on every keystroke.
  const patched = { ...filters, ...patch };
  const q = query(patched, inputs);
  const i = periodIndex(patched.period);
  let n = 0;
  for (const pass of passes) {
    const input = inputAt(signalsOf(inputs.signals, pass.slug), patched.period);
    if (!passMatches(pass, patched, q, input)) continue;
    const cell = inputs.years.passes[pass.slug]?.cells[i];
    if (cell && patched.status.includes(cell.status)) n += 1;
  }
  return n;
};

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
  inputs: ListInputs,
): Pass[] => {
  const q = query(filters, inputs);
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
      inputAt(signalsOf(inputs.signals, pass.slug), filters.period),
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
  filters: Filters,
  inputs: ListInputs,
): SeasonBand => {
  const { years, signals } = inputs;
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
  for (const pass of bandPasses(passes, filters, inputs)) {
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
