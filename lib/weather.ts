import "server-only";
import { z } from "zod";

import * as S from "@/lib/schema";
import type { WeatherDay } from "@/lib/types";

/**
 * The app's only dynamic source, and the only free-tier quota a visitor can
 * spend. Three things keep 262 passes inside Open-Meteo's non-commercial
 * allowance of 10 000 calls a day:
 *
 *   a) the call runs on the server, cached per pass, so a pass costs one
 *      upstream call per window rather than one per visitor,
 *   b) the window is an hour (`REVALIDATE_S`), which puts the worst case –
 *      every pass opened in every window – at 262 × 24 ≈ 6 300 calls a day
 *      instead of the 12 600 a half-hour window would allow,
 *   c) the answer is streamed into the entity page's Suspense hole
 *      (`components/panel/weather.tsx`), so the browser never asks a third
 *      party and never asks this server twice for the same window either:
 *      what a client navigation fetches is the page's own payload.
 *
 * Until plan 02 this was `app/api/weather/[slug]/route.ts`, a route the panel
 * fetched; the function is the same, the transport is the page.
 */

/** How long one pass's forecast is reused. Open-Meteo refreshes hourly at best. */
const REVALIDATE_S = 3600;
/**
 * After a failed call, how long this instance stops asking Open-Meteo. A thrown
 * forecast is deliberately *not* cached, so without a cooldown each visitor
 * would start a fresh upstream call – the moment a rate limit or an outage
 * makes the cache stop absorbing them is exactly the moment the load arrives
 * undamped. Module scope, so the window is per warm instance and a burst
 * spread over several cold ones still costs one call each: a bound on the
 * storm, not a gate.
 */
const COOL_DOWN_S = 60;
let coolDownUntil = 0;

/**
 * What Open-Meteo answers, as far as this asked for it: one column per
 * variable, all as long as `time`. The zip below turns the columns into the
 * rows the panel reads, and each row goes through `WeatherDay` – so a column
 * that came up short, or a value that is neither a number nor the `null` the
 * host sends for a value it has none of, fails here instead of reaching the
 * panel as something it cannot read. The object is not strict on purpose:
 * Open-Meteo sends the coordinates, the timezone and the units alongside, and
 * a variable added upstream is no reason to drop a forecast.
 */
const Forecast = z
  .object({
    daily: z.object({
      precipitation_sum: z.array(z.unknown()),
      snowfall_sum: z.array(z.unknown()),
      temperature_2m_max: z.array(z.unknown()),
      temperature_2m_min: z.array(z.unknown()),
      time: z.array(z.unknown()),
      weather_code: z.array(z.unknown()),
      wind_speed_10m_max: z.array(z.unknown()),
    }),
  })
  .transform(({ daily }): WeatherDay[] =>
    daily.time.map((date, i) =>
      S.WeatherDay.parse({
        date,
        precipitation: daily.precipitation_sum[i],
        snowfall: daily.snowfall_sum[i],
        tmax: daily.temperature_2m_max[i],
        tmin: daily.temperature_2m_min[i],
        weatherCode: daily.weather_code[i],
        windMax: daily.wind_speed_10m_max[i],
      }),
    ),
  );

export const forecast = async (
  lat: number,
  lon: number,
  elevation: number,
): Promise<WeatherDay[]> => {
  "use cache";
  const { cacheLife, cacheTag } = await import("next/cache");
  cacheLife({ expire: 7200, revalidate: REVALIDATE_S, stale: 300 });
  cacheTag("weather");

  // Inside the cached function on purpose: a cache hit never runs this body, so
  // a pass that is already answered keeps being answered while the cooldown
  // holds. Only a call that would actually reach Open-Meteo is turned away –
  // one failing pass must not blank the weather of the other 261.
  if (Date.now() < coolDownUntil) throw new Error("Open-Meteo pausiert");

  // The cooldown is armed where it is earned: a caller that armed it on every
  // rejection would re-arm on the "pausiert" throw above and, under steady
  // traffic, never let the window end. The reading of the answer is inside
  // for the same reason – an answer this cannot make sense of is the host
  // failing too, and a throw that escapes here is not cached, so every later
  // visitor would fetch the same unreadable answer again.
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&elevation=${elevation}` +
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max,weather_code" +
        "&timezone=Europe%2FBerlin&forecast_days=7",
    );
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    return Forecast.parse(await res.json());
  } catch (error) {
    coolDownUntil = Date.now() + COOL_DOWN_S * 1000;
    throw error;
  }
};
