import { REACH_BANDS, haversine, reachBand, reachWeight } from "@/lib/geo";
import type { ReachBand } from "@/lib/geo";
import type { NearbyTour } from "@/lib/nearby";
import { cellAt } from "@/lib/status";
import type { Grade, YearCell, Years } from "@/lib/status";
import type { LatLon, Pass, Period, Status, Tour, Town } from "@/lib/types";

/**
 * What is within reach of a point, in one vocabulary.
 *
 * The panel used to have four answers to "what is near here" on one screen: a
 * flat radius list of passes and towns sorted by distance, a tour list the
 * server had measured against the selection rather than against the point the
 * block was drawn for, and a ranked, banded list of passes one screen-fold
 * above it – so a pass could be "im Umkreis von 75 km" in one block and "vor
 * der Haustür" in the next, and the block that came second had to be told by
 * a flag what the first had already drawn
 * (docs/plans/31-panel-model.md).
 *
 * Everything here is measured once, in the bands, the weight and the reach of
 * `lib/geo.ts`, and handed over in one shape. What differs between the blocks
 * is only how the same list is *read*: `inBands` groups it the way a person
 * thinks about a day on the bike, `byDistance` puts the nearest first – two
 * views of one computation, so the panel can keep showing both orderings
 * without either being a second measurement.
 *
 * Nothing here judges anything: a pass's grade comes out of `getYears`, a
 * tour's reach out of `lib/nearby.ts`. Distance is all this module measures.
 */

/** How many reachable passes sit at each grade in one half-month. */
export interface GradeCount {
  best: number;
  good: number;
  limited: number;
  closed: number;
}

export const emptyCount = (): GradeCount => ({
  best: 0,
  closed: 0,
  good: 0,
  limited: 0,
});

/** Passes a rider would actually go out for: the two upper grades. */
export const rideable = (c: GradeCount) => c.best + c.good;

/** What every reachable thing carries, whatever kind it is. */
interface Near {
  /** Distance in km: to the point for a pass or a town, to the road for a tour. */
  km: number;
  band: ReachBand;
  /** What the ranked reading is ordered by; never shown. */
  score: number;
}

export interface ReachedPass extends Near {
  pass: Pass;
  /** The pass's own status in the chosen half-month. */
  status: Status;
  grade: Grade;
  /** The pass's 24 cells, for the strip in the row. */
  season: YearCell[];
}

export interface ReachedTour extends Near {
  tour: Tour;
}

/** One town within reach, with what it would be worth as a base. */
export interface ReachedTown extends Near {
  town: Town;
  /** How many passes are rideable from there in this half-month. */
  rideable: number;
  /** How many it reaches at all – the denominator of the line above. */
  total: number;
}

/**
 * How a reachable pass is ranked. Three factors, each of which a planner
 * would name out loud if asked why one pass comes before another:
 *
 *  - **is it rideable now** – a closed pass is not an argument for a base in
 *    that half-month, however beautiful it is, so the grade is the coarse
 *    sort and the strongest term;
 *  - **is it worth riding** – beauty and fame, the editorial scales;
 *  - **is it near** – `reachWeight`, the smooth one, which is what keeps a
 *    pass at 12 km ahead of an equally pretty one at 70 without a radius
 *    having to decide anything.
 *
 * The weight is a factor and not a filter, which is the point of the whole
 * exercise: at 70 km a pass has to be genuinely better to out-rank a nearer
 * one, rather than being thrown away for being over a round number.
 */
const GRADE_SCORE: Record<Grade, number> = {
  best: 1,
  closed: 0.1,
  good: 0.8,
  limited: 0.35,
};

/** The nearness term, kept off zero so a far pass is ranked and not erased. */
const nearness = (km: number) => 0.35 + reachWeight(km);

const byScore = <T extends Near>(list: T[]): T[] =>
  list.toSorted((a, b) => b.score - a.score);

/**
 * The passes within reach, best first. `exclude` is the entity's own slug: a
 * town does not count itself and a pass panel does not list its own road.
 */
export const reachedPasses = (
  at: LatLon,
  passes: readonly Pass[],
  years: Years,
  period: Period,
  exclude?: string,
): ReachedPass[] => {
  const out: ReachedPass[] = [];
  for (const pass of passes) {
    if (pass.slug === exclude) continue;
    const km = haversine(at, pass);
    const band = reachBand(km);
    if (band === null) continue;
    const year = years.passes[pass.slug];
    if (!year) continue;
    const cell = cellAt(year, period);
    out.push({
      band,
      grade: cell.grade,
      km,
      pass,
      score:
        GRADE_SCORE[cell.grade] * (pass.beauty + pass.fame / 2) * nearness(km),
      season: year.cells,
      status: cell.status,
    });
  }
  return byScore(out);
};

/**
 * How the reachable passes fall across the grades in one half-month – the two
 * numbers a candidate base is ranked by, and nothing else.
 *
 * This is the entry point `reachedTowns` needs. It used to run the whole
 * destination arithmetic per town, which allocated a `ReachedPass` with 24
 * cells for every reachable pass of every candidate and then kept a count of
 * two.
 */
export const reachCount = (
  at: LatLon,
  passes: readonly Pass[],
  years: Years,
  period: Period,
): GradeCount => {
  const count = emptyCount();
  for (const pass of passes) {
    if (reachBand(haversine(at, pass)) === null) continue;
    const year = years.passes[pass.slug];
    if (year) count[cellAt(year, period).grade] += 1;
  }
  return count;
};

/**
 * The same counts for all 24 half-months, tallied from passes already in
 * hand – what a destination's derived year is made of. Nothing is measured a
 * second time: the seasons came along with the reach.
 */
export const reachCounts = (reached: readonly ReachedPass[]): GradeCount[] => {
  const counts = Array.from({ length: 24 }, emptyCount);
  for (const r of reached)
    for (const [i, cell] of r.season.entries()) counts[i]![cell.grade] += 1;
  return counts;
};

/**
 * The towns within reach, best first – each judged by what *it* reaches,
 * which is why a nearer village can be the worse base.
 */
export const reachedTowns = (
  at: LatLon,
  towns: readonly Town[],
  passes: readonly Pass[],
  years: Years,
  period: Period,
  exclude?: string,
): ReachedTown[] => {
  const out: ReachedTown[] = [];
  for (const town of towns) {
    if (town.slug === exclude) continue;
    const km = haversine(at, town);
    const band = reachBand(km);
    if (band === null) continue;
    const count = reachCount(town, passes, years, period);
    const n = rideable(count);
    out.push({
      band,
      km,
      rideable: n,
      score: nearness(km) * (1 + n),
      total: count.best + count.good + count.limited + count.closed,
      town,
    });
  }
  return byScore(out);
};

/**
 * The tours within reach, best first. A tour is a line, so its distance was
 * measured on the server against the whole road (`lib/nearby.ts`); this reads
 * that measurement and never takes one of its own.
 */
export const reachedTours = (
  tourReach: readonly NearbyTour[],
  tours: readonly Tour[],
  years: Years,
  period: Period,
): ReachedTour[] => {
  const index = new Map(tours.map((t) => [t.slug, t]));
  const out: ReachedTour[] = [];
  for (const { km, slug } of tourReach) {
    const tour = index.get(slug);
    const band = reachBand(km);
    if (!tour || band === null) continue;
    out.push({
      band,
      km,
      score:
        GRADE_SCORE[cellAt(years.tours[slug], period).grade] * nearness(km),
      tour,
    });
  }
  return byScore(out);
};

/** Which of the three lists a block above has already ranked. */
export type ReachKind = "passes" | "tours" | "towns";

export interface Reach {
  passes: ReachedPass[];
  tours: ReachedTour[];
  towns: ReachedTown[];
}

export interface ReachOptions {
  passes: readonly Pass[];
  tours: readonly Tour[];
  towns: readonly Town[];
  /** What the server measured for *this* entity; see `NearbyTours`. */
  tourReach: readonly NearbyTour[];
  years: Years;
  period: Period;
  /** The entity's own slug – nothing is within reach of itself. */
  exclude?: string;
  /**
   * Kinds a block above already shows, ranked and banded. They come back
   * empty, and the work of measuring them is not done twice. This replaced
   * the two booleans the nearby block took to be told what a sibling had
   * drawn – a block should not have to know about its neighbours.
   */
  claimed?: readonly ReachKind[];
}

/** Everything within reach of one point, in one value. */
export const withinReach = (at: LatLon, o: ReachOptions): Reach => {
  const claimed = o.claimed ?? [];
  const has = (kind: ReachKind) => !claimed.includes(kind);
  return {
    passes: has("passes")
      ? reachedPasses(at, o.passes, o.years, o.period, o.exclude)
      : [],
    tours: has("tours")
      ? reachedTours(o.tourReach, o.tours, o.years, o.period)
      : [],
    towns: has("towns")
      ? reachedTowns(at, o.towns, o.passes, o.years, o.period, o.exclude)
      : [],
  };
};

/** One band's worth of a reach list. */
export interface Band<T> {
  /** Which band; its words are `vocab.band` in the page's language. */
  band: ReachBand;
  /** Where the band ends, for the header that says "bis 18 km". */
  maxKm: number;
  items: T[];
}

/**
 * The ranked reading, grouped the way a rider thinks about a day: out of the
 * door, a day's loop, or a drive first. Empty bands are dropped, and the order
 * inside a band is the order it was handed over in.
 */
export const inBands = <T extends { band: ReachBand }>(
  list: readonly T[],
): Band<T>[] =>
  REACH_BANDS.map((b) => ({
    band: b.key,
    items: list.filter((r) => r.band === b.key),
    maxKm: b.maxKm,
  })).filter((g) => g.items.length > 0);

/**
 * The other reading: nearest first, no judgement. The "Im Umkreis" block is
 * deliberately not the ranked list – it answers "what else is around here",
 * where distance is the only thing worth ordering by – so it takes the same
 * value and reads it the other way.
 */
export const byDistance = <T extends { km: number }>(list: readonly T[]): T[] =>
  list.toSorted((a, b) => a.km - b.km);
