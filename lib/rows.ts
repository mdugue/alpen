import {
  climateBucket,
  passSeason,
  passStatus,
  PERIODS,
  tourSeason,
  tourStatus,
  type PassIndex,
} from "@/lib/status";
import { statusMatches, type EntityKind, type Filters } from "@/lib/app-state";
import type { ClimateYear, Pass, Period, Status, Tour, Town } from "@/lib/types";

/**
 * One filtered list per entity kind. Search and the favourites toggle apply to
 * all three, the status filter to passes and tours, fame and elevation to
 * passes only. Map visibility (hidden tours, towns on/off) is not a filter and
 * is handled by the map itself.
 */

interface Query {
  matches: (...parts: string[]) => boolean;
  favoritesOnly: boolean;
  isFavorite: (kind: EntityKind, slug: string) => boolean;
}

function query(filters: Filters, isFavorite: Query["isFavorite"]): Query {
  const q = filters.query.trim().toLowerCase();
  return {
    matches: (...parts) => !q || parts.join(" ").toLowerCase().includes(q),
    favoritesOnly: filters.favoritesOnly,
    isFavorite,
  };
}

/** Everything about a pass except its status: search, favourites, fame, elevation. */
function passMatches(pass: Pass, filters: Filters, q: Query): boolean {
  if (pass.elevation < filters.minElevation || pass.fame < filters.minFame) return false;
  if (q.favoritesOnly && !q.isFavorite("pass", pass.slug)) return false;
  return q.matches(pass.name, pass.region, pass.country);
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
    const status = passStatus(pass, filters.period, climateBucket(climate, pass.slug, filters.period));
    if (!statusMatches(status, filters.status)) continue;
    rows.push({ pass, status, favorite: isFavorite("pass", pass.slug), season: passSeason(pass, climate?.[pass.slug]) });
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
    if (!q.matches(tour.name, tour.description)) continue;
    const status = tourStatus(tour, passes, filters.period, climate);
    if (!statusMatches(status, filters.status)) continue;
    rows.push({ tour, status, favorite, season: tourSeason(tour, passes, climate) });
  }
  return rows.sort((a, b) => b.tour.elevationGain - a.tour.elevationGain);
}

export interface TownRow {
  town: Town;
  favorite: boolean;
}

export function buildTownRows(towns: Town[], filters: Filters, isFavorite: Query["isFavorite"]): TownRow[] {
  const q = query(filters, isFavorite);
  const rows: TownRow[] = [];
  for (const town of towns) {
    const favorite = isFavorite("town", town.slug);
    if (q.favoritesOnly && !favorite) continue;
    if (!q.matches(town.name, town.why, town.country)) continue;
    rows.push({ town, favorite });
  }
  return rows.sort((a, b) => a.town.name.localeCompare(b.town.name, "de"));
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
  const bars: HistogramBar[] = PERIODS.map((period) => ({ period, open: 0, risky: 0, closed: 0 }));
  for (const pass of passes) {
    if (!passMatches(pass, filters, q)) continue;
    const season = passSeason(pass, climate?.[pass.slug]);
    for (let i = 0; i < bars.length; i++) bars[i]![season[i]!]++;
  }
  return bars;
}

export type PassSort = "elevation" | "name" | "status" | "beauty" | "fame" | "difficulty" | "traffic";

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

/** Direction is fixed per key: the "best" value first. */
export function sortPassRows(rows: PassRow[], sort: PassSort): PassRow[] {
  const byName = (a: PassRow, b: PassRow) => a.pass.name.localeCompare(b.pass.name, "de");
  const cmp: Record<PassSort, (a: PassRow, b: PassRow) => number> = {
    elevation: (a, b) => b.pass.elevation - a.pass.elevation,
    name: byName,
    status: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.pass.elevation - a.pass.elevation,
    beauty: (a, b) => b.pass.beauty - a.pass.beauty,
    fame: (a, b) => b.pass.fame - a.pass.fame,
    difficulty: (a, b) => b.pass.difficulty - a.pass.difficulty,
    traffic: (a, b) => a.pass.traffic - b.pass.traffic,
  };
  return [...rows].sort((a, b) => cmp[sort](a, b) || byName(a, b));
}
