import {
  haversine,
  REACH_BANDS,
  reachBand,
  reachWeight,
  REACH_MAX_KM,
} from "@/lib/geo";
import type { ReachBand } from "@/lib/geo";
import { cellAt, periodIndex, PERIODS, statusOf } from "@/lib/status";
import type { Grade, Year, YearCell, Years } from "@/lib/status";
import type { LatLon, Pass, Period, Status, Town } from "@/lib/types";

/**
 * What a base is worth, for the half-month that is chosen.
 *
 * This is the module the product paragraph asks for and the app did not have:
 * "where should we look for a hotel so that several passes and a loop are
 * within reach" was answered with a list of names and their distances, which
 * is data, not an answer. A destination is judged the way a pass is judged –
 * a verdict for the chosen half-month, the whole year behind it, and the
 * reasons visible next to both.
 *
 * Nothing here measures anything new. A town has no climate series and no
 * season of its own; what it has is the passes it reaches, and every one of
 * those was already graded for all 24 half-months by `getYears`. A
 * destination's year is therefore *derived*, and it says so wherever it shows
 * (Principle 3): the strip is labelled "abgeleitet aus den Pässen im
 * Umkreis", and the passes it was derived from stay listed underneath with
 * their own strips.
 */

/** How many reachable passes sit at each grade in one half-month. */
export interface GradeCount {
  best: number;
  good: number;
  limited: number;
  closed: number;
}

const emptyCount = (): GradeCount => ({
  best: 0,
  closed: 0,
  good: 0,
  limited: 0,
});

/** Passes a rider would actually go out for: the two upper grades. */
const rideable = (c: GradeCount) => c.best + c.good;

/**
 * The grade of a destination in one half-month – **relative to the best that
 * base ever gets**, not to an absolute number of passes.
 *
 * This was an absolute count first (six rideable passes = "beste Zeit", three
 * = "gut") and the data says plainly that it does not work. Measured over all
 * 48 towns × 24 half-months:
 *
 *  - **47 of 48 towns cleared the top threshold in early September**, 45 of 48
 *    in late July. The top grade landed on 73 % of every non-winter cell, so
 *    from late June to early October the strip was a solid block for every
 *    sizeable base and could not be read at all.
 *  - The median base reaches 26 passes and has 19–26 rideable at its peak –
 *    four times the threshold. No absolute number works for both that and
 *    Bédoin, which reaches two.
 *
 * The deeper problem is that an absolute count makes the strip encode two
 * different things at once: how *big* a base is, and when it is at its *best*.
 * A 24-cell strip is a seasonal instrument – its question is "when should I
 * come here" – so it must answer only the second. Bédoin under the absolute
 * rule was a flat dim line all year; relative it shows what is actually true
 * of Mont Ventoux: a long spring, a hole in high summer where the heat makes
 * it punishing, and a second peak in September.
 *
 * "How much is there" is not lost – it is simply said in words rather than in
 * colour, right next to the strip, by `destinationText` and the grade bar:
 * "Von 33 Pässen im Umkreis: 12 zur besten Zeit, 11 gut, 10 eingeschränkt."
 * The same split as the reach bands: the picture carries the shape, the
 * sentence carries the magnitude, and neither has to do the other's job.
 *
 * The two shares are editorial like every other number here, and documented
 * in the scales dialog and docs/scales.md. They are set where every base
 * still gets a named best window: at 0,8 five of the 48 towns – Bormio among
 * them – peaked in a single half-month and `bestRun` found no run of two, so
 * the panel's "beste Zeit X – Y" line simply vanished for them. At 0,75 all
 * 48 keep one, with a median length of three half-months, and the grade split
 * barely moves. The bottom line stays absolute, because "nothing at all to
 * ride" is not relative to anything.
 */
export const RIDEABLE_BEST_SHARE = 0.75;
export const RIDEABLE_GOOD_SHARE = 0.45;

export const gradeOfBase = (c: GradeCount, peak: number): Grade => {
  const n = rideable(c);
  if (n === 0 || peak === 0) return "closed";
  if (n >= peak * RIDEABLE_BEST_SHARE) return "best";
  if (n >= peak * RIDEABLE_GOOD_SHARE) return "good";
  return "limited";
};

/** One reachable pass, with everything the panel ranks and groups it by. */
export interface ReachedPass {
  pass: Pass;
  km: number;
  band: ReachBand;
  /** The pass's own status in the chosen half-month. */
  status: Status;
  grade: Grade;
  /** The pass's 24 cells, for the strip in the row. */
  season: YearCell[];
  /** What the list is ordered by; never shown. */
  score: number;
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

const scoreOf = (pass: Pass, grade: Grade, km: number) =>
  GRADE_SCORE[grade] * (pass.beauty + pass.fame / 2) * (0.35 + reachWeight(km));

export interface Destination {
  /** The 24 derived cells, for a `SeasonStrip`. */
  year: Year;
  /** The grade counts of the chosen half-month. */
  counts: GradeCount;
  /** How many passes are reachable at all – the denominator of everything above. */
  total: number;
  /** Rideable passes in this base's best half-month; what the strip is graded against. */
  peak: number;
  /** Reachable passes, best first. */
  passes: ReachedPass[];
  /** The same, grouped by band in `REACH_BANDS` order; empty bands are dropped. */
  bands: { band: ReachBand; label: string; passes: ReachedPass[] }[];
}

/**
 * A derived cell. It carries no reasons of its own: a reason belongs to one
 * road's weather, and "die Pässe im Umkreis" is not one road. The count is
 * what explains this cell, and the count is shown next to it.
 */
const cellOf = (counts: GradeCount, peak: number): YearCell => {
  const grade = gradeOfBase(counts, peak);
  return { grade, reasons: [], snowy: false, status: statusOf(grade) };
};

/**
 * The longest run of half-months at "beste Zeit", as `passYear` computes it
 * for a pass – so the destination panel can say "beste Zeit Mitte Juni bis
 * Anfang September" in the same words the pass panel does.
 */
const bestRun = (cells: YearCell[]): [Period, Period] | null => {
  let run: [number, number] | null = null;
  let start: number | null = null;
  for (let i = 0; i <= cells.length; i += 1) {
    const good = i < cells.length && cells[i]!.grade === "best";
    if (good && start === null) start = i;
    if (!good && start !== null) {
      const len = i - start;
      if (len >= 2 && (!run || len > run[1] - run[0] + 1)) run = [start, i - 1];
      start = null;
    }
  }
  return run ? [PERIODS[run[0]]!, PERIODS[run[1]]!] : null;
};

/**
 * Everything the destination panel shows, for one point on the map and one
 * half-month. Pure: it reads the precomputed years and the passes it is
 * handed and measures nothing but distance.
 */
export const destinationAt = (
  at: LatLon,
  passes: readonly Pass[],
  years: Years,
  period: Period,
  /** A town does not count itself; a pass panel excludes its own road. */
  exclude?: string,
): Destination => {
  const reached: ReachedPass[] = [];
  const perPeriod = PERIODS.map(emptyCount);
  for (const pass of passes) {
    if (pass.slug === exclude) continue;
    const km = haversine(at, pass);
    const band = reachBand(km);
    if (band === null) continue;
    const year = years.passes[pass.slug];
    if (!year) continue;
    for (const [i, cell] of year.cells.entries())
      perPeriod[i]![cell.grade] += 1;
    const cell = cellAt(year, period);
    reached.push({
      band,
      grade: cell.grade,
      km,
      pass,
      score: scoreOf(pass, cell.grade, km),
      season: year.cells,
      status: cell.status,
    });
  }
  reached.sort((a, b) => b.score - a.score);
  // The whole year is graded against the best half-month this base has, so
  // the strip shows its season rather than its size (see `gradeOfBase`).
  const peak = Math.max(0, ...perPeriod.map(rideable));
  const cells = perPeriod.map((c) => cellOf(c, peak));
  const counts = perPeriod[periodIndex(period)] ?? emptyCount();
  return {
    bands: REACH_BANDS.map((b) => ({
      band: b.key,
      label: b.label,
      passes: reached.filter((r) => r.band === b.key),
    })).filter((g) => g.passes.length > 0),
    counts,
    passes: reached,
    peak,
    total: reached.length,
    year: { best: bestRun(cells), cells },
  };
};

/**
 * The sentence under a destination's badge. It names the count, because the
 * count is what the grade was made of – the badge says "beste Zeit" and this
 * says why that is so, in the same breath.
 */
export const destinationText = (d: Destination): string => {
  const n = rideable(d.counts);
  if (d.total === 0) return `Kein Pass im Umkreis von ${REACH_MAX_KM} km.`;
  if (n === 0)
    return `Keiner der ${d.total} Pässe im Umkreis ist in diesem Halbmonat gut befahrbar.`;
  const parts = [
    d.counts.best > 0 && `${d.counts.best} zur besten Zeit`,
    d.counts.good > 0 && `${d.counts.good} gut`,
    d.counts.limited > 0 && `${d.counts.limited} eingeschränkt`,
    d.counts.closed > 0 && `${d.counts.closed} oft gesperrt`,
  ].filter((x): x is string => typeof x === "string");
  return `Von ${d.total} Pässen im Umkreis: ${parts.join(", ")}.`;
};

/** One town within reach, with what it would be worth as a base. */
export interface ReachedTown {
  town: Town;
  km: number;
  band: ReachBand;
  /** How many passes are rideable from there in this half-month. */
  rideable: number;
  /** How many it reaches at all – the denominator of the line above. */
  total: number;
  score: number;
}

/**
 * The inverse of `destinationAt`: not "what can I ride from this town" but
 * "where would I stay to ride this road".
 *
 * A pass panel used to answer that with the same flat list of names and
 * distances the town panel had, which is the weaker half of the same mistake:
 * the nearest village is not automatically the best base, and the one thing a
 * planner wants to know about a candidate – what *else* it puts within reach –
 * was nowhere on the screen. So each town carries its own rideable count,
 * which is `destinationAt`'s arithmetic run from the town rather than from
 * here, and the ranking multiplies that by the same smooth nearness weight.
 *
 * The two panels are therefore one idea seen from both ends, and they share
 * every constant: the bands, the weight and the reach.
 */
export interface Bases {
  bands: { band: ReachBand; label: string; towns: ReachedTown[] }[];
  total: number;
}

export const basesFor = (
  at: LatLon,
  towns: readonly Town[],
  passes: readonly Pass[],
  years: Years,
  period: Period,
  /** A town panel does not offer itself as a base. */
  exclude?: string,
): Bases => {
  const reached: ReachedTown[] = [];
  for (const town of towns) {
    if (town.slug === exclude) continue;
    const km = haversine(at, town);
    const band = reachBand(km);
    if (band === null) continue;
    const own = destinationAt(town, passes, years, period);
    const n = rideable(own.counts);
    reached.push({
      band,
      km,
      rideable: n,
      score: (0.35 + reachWeight(km)) * (1 + n),
      total: own.total,
      town,
    });
  }
  reached.sort((a, b) => b.score - a.score);
  return {
    bands: REACH_BANDS.map((b) => ({
      band: b.key,
      label: b.label,
      towns: reached.filter((r) => r.band === b.key),
    })).filter((g) => g.towns.length > 0),
    total: reached.length,
  };
};
