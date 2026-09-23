/**
 * The ten-year daily series into the 24 half-months the app reads.
 *
 * The same split the routes have: the fetcher measures, this judges. What
 * counts as a snow day, a frost day or a wet day is a threshold like any other
 * in `validate.ts`, and it used to sit inside the Open-Meteo call, where the
 * only way to try a different one was to spend ~261 calls per pass again.
 * Here it is a pure function over a series, and a fixture of a handful of days
 * says what it does.
 *
 * Storing the raw series so that a changed threshold costs no API call at all
 * is a separate, larger question (plan 11, item 19).
 */
import type { ClimateYear } from "../../lib/types";
import type { DailySeries } from "./hosts";

/** What a day has to bring to count. */
export const CLIMATE_DAY = {
  /** Fresh snow in cm. Less is a dusting that no road authority reacts to. */
  snowCm: 1,
  /** Precipitation in mm – below this a day reads as dry to a rider. */
  wetMm: 1,
} as const;

/** 24 half-months: index 0 is 1–15 January, index 1 is 16–31 January. */
export const HALF_MONTHS = 24;

/** The half-month a `YYYY-MM-DD` falls in, or null when it is not a date. */
export const halfMonthOf = (iso: string): number | null => {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  return (month - 1) * 2 + (day > 15 ? 1 : 0);
};

/**
 * The means and the shares of one half-month over every year in the series.
 * A day whose two temperatures are missing carries nothing – not a zero: a
 * gap in the series must not read as a frost-free day.
 */
export const bucketClimate = (daily: DailySeries): ClimateYear => {
  const buckets = Array.from({ length: HALF_MONTHS }, () => ({
    frost: 0,
    n: 0,
    snow: 0,
    tn: 0,
    tx: 0,
    wet: 0,
  }));
  for (const [i, t] of daily.time.entries()) {
    const tmax = daily.temperature_2m_max[i];
    const tmin = daily.temperature_2m_min[i];
    if (typeof tmax !== "number" || typeof tmin !== "number") continue;
    const half = halfMonthOf(t);
    if (half === null) continue;
    const b = buckets[half]!;
    b.n += 1;
    b.tx += tmax;
    b.tn += tmin;
    if ((daily.snowfall_sum[i] ?? 0) >= CLIMATE_DAY.snowCm) b.snow += 1;
    if (tmin < 0) b.frost += 1;
    if ((daily.precipitation_sum[i] ?? 0) >= CLIMATE_DAY.wetMm) b.wet += 1;
  }
  return buckets.map((b) =>
    b.n
      ? {
          frostPct: Math.round((b.frost / b.n) * 100),
          snowPct: Math.round((b.snow / b.n) * 100),
          tmax: +(b.tx / b.n).toFixed(1),
          tmin: +(b.tn / b.n).toFixed(1),
          wetPct: Math.round((b.wet / b.n) * 100),
        }
      : null,
  );
};
