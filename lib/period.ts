import type { Messages } from "@/lib/i18n";
/**
 * The calendar the app reckons in: the 24 half-months everything is rated
 * for, and how one is said (the month names are words, so they live in the
 * message files as `calendar`).
 *
 * It sat in `lib/status.ts` because that is where half-months were first
 * needed, which made the address bar and web storage import the rideability
 * heuristic to ask whether a number is one of the 24 – a thousand-line module
 * about snow, heat and daylight, for a calendar. Nothing here knows anything
 * about a pass: it is vocabulary, and the heuristic is one of its readers.
 */
import { fill } from "@/lib/i18n/fill";
import type { Period } from "@/lib/types";

/** "Anfang Oktober" / "early October": the half-month as the whole app says it. */
export const periodLabel = (t: Period, w: Messages): string =>
  fill(t % 1 ? w.calendar.late : w.calendar.early, {
    month: w.calendar.months[Math.floor(t) - 1]!,
  });

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
