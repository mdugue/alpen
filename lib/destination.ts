import { bounds, haversine, paddedHull, REACH_MAX_KM } from "@/lib/geo";
import type { Bounds, Ring } from "@/lib/geo";
import type { Messages } from "@/lib/i18n";
import { fill } from "@/lib/i18n/fill";
import { PERIODS, periodIndex } from "@/lib/period";
import { emptyCount, inBands, reachCounts, rideable } from "@/lib/reach";
import type { Band, GradeCount, ReachedPass, ReachedTown } from "@/lib/reach";
import { cellAt, GRADE_ORDER, statusOf, windowOf } from "@/lib/status";
import type { Grade, PassIndex, Year, YearCell, Years } from "@/lib/status";
import type {
  Destination,
  LatLon,
  Pass,
  Period,
  Tour,
  Town,
} from "@/lib/types";
import { fmt } from "@/lib/utils";

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
 * Nothing here measures anything new, and since plan 31 nothing here measures
 * anything at all: what is within reach of a point is `lib/reach.ts`, and this
 * module only judges what that hands it. A town has no climate series and no
 * season of its own; what it has is the passes it reaches, and every one of
 * those was already graded for all 24 half-months by `getYears`. A
 * destination's year is therefore *derived*, and it says so wherever it shows
 * (Principle 3): the strip is labelled "abgeleitet aus den Pässen im
 * Umkreis", and the passes it was derived from stay listed underneath with
 * their own strips.
 */

/**
 * The grade of a destination in one half-month – **relative to the best that
 * base ever gets**, not to an absolute number of passes.
 *
 * This was an absolute count first (six rideable passes = "beste Zeit", three
 * = "gut") and the data says plainly that it does not work. Measured over the
 * 48 towns there were then, × 24 half-months:
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
 * colour, right next to the strip, by `baseText` and the grade bar:
 * "Von 33 Pässen im Umkreis: 12 zur besten Zeit, 11 gut, 10 eingeschränkt."
 * The same split as the reach bands: the picture carries the shape, the
 * sentence carries the magnitude, and neither has to do the other's job.
 *
 * The two shares are editorial like every other number here, and documented
 * in the scales dialog and docs/scales.md. They are set where every base
 * still gets a named best window: at 0,8 five of the 48 towns – Bormio among
 * them – peaked in a single half-month and no run of two was found
 * (`windowOf`), so the panel's "beste Zeit X – Y" line simply vanished for
 * them. At 0,75 all 48 keep one, with a median length of three half-months,
 * and the grade split barely moves. The bottom line stays absolute, because "nothing at all to
 * ride" is not relative to anything.
 */
export const RIDEABLE_BEST_SHARE = 0.75;
export const RIDEABLE_GOOD_SHARE = 0.45;

/**
 * The two shares as an argument, so that asking what another pair would do to
 * the strip – or what the absolute rule did, which is the same comparison
 * against a fixed reference instead of the base's own peak – is one call in
 * `scripts/analyze-destinations.ts` rather than the ladder written out again.
 */
export interface GradeShares {
  best: number;
  good: number;
}

const SHARES: GradeShares = {
  best: RIDEABLE_BEST_SHARE,
  good: RIDEABLE_GOOD_SHARE,
};

export const gradeOfBase = (
  c: GradeCount,
  peak: number,
  shares: GradeShares = SHARES,
): Grade => {
  const n = rideable(c);
  if (n === 0 || peak === 0) return "closed";
  if (n >= peak * shares.best) return "best";
  if (n >= peak * shares.good) return "good";
  return "limited";
};

/**
 * A year derived from counts rather than read from a series – a base's or an
 * area's (`deriveYear`).
 */
export interface DerivedVerdict {
  /** The 24 derived cells, for a `SeasonStrip`. */
  year: Year;
  /** The grade counts of the chosen half-month. */
  counts: GradeCount;
  /** How many roads were counted at all – the denominator of everything above. */
  total: number;
  /** Rideable roads in the best half-month; what the strip is graded against. */
  peak: number;
}

export interface BaseVerdict extends DerivedVerdict {
  /** Reachable passes, best first. */
  passes: ReachedPass[];
  /** The same, grouped by band in `REACH_BANDS` order; empty bands are dropped. */
  bands: Band<ReachedPass>[];
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
 * The year of per-half-month counts: every cell graded against the best
 * half-month, so the strip shows the season rather than the size (see
 * `gradeOfBase`), and the best window read off the cells by the rule a road's
 * is read by (`windowOf`) – so the panel says "beste Zeit Mitte Juni bis
 * Anfang September" in the same words for a base, an area and a pass.
 */
const deriveYear = (
  perPeriod: readonly GradeCount[],
  total: number,
  period: Period,
): DerivedVerdict => {
  const peak = Math.max(0, ...perPeriod.map(rideable));
  const cells = perPeriod.map((c) => cellOf(c, peak));
  return {
    counts: perPeriod[periodIndex(period)] ?? emptyCount(),
    peak,
    total,
    year: { best: windowOf(cells.map((c) => c.grade === "best")), cells },
  };
};

/**
 * The judgement over passes already measured – what the panel model uses, so
 * the block above the list and the list itself come out of one reach.
 */
export const baseOf = (
  reached: ReachedPass[],
  period: Period,
): BaseVerdict => ({
  ...deriveYear(reachCounts(reached), reached.length, period),
  bands: inBands(reached),
  passes: reached,
});

/**
 * The sentence under a destination's badge. It names the count, because the
 * count is what the grade was made of – the badge says "beste Zeit" and this
 * says why that is so, in the same breath.
 */
export const baseText = (d: BaseVerdict, w: Messages): string => {
  const say = w.vocab.reach;
  if (d.total === 0) return fill(say.noneWithin, { km: REACH_MAX_KM });
  if (rideable(d.counts) === 0)
    return fill(say.noneRideable, { total: d.total });
  const parts = GRADE_ORDER.filter((g) => d.counts[g] > 0).map((g) =>
    fill(say.count[g], { n: d.counts[g] }),
  );
  return fill(say.ofTotal, { parts: parts.join(", "), total: d.total });
};

/**
 * The inverse of `baseOf`: not "what can I ride from this town" but
 * "where would I stay to ride this road".
 *
 * A pass panel used to answer that with the same flat list of names and
 * distances the town panel had, which is the weaker half of the same mistake:
 * the nearest village is not automatically the best base, and the one thing a
 * planner wants to know about a candidate – what *else* it puts within reach –
 * was nowhere on the screen. So each town carries its own rideable count, and
 * the ranking multiplies that by the same smooth nearness weight
 * (`reachedTowns`, lib/reach.ts).
 *
 * The two panels are therefore one idea seen from both ends, and they share
 * every constant: the bands, the weight and the reach.
 */
export interface Bases {
  bands: Band<ReachedTown>[];
  total: number;
}

export const basesOf = (reached: ReachedTown[]): Bases => ({
  bands: inBands(reached),
  total: reached.length,
});

// ── Destinations as curated areas (plan 12) ──────────────────────────────────

/**
 * What lies inside a curated area, derived once at prerender: every road
 * within `radiusKm` of the centre plus `include` minus `exclude`, every town
 * within the radius plus the bases named, every loop with a waypoint inside
 * the radius, the outline the map draws it with and the box around that
 * outline – what selecting the area frames, so the camera shows all of what
 * lights up. Nothing here is written to a file: a road added to `passes.json`
 * joins its area by itself, and a changed radius moves the membership with it
 * (`docs/destinations.md`).
 */
export interface DestinationMembers {
  passes: string[];
  tours: string[];
  towns: string[];
  bounds: Bounds;
  /**
   * The area as the map draws it: the padded hull of its centre, its summits
   * and its towns (`paddedHull`). The radius decides who is a member; the
   * outline is what the members cover, which a disc of the radius never
   * showed – half of one was valley floor or the next range. The ascents'
   * valley ends stay out of it: they would pull every area down its valleys
   * into the next one's, and the lines of the roads say where they start.
   */
  outline: Ring;
}

/** How far the outline reaches past the summits and towns it is drawn around, in km. */
const OUTLINE_PADDING_KM = 5;

/** Whether a point lies within the area's radius. */
export const insideOf = (d: Destination, p: LatLon): boolean =>
  haversine(d.center, p) <= d.radiusKm;

/**
 * Whether a road belongs to the area: within the radius or on the `include`
 * list, and not on the `exclude` list. The one spelling of the rule –
 * `data:check` reads it too, so a road it calls standalone is one the page
 * lists in no area.
 */
export const isMember = (d: Destination, p: Pass): boolean =>
  (insideOf(d, p) || d.include.includes(p.slug)) && !d.exclude.includes(p.slug);

export const membersOf = (
  d: Destination,
  passes: readonly Pass[],
  tours: readonly Tour[],
  towns: readonly Town[],
): DestinationMembers => {
  const inside = (p: LatLon) => insideOf(d, p);
  const own = passes.filter((p) => isMember(d, p));
  const ownTowns = towns.filter(
    (t) => inside(t) || d.baseTowns.includes(t.slug),
  );
  const ownTours = tours.filter((t) => t.waypoints.some(inside));
  const outline = paddedHull(
    [d.center, ...own, ...ownTowns],
    OUTLINE_PADDING_KM,
  );
  return {
    bounds: bounds(outline.map(([lon, lat]) => [lat, lon])),
    outline,
    passes: own.map((p) => p.slug),
    tours: ownTours.map((t) => t.slug),
    towns: ownTowns.map((t) => t.slug),
  };
};

/**
 * The areas a town belongs to: those that name it as a base first, then those
 * it merely lies in, each group by the distance to the area's centre. Lugano
 * is a base of the Ticino and of Lake Como, and nearer the Ticino's centre.
 */
export const destinationsOfTown = (
  town: Town,
  destinations: readonly Destination[],
  members: Record<string, DestinationMembers>,
): Destination[] => {
  const isBase = (d: Destination) => d.baseTowns.includes(town.slug);
  return destinations
    .filter((d) => members[d.slug]?.towns.includes(town.slug))
    .toSorted(
      (a, b) =>
        Number(isBase(b)) - Number(isBase(a)) ||
        haversine(town, a.center) - haversine(town, b.center),
    );
};

/**
 * Where the list of areas holds a town: under every area that names it as a
 * base, or – when none does – under the first one it lies in. Lugano is
 * listed under both of its areas; Canazei, no area's base, once, under the
 * Alta Badia, whose centre is the nearest.
 */
export const homeAreasOf = (
  town: Town,
  destinations: readonly Destination[],
  members: Record<string, DestinationMembers>,
): Destination[] =>
  destinationsOfTown(town, destinations, members).filter(
    (d, i) => i === 0 || d.baseTowns.includes(town.slug),
  );

/**
 * How much great riding an area holds in one half-month: the beauty of its
 * open roads, plus two fifths of the beauty of its limited ones. Editorial
 * like every number here (the scales dialog says so) – it ranks the list of
 * areas for the chosen half-month and is never shown as a value, the way the
 * reach weight is not. A closed road counts nothing: a holiday is not booked
 * for a road that is shut.
 */
export const RISKY_WEIGHT = 0.4;

export const areaScore = (
  memberSlugs: readonly string[],
  passes: PassIndex,
  years: Years,
  period: Period,
): number => {
  let score = 0;
  for (const slug of memberSlugs) {
    const pass = passes.get(slug);
    const year = years.passes[slug];
    if (!pass || !year) continue;
    const { status } = cellAt(year, period);
    if (status === "open") score += pass.beauty;
    else if (status === "risky") score += RISKY_WEIGHT * pass.beauty;
  }
  return score;
};

/**
 * The verdict of an area, derived the way a base's is (`deriveYear`): the
 * counts of its member roads per half-month, graded against the area's own
 * best half-month. No reach here – the members are what the curator drew the
 * circle around, not what lies within a band of one point.
 */
export const areaVerdict = (
  memberSlugs: readonly string[],
  years: Years,
  period: Period,
): DerivedVerdict => {
  const perPeriod = PERIODS.map(emptyCount);
  let total = 0;
  for (const slug of memberSlugs) {
    const year = years.passes[slug];
    if (!year) continue;
    total += 1;
    for (const [i, cell] of year.cells.entries())
      perPeriod[i]![cell.grade] += 1;
  }
  return deriveYear(perPeriod, total, period);
};

/** "7 von 9 Straßen gut" – the row's one line, and the compare sheet's. */
export const areaText = (v: DerivedVerdict, w: Messages): string =>
  v.total === 0
    ? w.vocab.reach.areaNone
    : fill(w.vocab.reach.areaLine, {
        rideable: fmt(rideable(v.counts), 0, w.lang),
        total: fmt(v.total, 0, w.lang),
      });
