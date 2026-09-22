import { clockTime, dayLength, periodDate, sunTimes } from "@/lib/daylight";
import type {
  ClimateBucket,
  ClimateYear,
  Pass,
  Period,
  Status,
  Tour,
} from "@/lib/types";
import { fmt, fmtUnit } from "@/lib/utils";

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
 * The three statuses, best first – the one list the filter, the share image
 * and the calibration script iterate. `lib/schema.ts` carries the same triple
 * as a zod enum because it is the source of the type, but it is server-only
 * (zod must not reach the client), so this literal cannot be derived from it.
 */
export const STATUS_ORDER: readonly Status[] = ["open", "risky", "closed"];

/**
 * Higher is worse: the direction the status sort reads. Note that
 * `GRADE_RANK` below runs the other way (higher is better) because `tourYear`
 * picks the minimum grade; the two directions are deliberate and live next to
 * each other so neither can be read for the other.
 */
export const statusRank = (status: Status): number =>
  STATUS_ORDER.indexOf(status);

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
const REASON_WORD: Record<StatusReason, string> = {
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

/**
 * The one reason that closes a road. Every other signal can only make a cell
 * "eingeschränkt" – a snowy or a hot half-month is not a closure – so the
 * reasons behind "eingeschränkt" are the ladder without this one.
 */
const CLOSING_REASON: StatusReason = "outside-window";

/** Every reason that can make a cell "eingeschränkt", in ladder order. */
const LIMITING_REASONS: StatusReason[] = REASON_ORDER.filter(
  (r) => r !== CLOSING_REASON,
);

/**
 * The caveat as a standalone phrase, for "Fahrbar, aber mit einem Haken: …".
 * This one stands alone: the strip's popover shows it for whichever
 * half-month is hovered, which is rarely the selected one, so it is the only
 * explanation that cell has – `REASON_TEXT` above it describes the selected
 * half-month instead. That is why it may carry its own sub-clause, and why
 * the list in `GRADE_HINT.limited` uses `REASON_SHORT` rather than this.
 */
const REASON_PHRASE: Record<StatusReason, string> = {
  altitude: "Höhenlage, Schnee und Eis sind möglich",
  "cold-descent": "eine kalte Abfahrt",
  frost: "Frost in den Nächten",
  heat: "Hitze im Tal",
  "outside-window": "Wintersperre",
  "short-day": "kurze Tage",
  snow: "Schneefall",
  wet: "viel Regen",
  "window-edge":
    "der Rand des Öffnungsfensters, Öffnung und Sperrung verschieben sich je nach Winter",
};

/**
 * The caveat as a bare noun phrase, for the list of eight in
 * `GRADE_HINT.limited`. A phrase that carries its own sub-clause reads as
 * part of the list rather than as one item of it, so the list needs the
 * shorter form – the hand-written sentence this replaced used exactly these
 * words for the same reason.
 */
export const REASON_SHORT: Record<StatusReason, string> = {
  altitude: "die Höhenlage",
  "cold-descent": "eine kalte Abfahrt",
  frost: "Frost",
  heat: "Hitze im Tal",
  "outside-window": "Wintersperre",
  "short-day": "kurze Tage",
  snow: "Schnee",
  wet: "viel Regen",
  "window-edge": "der Rand des Öffnungsfensters",
};

/** "a, b und c" – the German list the generated sentences are built from. */
const listOf = (parts: string[], conjunction: string): string =>
  parts.length < 2
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} ${conjunction} ${parts.at(-1)}`;

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

/**
 * One plain sentence per grade – what the colour says, in the words a rider
 * would use. These are the general sentences for the legend; a cell in the
 * strip knows its half-month and says the specific thing instead
 * (`cellHint`): which caveat a limited cell has, and why a good cell is not
 * the best time. The rules behind it are in docs/scales.md and the dialog.
 */
export const GRADE_HINT: Record<Grade, string> = {
  best: "Die verlässlichsten Wochen des Jahres für diesen Pass: Nichts spricht gegen die Fahrt, und Schnee ist selten.",
  closed:
    "Die Straße ist in dieser Zeit meist gesperrt, in der Regel wegen der Wintersperre.",
  good: "Nichts spricht gegen die Fahrt. Nur ist es entweder ein kürzerer Abschnitt als die beste Zeit, oder es schneit gelegentlich.",
  limited: `Fahrbar, aber mit einem Haken: ${listOf(
    LIMITING_REASONS.map((r) => REASON_SHORT[r]),
    "oder",
  )}.`,
};

/**
 * One half-month of one pass or tour, index 0 = early January – everything a
 * cell of the strip, a row's dot or the badge says about that half-month.
 */
export interface YearCell {
  status: Status;
  /** The status split by the best window: what the strip paints. */
  grade: Grade;
  /** Every reason that fired, in ladder order; empty when none did. */
  reasons: StatusReason[];
  /** A cell with ≥ `SNOW_BEST_PCT` snow days: that, not the run length, keeps a good cell from the best time. */
  snowy: boolean;
  /**
   * Tour cells only: the slugs of the member passes that share this cell's
   * status – the ones that hold the tour back. It comes out of the same
   * reduction that produced the cell, which is what keeps the sentence under
   * the badge from naming a set the badge does not describe.
   */
  limiting?: string[];
}

/** The whole year of one pass or tour: 24 cells and the best window. */
export interface Year {
  /** 24 cells, index 0 = early January. */
  cells: YearCell[];
  /** The longest quiet run, or null when it is shorter than two half-months. */
  best: [Period, Period] | null;
}

/**
 * The year of every pass and tour, keyed by slug: what `getYears` in
 * lib/data.ts computes once at prerender and the page hands the client,
 * instead of letting the browser grade 201 passes again on every keystroke.
 */
export interface Years {
  passes: Record<string, Year>;
  tours: Record<string, Year>;
}

/**
 * The sentence for one cell: the specific thing where the cell knows it – the
 * caveat of a limited cell, the reason a good cell is not the best time – and
 * the general sentence otherwise.
 */
export const cellHint = (cell: YearCell): string => {
  if (cell.grade === "limited" && cell.reasons[0])
    return `Fahrbar, aber mit einem Haken: ${REASON_PHRASE[cell.reasons[0]]}.`;
  if (cell.grade === "good")
    return cell.snowy
      ? "Nichts spricht gegen die Fahrt. Jedoch schneit es gelegentlich."
      : "Nichts spricht gegen die Fahrt. Nur ist es ein kürzerer Abschnitt als die beste Zeit.";
  return GRADE_HINT[cell.grade];
};

/** The order the legend lists the grades in: best first. */
export const GRADE_ORDER: Grade[] = ["best", "good", "limited", "closed"];

/** Worse is lower; a tour cell is the minimum over its passes. */
const GRADE_RANK: Record<Grade, number> = {
  best: 3,
  closed: 0,
  good: 2,
  limited: 1,
};

const gradeOf = (status: Status, inBest: boolean): Grade =>
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

interface StatusVerdict {
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
interface PassSignals {
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
const FROST_RISKY_PCT = 80;
/** "Beste Zeit" only counts half-months that are quieter than this. */
const SNOW_BEST_PCT = 10;
/** Mean daily maximum in the valley, derived from the summit value. */
export const HEAT_VALLEY_TMAX = 26;
/** Share of days with ≥ 1 mm: two rain days in three. */
export const WET_LIMITED_PCT = 70;
/** Hours from sunrise to sunset; late October onward in the Alps. */
export const SHORT_DAY_HOURS = 10.75;
/** Mean daily maximum at the summit: the warmest moment of the descent. */
export const COLD_DESCENT_TMAX = 8;
/** Standard-atmosphere lapse rate in °C per m. */
const LAPSE_RATE = 0.0065;
/**
 * How far the derived valley value sits from a measured one, in °C. Principle
 * 3: it travels with every sentence that prints the derived value, so the
 * number is never shown without its error.
 */
export const VALLEY_TMAX_ERROR = 3;

/** ≈ 15 days per half-month, so a percentage is readable as "x of 15 days". */
export const daysOf = (pct: number) => Math.round((pct / 100) * 15);

/** One threshold, in the words the scales dialog explains it with. */
interface Signal {
  /**
   * The reason the threshold fires, or null for the bar the best window has
   * to clear – that one lifts nothing and lowers nothing, it only decides
   * which quiet run is allowed to call itself "beste Zeit".
   */
  reason: StatusReason | null;
  /** The constant the verdict compares against. */
  value: number;
  /** Written after the value: "%", "°C", "Stunden". */
  unit: string;
  /** Decimal places the value is printed with. */
  digits?: number;
  /** The clause the dialog prints; `$` stands for the value with its unit. */
  reads: string;
}

/**
 * Every threshold the heuristic carries, in ladder order, with the clause
 * that explains it. The scales dialog renders its "Vier Stufen, eine Leiter"
 * paragraph from this table, so a changed constant reaches the text that
 * explains it; `scripts/analyze-status.ts` reads the same values back when it
 * re-runs the calibration. The reasons without a number – the opening window,
 * its edge and the altitude fallback – are not here: they are calendar rules,
 * not thresholds, and `REASON_PHRASE` is what names them.
 */
export const SIGNALS: Signal[] = [
  {
    reads: "Schneefall ab $ der Tage",
    reason: "snow",
    unit: "%",
    value: SNOW_RISKY_PCT,
  },
  {
    reads: "Frost in $ der Nächte",
    reason: "frost",
    unit: "%",
    value: FROST_RISKY_PCT,
  },
  {
    reads: "Hitze im Tal ab $",
    reason: "heat",
    unit: "°C",
    value: HEAT_VALLEY_TMAX,
  },
  {
    reads: "Regen an $ der Tage",
    reason: "wet",
    unit: "%",
    value: WET_LIMITED_PCT,
  },
  {
    digits: 2,
    reads: "Tage unter $ Licht",
    reason: "short-day",
    unit: "Stunden",
    value: SHORT_DAY_HOURS,
  },
  {
    reads: "ein Gipfel-Tagesmaximum unter $",
    reason: "cold-descent",
    unit: "°C",
    value: COLD_DESCENT_TMAX,
  },
  {
    reads: "weniger als $ Schneefalltagen",
    reason: null,
    unit: "%",
    value: SNOW_BEST_PCT,
  },
];

/** The lapse rate as the dialog says it, e.g. "0,65 °C je 100 m". */
export const lapseText = (): string =>
  `${fmt(LAPSE_RATE * 100, 2)} °C je 100 m`;

/** The value of a signal with its unit, e.g. "20 %" or "10,75 Stunden". */
const signalValue = (s: Signal): string =>
  `${fmt(s.value, s.digits ?? 0)} ${s.unit}`;

/** A signal's clause with its value filled in, e.g. "Schneefall ab 20 % der Tage". */
const signalText = (s: Signal): string => s.reads.replace("$", signalValue(s));

/** The signal of one reason, for the dialog and the calibration script. */
const signalOf = (reason: StatusReason): Signal | undefined =>
  SIGNALS.find((s) => s.reason === reason);

/** The bar the best window has to clear: the one signal without a reason. */
const BEST_SIGNAL: Signal = SIGNALS.find((s) => s.reason === null)!;

/**
 * The "Vier Stufen, eine Leiter" sentence of the scales dialog, in ladder
 * order. Generated rather than written out so a changed threshold cannot sit
 * in `SIGNALS` while the paragraph that explains it still names the old one.
 */
export const ladderText = (): string =>
  `Jedes Signal kann eine Zelle nur senken, nie heben: ${listOf(
    LIMITING_REASONS.map(signalOf)
      .filter((s) => s !== undefined)
      .map(signalText),
    "oder",
  )} machen aus „gut“ ein „eingeschränkt“ – und das erste Signal in dieser Reihenfolge ist das Wort dazu. „Beste Zeit“ ist der längste Abschnitt ohne Vorbehalt und mit ${signalText(BEST_SIGNAL)}. „Oft gesperrt“ kommt ausschließlich aus dem Öffnungsfenster: eine gesperrte Straße und ein heißes Tal sind nicht dieselbe Art von Aussage.`;

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

/**
 * One German sentence per reason – the honesty principle made visible. Every
 * sentence names its number and where it comes from: a share of days from a
 * ten-year average, a derived valley value, an astronomical day length.
 */
const REASON_TEXT: Record<StatusReason, (ctx: ReasonContext) => string> = {
  altitude: ({ pass, t }) =>
    `${periodLabel(t)} ist auf ${fmt(pass.elevation)} m Grenzbereich: Schnee und Eis sind möglich, auch wenn die Straße offen ist.`,
  "cold-descent": ({ bucket }) =>
    `Am Gipfel im Schnitt höchstens ${fmt(bucket?.tmax ?? 0)} °C (ERA5-Land 2015–2024) – mit Fahrtwind ist die Abfahrt eine um den Gefrierpunkt.`,
  frost: ({ bucket }) =>
    `Frost in ${bucket?.frostPct ?? 0} % der Nächte (≈ ${daysOf(bucket?.frostPct ?? 0)} von 15, ERA5-Land 2015–2024) – nasse Straßen können überfrieren, die Abfahrt wird kalt.`,
  heat: ({ pass, bucket, valley }) =>
    `Im Tal um ${fmt(bucket ? (valleyTmax(pass, bucket, valley) ?? 0) : 0)} °C am Nachmittag (aus dem Gipfelwert abgeleitet, ± ${VALLEY_TMAX_ERROR} °C) – ab dem späten Vormittag nur noch oben angenehm.`,
  "outside-window": ({ pass }) =>
    pass.season
      ? `Außerhalb des typischen Öffnungsfensters (${periodLabel(pass.season.opens)} bis ${periodLabel(pass.season.closes)}).`
      : "Außerhalb der typischen Saison.",
  "short-day": ({ pass, t }) => {
    const sun = sunTimes(pass.lat, pass.lon, periodDate(t));
    return `Nur ${fmt(sun.dayLength, 1)} Stunden Tageslicht, Sonnenuntergang gegen ${clockTime(sun.sunset)} – für eine lange Runde wird es knapp.`;
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

/**
 * The sentences behind a cell's reasons, most important first. The reasons
 * are passed in rather than judged again: the cell of a `Year` already knows
 * them, and running the verdict a second time to read them back is how the
 * panel and the row used to be able to disagree.
 */
const reasonTexts = (
  pass: Pass,
  t: Period,
  reasons: StatusReason[],
  input?: VerdictInput | null,
): string[] =>
  reasons.map((r) =>
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

/** Longest run of `true` in a circular series of 24; null when there is none. */
interface Run {
  start: number;
  length: number;
}

/** Every circular run of `true` in `flags`, none of them split at the wrap. */
const runsOf = (flags: boolean[]): Run[] => {
  const n = flags.length;
  const origin = flags.indexOf(false);
  if (origin === -1) return n ? [{ length: n, start: 0 }] : [];
  const runs: Run[] = [];
  let start = -1;
  let length = 0;
  // Walk one full circle starting just after a gap; the walk ends on that
  // gap, so the last run is closed like every other.
  for (let k = 1; k <= n; k += 1) {
    const i = (origin + k) % n;
    if (flags[i]) {
      if (length === 0) start = i;
      length += 1;
    } else if (length) {
      runs.push({ length, start });
      length = 0;
    }
  }
  return runs;
};

/**
 * The longest run of `true`; with `prefer`, the longest among the runs that
 * satisfy it, if any does.
 */
const longestRun = (
  flags: boolean[],
  prefer?: (run: Run) => boolean,
): Run | null => {
  const runs = runsOf(flags);
  const pool = prefer ? runs.filter(prefer) : [];
  let best: Run | null = null;
  for (const r of pool.length ? pool : runs)
    if (!best || r.length > best.length) best = r;
  return best;
};

/** Whether index `i` lies in the circular run from `from` to `to` (both inclusive). */
const inRange = (i: number, [from, to]: [Period, Period]): boolean => {
  const a = periodIndex(from);
  const b = periodIndex(to);
  return a <= b ? i >= a && i <= b : i >= a || i <= b;
};

/**
 * The longest run of `true` as a window, or null when it is shorter than two
 * half-months – nothing worth calling a best time.
 */
const windowOf = (flags: boolean[]): [Period, Period] | null => {
  const run = longestRun(flags);
  if (!run || run.length < 2) return null;
  return [periodAt(run.start), periodAt(run.start + run.length - 1)];
};

/** What a year is read with; the app varies neither, a calibration run both. */
export interface YearRule {
  /** The reasons that count. Fewer of them is the heuristic of an earlier plan. */
  reasons?: readonly StatusReason[];
  /** Snow days above which a half-month is too quiet for no best time. */
  snowBestPct?: number;
}

/**
 * The same verdict with only some of its reasons. The rule that any reason at
 * all lowers a cell and only the window closes a road is `passVerdict`'s, and
 * it holds for a verdict read with fewer signals too – stated here rather than
 * wherever a comparison is drawn, because two statements of it are two rules.
 */
const limitTo = (
  v: StatusVerdict,
  keep: readonly StatusReason[],
): StatusVerdict => {
  const reasons = v.reasons.filter((r) => keep.includes(r));
  if (reasons.length === v.reasons.length) return v;
  return {
    reasons,
    status:
      v.status === "closed" ? "closed" : reasons.length ? "risky" : "open",
  };
};

/**
 * The whole year of one pass in one value: the status, grade and caveats of
 * every half-month, plus where the best window lies. This is the only place
 * the verdict is run over all 24 half-months – the row, the histogram, the
 * strip, the badge and the panel read this instead of grading again, which is
 * both why they cannot disagree about the same pass and why a keystroke costs
 * no verdicts at all (docs/plans/15-pass-year.md).
 *
 * "Beste Zeit" is the longest circular run of half-months that are open and
 * quiet in the climate series (under `SNOW_BEST_PCT` snow days). Since every
 * reason makes a cell "eingeschränkt", that run is free of heat, rain, short
 * days and cold descents by construction.
 *
 * `rule` is what the app never varies and a calibration run does: which
 * signals count and where the bar for a quiet half-month sits. Asking for a
 * year the way an earlier generation of the heuristic would have read it is
 * then an argument (`scripts/analyze-status.ts`) rather than a second
 * implementation of the run rule that can drift from this one.
 */
export const passYear = (
  pass: Pass,
  signals?: PassSignals | null,
  rule: YearRule = {},
): Year => {
  const { reasons = REASON_ORDER, snowBestPct = SNOW_BEST_PCT } = rule;
  const verdicts = PERIODS.map((t) =>
    limitTo(passVerdict(pass, t, inputAt(signals, t)), reasons),
  );
  const snowy = PERIODS.map(
    (_, i) => (signals?.climate?.[i]?.snowPct ?? 0) >= snowBestPct,
  );
  const best = windowOf(
    verdicts.map((v, i) => v.status === "open" && !snowy[i]),
  );
  return {
    best,
    cells: verdicts.map((v, i) => ({
      grade: gradeOf(v.status, best !== null && inRange(i, best)),
      reasons: v.reasons,
      snowy: snowy[i]!,
      status: v.status,
    })),
  };
};

/** Where a cell's first reason sits on the ladder; past the end without one. */
const ladderRank = (reasons: StatusReason[]): number =>
  reasons[0] ? REASON_ORDER.indexOf(reasons[0]) : REASON_ORDER.length;

/**
 * Nothing known holds this half-month back: the identity of the worst-of
 * reduction in `tourYear`, and what `cellAt` answers for a slug the year has
 * never heard of. Both are data errors `data:check` already rejects, so this
 * is a type question rather than a state the app shows.
 *
 * "gut", not "beste Zeit": the best window is a property of the year, and a
 * cell standing in for something unknown is in no position to claim it. An
 * absent pass would otherwise render as the strongest verdict the app has.
 */
const UNCONSTRAINED: YearCell = {
  grade: "good",
  reasons: [],
  snowy: false,
  status: "open",
};

/**
 * The year of a tour: per half-month the cell of the member pass that holds
 * the tour back, taken whole. A tour is only as rideable as its worst pass,
 * and it is that pass the tour reports – "eingeschränkt: Hitze" on a tour row
 * names what limits the tour rather than merging every pass's caveats, and the
 * strip's note comes from the same pass as the colour rather than from a
 * second one.
 *
 * The grade picks that pass, not the status: a grade is the status refined by
 * the best window (`gradeOf`), so the lowest grade is always the worst status
 * too, and where two passes are both open it prefers the one that is not at
 * its best – which is what a tour cell has to be, since a tour is at its best
 * only where all of its passes are. Among equal grades the pass whose first
 * reason ranks earliest on the ladder wins.
 */
export const tourYear = (tour: Tour, passes: Record<string, Year>): Year => {
  const own = tour.passes
    .map((slug) => passes[slug])
    .filter((year) => year !== undefined);
  const cells = PERIODS.map((_, i) => {
    let worst: YearCell | undefined;
    for (const year of own) {
      const cell = year.cells[i];
      if (!cell) continue;
      if (!worst) {
        worst = cell;
        continue;
      }
      const d = GRADE_RANK[cell.grade] - GRADE_RANK[worst.grade];
      if (
        d < 0 ||
        (d === 0 && ladderRank(cell.reasons) < ladderRank(worst.reasons))
      )
        worst = cell;
    }
    if (!worst) return UNCONSTRAINED;
    // The members that share the cell's status are the ones the sentence
    // names: status, not grade, because a tour that is "oft gesperrt" is held
    // back by every pass that is closed, not only by the one the reduction
    // happened to settle on. Nothing holds an open tour back, so an open cell
    // carries no list – it would be every member, never read, and it travels
    // to the client inside the precomputed `Year`.
    if (worst.status === "open") return worst;
    const limiting = tour.passes.filter(
      (slug) => passes[slug]?.cells[i]?.status === worst.status,
    );
    return { ...worst, limiting };
  });
  // A member's grade is "best" only inside that member's own best window, so
  // the minimum is "best" exactly where every pass is – which is the tour's
  // candidate window. It still has to clear the same two bars a pass's does:
  // at least two half-months, and only the longest run of them. So the window
  // is taken first and the cells are graded from it, the way `passYear` does
  // it; computing the cells first and reading a window back out of them is two
  // rules for one thing, and they disagree on a lone best half-month – the
  // cell would paint "beste Zeit" while the year reported none.
  const best = windowOf(cells.map((c) => c.grade === "best"));
  return {
    best,
    cells: cells.map((cell, i) => ({
      ...cell,
      grade: gradeOf(cell.status, best !== null && inRange(i, best)),
    })),
  };
};

/**
 * The cell of one half-month; `UNCONSTRAINED` for a slug the year does not
 * know, so a caller never has to choose a verdict for missing data itself.
 */
export const cellAt = (year: Year | undefined, t: Period): YearCell =>
  year?.cells[periodIndex(t)] ?? UNCONSTRAINED;

/**
 * "gut", "eingeschränkt: Hitze" or "oft gesperrt": the status label and, where
 * a caveat applies, the one word of its first reason. `CLOSING_REASON` is
 * excluded because it never coexists with "eingeschränkt"; its word exists for
 * the strip's cell hint.
 */
export const statusWord = (
  status: Status,
  reason?: StatusReason | null,
): string =>
  status === "risky" && reason && reason !== CLOSING_REASON
    ? `${STATUS_LABEL[status]}: ${REASON_WORD[reason]}`
    : STATUS_LABEL[status];

/**
 * What the badge prints for one cell. A cell inside the best window says so
 * instead of "gut"; everything else is `statusWord`. The badge reads the cell
 * rather than re-deriving the three parts, so it cannot describe a half-month
 * the strip next to it paints differently.
 */
export const badgeWord = (cell: YearCell): string =>
  cell.grade === "best"
    ? GRADE_LABEL.best
    : statusWord(cell.status, cell.reasons[0]);

/**
 * The one "abgeleitet" sentence for the valley value – Principle 3: the
 * derived number never shows without the word and without its error, and the
 * error is the one `REASON_TEXT.heat` prints.
 */
const valleyText = (
  pass: Pass,
  bucket: ClimateBucket,
  valley: number | null | undefined,
): string => {
  const tmax = valleyTmax(pass, bucket, valley);
  return tmax === null || valley === null || valley === undefined
    ? "Talwert nicht ableitbar, kein Anstiegsprofil."
    : `Im Tal (${fmtUnit(valley, "m")}) um ${fmt(Math.round(tmax))} °C, abgeleitet (± ${VALLEY_TMAX_ERROR} °C).`;
};

/**
 * The one "beste Zeit X – Y" line, next to the badge of a pass, a tour or a
 * base. Null where the year has no run worth the name: a single quiet
 * half-month is not a season.
 */
export const bestText = (year?: Year): string | null =>
  year?.best
    ? `beste Zeit ${periodLabel(year.best[0])} – ${periodLabel(year.best[1])}`
    : null;

/**
 * The paragraph under a pass's badge: every caveat of the chosen half-month,
 * most important first. The reasons come from the cell rather than from a
 * second verdict, so the paragraph and the badge describe one half-month.
 */
export const reasonParagraph = (
  pass: Pass,
  t: Period,
  reasons: StatusReason[],
  input?: VerdictInput | null,
): string | null => {
  const texts = reasonTexts(pass, t, reasons, input);
  return texts.length > 0 ? texts.join(" ") : null;
};

/**
 * The "abgeleitet" paragraph under the climate figures: what the half-month
 * is like at the summit, what that makes of the valley, and how much daylight
 * there is for it. The summit numbers above it are what the series measured;
 * everything derived from them is named as derived and carries its error
 * (Principle 3), and the day length is formatted like every other number in
 * the app rather than by a locale call of its own.
 */
export const climateText = (
  pass: Pass,
  bucket: ClimateBucket,
  signals: PassSignals,
  t: Period,
): string => {
  const sun = sunTimes(pass.lat, pass.lon, periodDate(t));
  return `${periodLabel(t)} auf ${fmtUnit(pass.elevation, "m")}; Niederschlag an ${fmt(bucket.wetPct)} % der Tage. ${valleyText(pass, bucket, signals.valley)} Tag ${fmt(sun.dayLength, 1)} h, Sonne ${clockTime(sun.sunrise)}–${clockTime(sun.sunset)}.`;
};

/**
 * How the tour sentence joins its status word to the passes that carry it.
 * Nothing limits an open tour, so `open` has no sentence.
 */
const TOUR_JOIN: Record<Status, string | null> = {
  closed: ":",
  open: null,
  risky: " durch",
};

const capitalise = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1);

/**
 * "Oft gesperrt: Stilfser Joch." or "Eingeschränkt durch Gavia, Mortirolo." –
 * the sentence under a tour's badge, carrying the word of the tour's own
 * status. The panel used to compose this itself from every member that was
 * not open, which printed "Eingeschränkt durch …" under an "oft gesperrt"
 * badge; the cell's `limiting` comes out of `tourYear` instead, so the
 * sentence and the badge always describe the same set.
 */
export const tourText = (
  cell: YearCell,
  names: (slug: string) => string | undefined,
): string | null => {
  const join = TOUR_JOIN[cell.status];
  if (join === null) return null;
  const list = (cell.limiting ?? []).map(names).filter((n) => n !== undefined);
  if (list.length === 0) return null;
  return `${capitalise(STATUS_LABEL[cell.status])}${join} ${list.join(", ")}.`;
};
/**
 * One sentence for the 24 cells of a season strip, so screen readers get the
 * same overview the colours give: "beste Zeit Anfang Juli bis Ende September,
 * gut Anfang Juni bis Anfang Oktober, eingeschränkt bis Ende Oktober".
 */
export const seasonSummary = (grades: Grade[]): string => {
  const n = grades.length;
  // A run "holds" a grade when one of its cells has it: `good` and `rideable`
  // are supersets of `best`, so the longest of them may be the best run
  // itself, while the genuinely good or limited cells sit in another.
  const holds = (grade: Grade) => (run: Run) => {
    for (let k = 0; k < run.length; k += 1)
      if (grades[(run.start + k) % n] === grade) return true;
    return false;
  };
  const best = longestRun(grades.map((g) => g === "best"));
  const good = longestRun(
    grades.map((g) => g === "best" || g === "good"),
    holds("good"),
  );
  const rideable = longestRun(
    grades.map((g) => g !== "closed"),
    holds("limited"),
  );
  if (!rideable) return "Saison: ganzjährig oft gesperrt.";
  const span = (run: Run) =>
    run.length === n
      ? "ganzjährig"
      : `${periodLabel(periodAt(run.start))} bis ${periodLabel(periodAt(run.start + run.length - 1))}`;
  if (!good)
    return `Saison: eingeschränkt ${span(rideable)}, sonst oft gesperrt.`;
  const parts: string[] = [];
  if (best) parts.push(`beste Zeit ${span(best)}`);
  if (grades.includes("good")) parts.push(`gut ${span(good)}`);
  if (grades.includes("limited")) parts.push(`eingeschränkt ${span(rideable)}`);
  return `Saison: ${parts.join(", ")}.`;
};
