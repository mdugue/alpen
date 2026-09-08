import { statusMatches } from "@/lib/app-state";
import type { EntityKind, Filters, PassSort } from "@/lib/app-state";
import {
  matches,
  passHaystack,
  tourHaystack,
  townHaystack,
} from "@/lib/search";
import {
  climateBucket,
  passSeason,
  passStatus,
  PERIODS,
  tourSeason,
  tourStatus,
} from "@/lib/status";
import type { PassIndex } from "@/lib/status";
import type {
  ClimateYear,
  Pass,
  Period,
  Status,
  Tour,
  Town,
} from "@/lib/types";

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

function query(filters: Filters, isFavorite: Query["isFavorite"]): Query {
  const q = filters.query.trim();
  return {
    matches: (haystack) => !q || matches(haystack, q),
    favoritesOnly: filters.favoritesOnly,
    isFavorite,
  };
}

/** Lower bounds, "at least this interesting": a tour needs one pass that clears them. */
const interesting = (pass: Pass, f: Filters) =>
  pass.elevation >= f.minElevation &&
  pass.fame >= f.minFame &&
  pass.beauty >= f.minBeauty &&
  pass.difficulty >= f.difficulty[0];

/** Upper bounds, "not harder or busier than": every pass of a tour has to respect them. */
const withinLimits = (pass: Pass, f: Filters) =>
  pass.difficulty <= f.difficulty[1] && pass.traffic <= f.maxTraffic;

/** Everything about a pass except its status: criteria, favourites, search. */
function passMatches(pass: Pass, filters: Filters, q: Query): boolean {
  if (!interesting(pass, filters) || !withinLimits(pass, filters)) return false;
  if (q.favoritesOnly && !q.isFavorite("pass", pass.slug)) return false;
  return q.matches(passHaystack(pass));
}

/** The pass criteria reach a tour through the passes it crosses. */
function tourMatches(
  tour: Tour,
  passes: PassIndex,
  filters: Filters,
  q: Query,
): boolean {
  const own = tour.passes
    .map((s) => passes.get(s))
    .filter((p) => p !== undefined);
  if (own.length && !own.some((p) => interesting(p, filters))) return false;
  if (!own.every((p) => withinLimits(p, filters))) return false;
  return q.matches(
    tourHaystack(
      tour,
      own.map((p) => p.name),
    ),
  );
}

export interface PassRow {
  pass: Pass;
  status: Status;
  favorite: boolean;
  /** 24 verdicts for the season strip, one per half-month. */
  season: Status[];
}

export function buildPassRows(
  passes: Pass[],
  filters: Filters,
  isFavorite: Query["isFavorite"],
  climate?: Record<string, ClimateYear>,
): PassRow[] {
  const q = query(filters, isFavorite);
  const rows: PassRow[] = [];
  for (const pass of passes) {
    if (!passMatches(pass, filters, q)) continue;
    const status = passStatus(
      pass,
      filters.period,
      climateBucket(climate, pass.slug, filters.period),
    );
    if (!statusMatches(status, filters.status)) continue;
    rows.push({
      pass,
      status,
      favorite: isFavorite("pass", pass.slug),
      season: passSeason(pass, climate?.[pass.slug]),
    });
  }
  return rows;
}

export interface TourRow {
  tour: Tour;
  status: Status;
  favorite: boolean;
  season: Status[];
}

export function buildTourRows(
  tours: Tour[],
  passes: PassIndex,
  filters: Filters,
  isFavorite: Query["isFavorite"],
  climate?: Record<string, ClimateYear>,
): TourRow[] {
  const q = query(filters, isFavorite);
  const rows: TourRow[] = [];
  for (const tour of tours) {
    const favorite = isFavorite("tour", tour.slug);
    if (q.favoritesOnly && !favorite) continue;
    if (!tourMatches(tour, passes, filters, q)) continue;
    const status = tourStatus(tour, passes, filters.period, climate);
    if (!statusMatches(status, filters.status)) continue;
    rows.push({
      tour,
      status,
      favorite,
      season: tourSeason(tour, passes, climate),
    });
  }
  return rows.toSorted((a, b) => b.tour.elevationGain - a.tour.elevationGain);
}

export interface TownRow {
  town: Town;
  favorite: boolean;
}

export function buildTownRows(
  towns: Town[],
  filters: Filters,
  isFavorite: Query["isFavorite"],
): TownRow[] {
  const q = query(filters, isFavorite);
  const rows: TownRow[] = [];
  for (const town of towns) {
    const favorite = isFavorite("town", town.slug);
    if (q.favoritesOnly && !favorite) continue;
    if (!q.matches(townHaystack(town))) continue;
    rows.push({ town, favorite });
  }
  return rows.toSorted((a, b) => a.town.name.localeCompare(b.town.name, "de"));
}

export interface HistogramBar {
  period: Period;
  open: number;
  risky: number;
  closed: number;
}

/**
 * How many of the currently interesting passes are open, weather-dependent or
 * closed per half-month – the backdrop of the period scrubber. The status
 * filter is deliberately ignored: it would hide exactly the alternatives the
 * histogram is there to show.
 */
export function statusHistogram(
  passes: Pass[],
  filters: Filters,
  isFavorite: Query["isFavorite"],
  climate?: Record<string, ClimateYear>,
): HistogramBar[] {
  const q = query(filters, isFavorite);
  const bars: HistogramBar[] = PERIODS.map((period) => ({
    period,
    open: 0,
    risky: 0,
    closed: 0,
  }));
  for (const pass of passes) {
    if (!passMatches(pass, filters, q)) continue;
    const season = passSeason(pass, climate?.[pass.slug]);
    for (let i = 0; i < bars.length; i += 1) bars[i]![season[i]!] += 1;
  }
  return bars;
}

export const PASS_SORT_LABEL: Record<PassSort, string> = {
  elevation: "Höhe",
  name: "Name",
  status: "Status",
  beauty: "Schönheit",
  fame: "Bekanntheit",
  difficulty: "Schwierigkeit",
  traffic: "Verkehr",
};

const STATUS_RANK: Record<Status, number> = { open: 0, risky: 1, closed: 2 };

const byName = (a: PassRow, b: PassRow) =>
  a.pass.name.localeCompare(b.pass.name, "de");

/** Direction is fixed per key: the "best" value first. */
export function sortPassRows(rows: PassRow[], sort: PassSort): PassRow[] {
  const cmp: Record<PassSort, (a: PassRow, b: PassRow) => number> = {
    elevation: (a, b) => b.pass.elevation - a.pass.elevation,
    name: byName,
    status: (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      b.pass.elevation - a.pass.elevation,
    beauty: (a, b) => b.pass.beauty - a.pass.beauty,
    fame: (a, b) => b.pass.fame - a.pass.fame,
    difficulty: (a, b) => b.pass.difficulty - a.pass.difficulty,
    traffic: (a, b) => a.pass.traffic - b.pass.traffic,
  };
  return rows.toSorted((a, b) => cmp[sort](a, b) || byName(a, b));
}
