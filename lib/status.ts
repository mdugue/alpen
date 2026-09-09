import { clockTime, dayLength, periodDate, sunTimes } from "@/lib/daylight";
import type {
  ClimateBucket,
  ClimateYear,
  Pass,
  Period,
  Status,
  Tour,
} from "@/lib/types";

export const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

/** Month initials for compact scales (J F M A M J J A S O N D). */
export const MONTH_INITIALS = MONTHS.map((m) => m[0]!);

/** "Anfang Oktober" / "Ende Oktober" (early/late October) for a Period. */
export const periodLabel = (t: Period): string =>
  `${t % 1 ? "Ende" : "Anfang"} ${MONTHS[Math.floor(t) - 1]}`;

/** All 24 half-month points in time. */
export const PERIODS: Period[] = Array.from(
  { length: 24 },
  (_, i) => Math.floor(i / 2) + 1 + (i % 2 ? 0.5 : 0),
);

/** Index into a ClimateYear series. */
export const periodIndex = (t: Period): number =>
  (Math.floor(t) - 1) * 2 + (t % 1 ? 1 : 0);

/** The Period for an index into a ClimateYear series; wraps around the year. */
export const periodAt = (index: number): Period =>
  PERIODS[((index % 24) + 24) % 24]!;

/** Guard for values coming from the hash or from localStorage. */
export const isPeriod = (value: unknown): value is Period =>
  typeof value === "number" && PERIODS.includes(value);

/**
 * The half-month the calendar is in. Computed on the server in Europe/Berlin
 * so the first paint already shows the period the visitor asked about by
 * arriving today; half-month buckets make a one-day timezone offset
 * irrelevant (see docs/data-model.md, "Time reckoning").
 */
export const todayPeriod = (
  now: Date = new Date(),
  timeZone = "Europe/Berlin",
): Period => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "numeric",
    timeZone,
  }).formatToParts(now);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return part("month") + (part("day") <= 15 ? 0 : 0.5);
};

/**
 * The three-valued status is the vocabulary of the filter, the hash, the map
 * and the dot. Its labels answer "how good is it to ride there", not "is the
 * road open": a July cell whose problem is heat is not "meist offen".
 */
export const STATUS_LABEL: Record<Status, string> = {
  closed: "oft gesperrt",
  open: "gut",
  risky: "eingeschränkt",
};

/**
 * The display scale of the strip and the histogram: `open` split into the
 * pass's best window and the rest. Not data, so not in lib/schema.ts – the
 * map, the filter and the hash stay three-valued (docs/plans/13-summer-axis.md).
 */
export type Grade = "best" | "good" | "limited" | "closed";

export const GRADE_LABEL: Record<Grade, string> = {
  best: "beste Zeit",
  closed: "oft gesperrt",
  good: "gut",
  limited: "eingeschränkt",
};

/** Worse is lower; a tour cell is the minimum over its passes. */
export const GRADE_RANK: Record<Grade, number> = {
  best: 3,
  closed: 0,
  good: 2,
  limited: 1,
};

export const gradeOf = (status: Status, inBest: boolean): Grade =>
  status === "closed"
    ? "closed"
    : status === "risky"
      ? "limited"
      : inBest
        ? "best"
        : "good";

/** The status a grade belongs to; the map and the dot read this. */
export const statusOf = (grade: Grade): Status =>
  grade === "closed" ? "closed" : grade === "limited" ? "risky" : "open";

/**
 * Why a verdict came out the way it did. Every signal can only lower a cell,
 * never lift it; the one named on the cell is the first in `REASON_ORDER`.
 */
export type StatusReason =
  | "outside-window"
  | "window-edge"
  | "snow"
  | "frost"
  | "altitude"
  | "heat"
  | "wet"
  | "short-day"
  | "cold-descent";

/**
 * The ladder: a closure beats everything, then what the winter signals say,
 * then the summer axis. The first reason that fired is the word the cell
 * carries; docs/scales.md shows the order.
 */
export const REASON_ORDER: StatusReason[] = [
  "outside-window",
  "window-edge",
  "snow",
  "frost",
  "altitude",
  "heat",
  "wet",
  "short-day",
  "cold-descent",
];

/** The one word the badge and the strip carry for a limited cell. */
export const REASON_WORD: Record<StatusReason, string> = {
  altitude: "Höhe",
  "cold-descent": "kalte Abfahrt",
  frost: "Frost",
  heat: "Hitze",
  "outside-window": "gesperrt",
  "short-day": "kurze Tage",
  snow: "Schnee",
  wet: "nass",
  "window-edge": "Randzeit",
};

export interface StatusVerdict {
  status: Status;
  /** Every reason that fired, in ladder order; `reasons[0]` is the label. */
  reasons: StatusReason[];
}

/** What a verdict reads besides the pass itself. */
export interface VerdictInput {
  bucket?: ClimateBucket | null;
  /** Lowest ascent start in m (from profiles.json); no value = no heat signal. */
  valley?: number | null;
}

/** The signals of one pass for all 24 half-months. */
export interface PassSignals {
  climate?: ClimateYear | null;
  valley?: number | null;
}

/** The signals of every pass, keyed by slug – what the page hands the client. */
export interface Signals {
  climate?: Record<string, ClimateYear>;
  valleys?: Record<string, number>;
}

export const signalsOf = (
  s: Signals | undefined,
  slug: string,
): PassSignals => ({
  climate: s?.climate?.[slug] ?? null,
  valley: s?.valleys?.[slug] ?? null,
});

/** The input of one half-month out of a pass's signals. */
export const inputAt = (
  s: PassSignals | null | undefined,
  t: Period,
): VerdictInput => ({
  bucket: s?.climate?.[periodIndex(t)] ?? null,
  valley: s?.valley ?? null,
});

/**
 * Thresholds, calibrated on the ERA5 series of all 92 passes; see
 * docs/plans/04-climate-aware-status.md (snow, frost) and
 * docs/plans/13-summer-axis.md (heat, wet, short days, cold descent) for the
 * distribution tables they come from, and `scripts/analyze-status.ts` to
 * re-run them after a change.
 */
export const SNOW_RISKY_PCT = 20;
export const FROST_RISKY_PCT = 80;
/** "Beste Zeit" only counts half-months that are quieter than this. */
export const SNOW_BEST_PCT = 10;
/** Mean daily maximum in the valley, derived from the summit value. */
export const HEAT_VALLEY_TMAX = 26;
/** Share of days with ≥ 1 mm: two rain days in three. */
export const WET_LIMITED_PCT = 70;
/** Hours from sunrise to sunset; late October onward in the Alps. */
export const SHORT_DAY_HOURS = 10.75;
/** Mean daily maximum at the summit: the warmest moment of the descent. */
export const COLD_DESCENT_TMAX = 8;
/** Standard-atmosphere lapse rate in °C per m. */
export const LAPSE_RATE = 0.0065;

/** ≈ 15 days per half-month, so a percentage is readable as "x of 15 days". */
export const daysOf = (pct: number) => Math.round((pct / 100) * 15);

/**
 * The valley's mean daily maximum, derived from the summit series with the
 * standard atmosphere down to the lowest ascent start. A model, not a
 * measurement (± 3 °C, low-biased for the highest passes) – say "abgeleitet"
 * wherever it shows. null without a profile.
 */
export const valleyTmax = (
  pass: Pass,
  bucket: ClimateBucket,
  valley: number | null | undefined,
): number | null =>
  valley === null || valley === undefined
    ? null
    : bucket.tmax + LAPSE_RATE * (pass.elevation - valley);

/** Opening window, altitude and calendar – the reasons the heuristic knew before the climate series. */
const baseReasons = (pass: Pass, t: Period): StatusReason[] => {
  const s = pass.season;
  if (!s) {
    if (pass.elevation >= 2300 && (t >= 10 || t < 5.5)) return ["altitude"];
    if (pass.elevation >= 1800 && (t >= 11 || t < 4.5)) return ["altitude"];
    if (t >= 12 || t < 3) return ["altitude"];
    return [];
  }
  if (t < s.opens || t >= s.closes) return ["outside-window"];
  if (t < s.opens + 0.5 || t >= s.closes - 0.5) return ["window-edge"];
  if (!s.maintained) {
    if (pass.elevation >= 2300 && (t >= 10 || t < 6.5)) return ["altitude"];
    if (pass.elevation >= 1800 && (t >= 10.5 || t < 6)) return ["altitude"];
  }
  return [];
};

const byLadder = (a: StatusReason, b: StatusReason) =>
  REASON_ORDER.indexOf(a) - REASON_ORDER.indexOf(b);

/**
 * Rideability heuristic: opening window, pass altitude, season, the pass's
 * own climate series and the daylight of the half-month. Every signal is
 * judged on its own and can only lower the cell: any reason at all makes it
 * "eingeschränkt", the first in ladder order is the one named. Only the
 * opening window produces "oft gesperrt" – snowfall, heat or short days are
 * not closures, a road stays open through them.
 *
 * Does not replace official closure information – see docs/roadmap.md ("Live-Status").
 */
export const passVerdict = (
  pass: Pass,
  t: Period,
  input?: VerdictInput | null,
): StatusVerdict => {
  const reasons = baseReasons(pass, t);
  if (reasons.includes("outside-window"))
    return { reasons: ["outside-window"], status: "closed" };
  const b = input?.bucket;
  if (b) {
    if (b.snowPct >= SNOW_RISKY_PCT) reasons.push("snow");
    if (b.frostPct >= FROST_RISKY_PCT) reasons.push("frost");
    const valley = valleyTmax(pass, b, input?.valley);
    if (valley !== null && valley >= HEAT_VALLEY_TMAX) reasons.push("heat");
    if (b.wetPct >= WET_LIMITED_PCT) reasons.push("wet");
    if (b.tmax < COLD_DESCENT_TMAX) reasons.push("cold-descent");
  }
  if (dayLength(pass.lat, t) < SHORT_DAY_HOURS) reasons.push("short-day");
  reasons.sort(byLadder);
  return { reasons, status: reasons.length ? "risky" : "open" };
};

export const passStatus = (
  pass: Pass,
  t: Period,
  input?: VerdictInput | null,
): Status => passVerdict(pass, t, input).status;

interface ReasonContext {
  pass: Pass;
  t: Period;
  bucket?: ClimateBucket | null;
  valley?: number | null;
}

const de = (n: number, digits = 0) =>
  n.toLocaleString("de-DE", { maximumFractionDigits: digits });

/**
 * One German sentence per reason – the honesty principle made visible. Every
 * sentence names its number and where it comes from: a share of days from a
 * ten-year average, a derived valley value, an astronomical day length.
 */
export const REASON_TEXT: Record<StatusReason, (ctx: ReasonContext) => string> =
  {
    altitude: ({ pass, t }) =>
      `${periodLabel(t)} ist auf ${de(pass.elevation)} m Grenzbereich: Schnee und Eis sind möglich, auch wenn die Straße offen ist.`,
    "cold-descent": ({ bucket }) =>
      `Am Gipfel im Schnitt höchstens ${de(bucket?.tmax ?? 0)} °C (ERA5-Land 2015–2024) – mit Fahrtwind ist die Abfahrt eine um den Gefrierpunkt.`,
    frost: ({ bucket }) =>
      `Frost in ${bucket?.frostPct ?? 0} % der Nächte (≈ ${daysOf(bucket?.frostPct ?? 0)} von 15, ERA5-Land 2015–2024) – nasse Straßen können überfrieren, die Abfahrt wird kalt.`,
    heat: ({ pass, bucket, valley }) =>
      `Im Tal um ${de(bucket ? (valleyTmax(pass, bucket, valley) ?? 0) : 0)} °C am Nachmittag (aus dem Gipfelwert abgeleitet, ± 3 °C) – ab dem späten Vormittag nur noch oben angenehm.`,
    "outside-window": ({ pass }) =>
      pass.season
        ? `Außerhalb des typischen Öffnungsfensters (${periodLabel(pass.season.opens)} bis ${periodLabel(pass.season.closes)}).`
        : "Außerhalb der typischen Saison.",
    "short-day": ({ pass, t }) => {
      const sun = sunTimes(pass.lat, pass.lon, periodDate(t));
      return `Nur ${de(sun.dayLength, 1)} Stunden Tageslicht, Sonnenuntergang gegen ${clockTime(sun.sunset)} – für eine lange Runde wird es knapp.`;
    },
    snow: ({ bucket }) =>
      `Schneefall an ${bucket?.snowPct ?? 0} % der Tage (≈ ${daysOf(bucket?.snowPct ?? 0)} von 15, ERA5-Land 2015–2024) – meist bleibt die Straße befahrbar, planbar ist der Zeitraum aber nicht.`,
    wet: ({ bucket }) =>
      `Regen an ${bucket?.wetPct ?? 0} % der Tage (≈ ${daysOf(bucket?.wetPct ?? 0)} von 15, ERA5-Land 2015–2024) – Staulage; ein trockenes Fenster ist Glückssache.`,
    "window-edge": ({ pass }) =>
      `Am Rand des Öffnungsfensters${
        pass.season
          ? ` (${periodLabel(pass.season.opens)} bis ${periodLabel(pass.season.closes)})`
          : ""
      } – Öffnung und Sperrung verschieben sich je nach Winter um Wochen.`,
  };

/** The sentences behind a verdict, most important first. */
export const verdictReasons = (
  pass: Pass,
  t: Period,
  input?: VerdictInput | null,
): string[] =>
  passVerdict(pass, t, input).reasons.map((r) =>
    REASON_TEXT[r]({
      bucket: input?.bucket,
      pass,
      t,
      valley: input?.valley,
    }),
  );

export const seasonText = (pass: Pass): string => {
  const s = pass.season;
  if (!s)
    return "Ganzjährig befahrbar (Winterräumung); Schnee und Kälte je nach Höhe.";
  return `Typisch offen ${periodLabel(s.opens)} bis ${periodLabel(s.closes)}${
    s.maintained ? " (bewirtschaftete Mautstraße, wird geräumt)" : ""
  }.`;
};

export type PassIndex = Map<string, Pass>;

export const indexBySlug = (passes: Pass[]): PassIndex =>
  new Map(passes.map((p) => [p.slug, p]));

/** The climate bucket of one pass for one half-month, if a series exists. */
export const climateBucket = (
  climate: Record<string, ClimateYear> | undefined,
  slug: string,
  t: Period,
): ClimateBucket | null => climate?.[slug]?.[periodIndex(t)] ?? null;

const tourPasses = (tour: Tour, passes: PassIndex): Pass[] =>
  tour.passes
    .map((slug) => passes.get(slug))
    .filter((p): p is Pass => Boolean(p));

/** A tour is only as rideable as its worst pass. */
export const tourStatus = (
  tour: Tour,
  passes: PassIndex,
  t: Period,
  signals?: Signals,
): Status => {
  const list = new Set(
    tourPasses(tour, passes).map((p) =>
      passStatus(p, t, inputAt(signalsOf(signals, p.slug), t)),
    ),
  );
  if (list.has("closed")) return "closed";
  if (list.has("risky")) return "risky";
  return "open";
};

/** The 24 verdicts of one pass. */
export const passSeason = (
  pass: Pass,
  signals?: PassSignals | null,
): Status[] => PERIODS.map((t) => passStatus(pass, t, inputAt(signals, t)));

/** The 24 verdicts of one tour. */
export const tourSeason = (
  tour: Tour,
  passes: PassIndex,
  signals?: Signals,
): Status[] => PERIODS.map((t) => tourStatus(tour, passes, t, signals));

/** Longest run of `true` in a circular series of 24; null when there is none. */
const longestRun = (
  flags: boolean[],
): { start: number; length: number } | null => {
  const n = flags.length;
  if (flags.every(Boolean)) return { length: n, start: 0 };
  let best: { start: number; length: number } | null = null;
  let start = -1;
  let length = 0;
  for (let i = 0; i < 2 * n; i += 1) {
    if (flags[i % n]) {
      if (length === 0) start = i % n;
      length += 1;
      if (length <= n && (!best || length > best.length))
        best = { length, start };
    } else {
      length = 0;
    }
  }
  return best;
};

/**
 * Longest run of half-months that are "gut" and quiet in the climate series.
 * Returns the first and last half-month of that run, or null when it is
 * shorter than two half-months (nothing worth calling a best time). Since
 * every reason makes a cell "eingeschränkt", the run is free of heat, rain,
 * short days and cold descents by construction.
 */
export const bestPeriods = (
  pass: Pass,
  signals?: PassSignals | null,
): [Period, Period] | null => {
  const good = PERIODS.map(
    (t, i) =>
      passStatus(pass, t, inputAt(signals, t)) === "open" &&
      (signals?.climate?.[i]?.snowPct ?? 0) < SNOW_BEST_PCT,
  );
  const run = longestRun(good);
  if (!run || run.length < 2) return null;
  return [periodAt(run.start), periodAt(run.start + run.length - 1)];
};

/** Whether index `i` lies in the circular run from `from` to `to` (both inclusive). */
const inRange = (i: number, [from, to]: [Period, Period]): boolean => {
  const a = periodIndex(from);
  const b = periodIndex(to);
  return a <= b ? i >= a && i <= b : i >= a || i <= b;
};

/** The 24 grades of one pass, for the strip and the histogram. */
export const passGrades = (
  pass: Pass,
  signals?: PassSignals | null,
): Grade[] => {
  const best = bestPeriods(pass, signals);
  return passSeason(pass, signals).map((status, i) =>
    gradeOf(status, best !== null && inRange(i, best)),
  );
};

/** The 24 grades of one tour: per half-month the worst grade of its passes. */
export const tourGrades = (
  tour: Tour,
  passes: PassIndex,
  signals?: Signals,
): Grade[] => {
  const per = tourPasses(tour, passes).map((p) =>
    passGrades(p, signalsOf(signals, p.slug)),
  );
  return PERIODS.map((_, i) => {
    let worst: Grade = "best";
    for (const g of per)
      if (GRADE_RANK[g[i]!] < GRADE_RANK[worst]) worst = g[i]!;
    return worst;
  });
};

/**
 * One sentence for the 24 cells of a season strip, so screen readers get the
 * same overview the colours give: "beste Zeit Anfang Juli bis Ende September,
 * gut Anfang Juni bis Anfang Oktober, eingeschränkt bis Ende Oktober".
 */
export const seasonSummary = (grades: Grade[]): string => {
  const best = longestRun(grades.map((g) => g === "best"));
  const good = longestRun(grades.map((g) => g === "best" || g === "good"));
  const rideable = longestRun(grades.map((g) => g !== "closed"));
  if (!rideable) return "Saison: ganzjährig oft gesperrt.";
  const span = (run: { start: number; length: number }) =>
    run.length === grades.length
      ? "ganzjährig"
      : `${periodLabel(periodAt(run.start))} bis ${periodLabel(periodAt(run.start + run.length - 1))}`;
  if (!good)
    return `Saison: eingeschränkt ${span(rideable)}, sonst oft gesperrt.`;
  const parts: string[] = [];
  if (best) parts.push(`beste Zeit ${span(best)}`);
  if (!best || good.length > best.length) parts.push(`gut ${span(good)}`);
  if (rideable.length > good.length)
    parts.push(`eingeschränkt ${span(rideable)}`);
  return `Saison: ${parts.join(", ")}.`;
};
