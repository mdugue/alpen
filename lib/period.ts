/**
 * The calendar the app reckons in: twelve German month names and the 24
 * half-months everything is rated for.
 *
 * It sat in `lib/status.ts` because that is where half-months were first
 * needed, which made the address bar and web storage import the rideability
 * heuristic to ask whether a number is one of the 24 – a thousand-line module
 * about snow, heat and daylight, for a calendar. Nothing here knows anything
 * about a pass: it is vocabulary, and the heuristic is one of its readers.
 */
import type { Lang } from "@/lib/i18n/lang";
import type { Period } from "@/lib/types";

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
/** The English months, for `periodLabel` under `/en` (plan 08). */
export const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** The month names of one language, in calendar order. */
export const monthsOf = (lang: Lang = "de"): readonly string[] =>
  lang === "en" ? MONTHS_EN : MONTHS;

export const MONTH_INITIALS = MONTHS.map((m) => m[0]!);

/** The first letter of each month, for the axis under a strip. */
export const monthInitialsOf = (lang: Lang = "de"): string[] =>
  monthsOf(lang).map((m) => m[0]!);

/**
 * "Anfang Oktober" / "early October": the half-month as the whole app says
 * it. German is the default so a caller that says nothing keeps its words.
 */
export const periodLabel = (t: Period, lang: Lang = "de"): string => {
  const month = monthsOf(lang)[Math.floor(t) - 1];
  return lang === "en"
    ? `${t % 1 ? "late" : "early"} ${month}`
    : `${t % 1 ? "Ende" : "Anfang"} ${month}`;
};

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
