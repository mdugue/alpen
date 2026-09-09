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

export const STATUS_LABEL: Record<Status, string> = {
  closed: "oft gesperrt",
  open: "meist offen",
  risky: "wetterabhängig",
};

/**
 * Why a verdict came out the way it did. The order is the order in which the
 * rules fire, and the first reason is the one worth showing on its own.
 */
export type StatusReason =
  | "outside-window"
  | "window-edge"
  | "altitude"
  | "snow"
  | "frost";

export interface StatusVerdict {
  status: Status;
  reasons: StatusReason[];
}

/**
 * Climate thresholds, calibrated on the ERA5 series of all 92 passes; see
 * docs/plans/04-climate-aware-status.md for the cohort table they come from.
 * The "meist offen" cohort sits at 7 % snow days, "wetterabhängig" at 25 %.
 */
export const SNOW_RISKY_PCT = 20;
export const FROST_RISKY_PCT = 80;
/** "Beste Zeit" only counts half-months that are quieter than this. */
export const SNOW_BEST_PCT = 10;

/** ≈ 15 days per half-month, so a percentage is readable as "x of 15 days". */
export const daysOf = (pct: number) => Math.round((pct / 100) * 15);

/** Opening window, altitude and calendar – the heuristic without the climate series. */
const baseVerdict = (pass: Pass, t: Period): StatusVerdict => {
  const s = pass.season;
  if (!s) {
    if (pass.elevation >= 2300 && (t >= 10 || t < 5.5))
      return { reasons: ["altitude"], status: "risky" };
    if (pass.elevation >= 1800 && (t >= 11 || t < 4.5))
      return { reasons: ["altitude"], status: "risky" };
    if (t >= 12 || t < 3) return { reasons: ["altitude"], status: "risky" };
    return { reasons: [], status: "open" };
  }
  if (t < s.opens || t >= s.closes)
    return { reasons: ["outside-window"], status: "closed" };
  if (t < s.opens + 0.5 || t >= s.closes - 0.5)
    return { reasons: ["window-edge"], status: "risky" };
  if (!s.maintained) {
    if (pass.elevation >= 2300 && (t >= 10 || t < 6.5))
      return { reasons: ["altitude"], status: "risky" };
    if (pass.elevation >= 1800 && (t >= 10.5 || t < 6))
      return { reasons: ["altitude"], status: "risky" };
  }
  return { reasons: [], status: "open" };
};

/**
 * Rideability heuristic: opening window, pass altitude, season – and the
 * pass's own climate series, which can turn "meist offen" into
 * "wetterabhängig" but never into "oft gesperrt". Snowfall is not a closure:
 * a road stays open through it, it just stops being reliable. What is closed
 * is what the opening window knows.
 *
 * Does not replace official closure information – see docs/roadmap.md ("Live-Status").
 */
export const passVerdict = (
  pass: Pass,
  t: Period,
  bucket?: ClimateBucket | null,
): StatusVerdict => {
  const verdict = baseVerdict(pass, t);
  if (verdict.status === "open" && bucket) {
    if (bucket.snowPct >= SNOW_RISKY_PCT)
      return { reasons: ["snow"], status: "risky" };
    if (bucket.frostPct >= FROST_RISKY_PCT)
      return { reasons: ["frost"], status: "risky" };
  }
  return verdict;
};

export const passStatus = (
  pass: Pass,
  t: Period,
  bucket?: ClimateBucket | null,
): Status => passVerdict(pass, t, bucket).status;

interface ReasonContext {
  pass: Pass;
  t: Period;
  bucket?: ClimateBucket | null;
}

const de = (n: number) => n.toLocaleString("de-DE");

/**
 * One German sentence per reason – the honesty principle made visible. Snow
 * and frost say what they are: a share of days from a ten-year average, not a
 * barrier.
 */
export const REASON_TEXT: Record<StatusReason, (ctx: ReasonContext) => string> =
  {
    altitude: ({ pass, t }) =>
      `${periodLabel(t)} ist auf ${de(pass.elevation)} m Grenzbereich: Schnee und Eis sind möglich, auch wenn die Straße offen ist.`,
    frost: ({ bucket }) =>
      `Frost in ${bucket?.frostPct ?? 0} % der Nächte (≈ ${daysOf(bucket?.frostPct ?? 0)} von 15, ERA5-Land 2015–2024) – nasse Straßen können überfrieren, die Abfahrt wird kalt.`,
    "outside-window": ({ pass }) =>
      pass.season
        ? `Außerhalb des typischen Öffnungsfensters (${periodLabel(pass.season.opens)} bis ${periodLabel(pass.season.closes)}).`
        : "Außerhalb der typischen Saison.",
    snow: ({ bucket }) =>
      `Schneefall an ${bucket?.snowPct ?? 0} % der Tage (≈ ${daysOf(bucket?.snowPct ?? 0)} von 15, ERA5-Land 2015–2024) – meist bleibt die Straße befahrbar, planbar ist der Zeitraum aber nicht.`,
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
  bucket?: ClimateBucket | null,
): string[] =>
  passVerdict(pass, t, bucket).reasons.map((r) =>
    REASON_TEXT[r]({ bucket, pass, t }),
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

/** A tour is only as rideable as its worst pass. */
export const tourStatus = (
  tour: Tour,
  passes: PassIndex,
  t: Period,
  climate?: Record<string, ClimateYear>,
): Status => {
  const list = new Set(
    tour.passes
      .map((slug) => passes.get(slug))
      .filter((p): p is Pass => Boolean(p))
      .map((p) => passStatus(p, t, climateBucket(climate, p.slug, t))),
  );
  if (list.has("closed")) return "closed";
  if (list.has("risky")) return "risky";
  return "open";
};

/** The 24 verdicts of one pass, for the season strip. */
export const passSeason = (
  pass: Pass,
  climate?: ClimateYear | null,
): Status[] => PERIODS.map((t, i) => passStatus(pass, t, climate?.[i] ?? null));

/** The 24 verdicts of one tour. */
export const tourSeason = (
  tour: Tour,
  passes: PassIndex,
  climate?: Record<string, ClimateYear>,
): Status[] => PERIODS.map((t) => tourStatus(tour, passes, t, climate));

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
 * Longest run of half-months that are "meist offen" and quiet in the climate
 * series. Returns the first and last half-month of that run, or null when it
 * is shorter than two half-months (nothing worth calling a best time).
 */
export const bestPeriods = (
  pass: Pass,
  climate?: ClimateYear | null,
): [Period, Period] | null => {
  const good = PERIODS.map(
    (t, i) =>
      passStatus(pass, t, climate?.[i] ?? null) === "open" &&
      (climate?.[i]?.snowPct ?? 0) < SNOW_BEST_PCT,
  );
  const run = longestRun(good);
  if (!run || run.length < 2) return null;
  return [periodAt(run.start), periodAt(run.start + run.length - 1)];
};

/**
 * One sentence for the 24 cells of a season strip, so screen readers get the
 * same overview the colours give: "meist offen Anfang Juni bis Ende
 * September, wetterabhängig bis Ende Oktober".
 */
export const seasonSummary = (statuses: Status[]): string => {
  const open = longestRun(statuses.map((s) => s === "open"));
  const rideable = longestRun(statuses.map((s) => s !== "closed"));
  if (!rideable) return "Saison: ganzjährig oft gesperrt.";
  const span = (run: { start: number; length: number }) =>
    run.length === statuses.length
      ? "ganzjährig"
      : `${periodLabel(periodAt(run.start))} bis ${periodLabel(periodAt(run.start + run.length - 1))}`;
  if (!open)
    return `Saison: wetterabhängig ${span(rideable)}, sonst oft gesperrt.`;
  const parts = [`meist offen ${span(open)}`];
  if (rideable.length > open.length)
    parts.push(`wetterabhängig ${span(rideable)}`);
  return `Saison: ${parts.join(", ")}.`;
};
