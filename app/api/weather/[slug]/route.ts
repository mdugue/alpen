import { z } from "zod";

import { getPass } from "@/lib/data";
import * as S from "@/lib/schema";
import type { WeatherDay } from "@/lib/types";

/**
 * The app's only dynamic source, and the only free-tier quota a visitor can
 * spend. Three things keep every road in `data/passes.json` (262 today) inside
 * Open-Meteo's non-commercial allowance of 10 000 calls a day:
 *
 *   a) the call runs on the server, cached per pass, so a pass costs one
 *      upstream call per window rather than one per visitor,
 *   b) the window is an hour (`REVALIDATE_S`), which puts the worst case –
 *      every pass opened in every window – at 262 × 24 ≈ 6 300 calls a day,
 *      where a half-hour window would ask for 12 600; an hour holds up to
 *      about 410 roads, so the list growing past that means a longer window,
 *   c) the answer carries `s-maxage`, so the CDN – not this function – serves
 *      the repeats within a window.
 *
 * The client makes no third-party request either way: what a browser fetches
 * is this route.
 */

/** How long one pass's forecast is reused. Open-Meteo refreshes hourly at best. */
const REVALIDATE_S = 3600;
/**
 * After a failed call, how long this instance stops asking Open-Meteo. A thrown
 * forecast is deliberately *not* cached, so without a cooldown each visitor
 * would start a fresh upstream call – the moment a rate limit or an outage
 * makes the cache stop absorbing them is exactly the moment the load arrives
 * undamped.
 *
 * Two things it is not. It is module scope, so the window is per warm instance
 * and a burst spread over several cold ones still costs one call each; that is
 * a bound on the storm, not a gate. And it cannot be helped along at the edge:
 * Vercel's CDN caches only 200, 404, 410 and the redirects, so a 502 or 503 is
 * never stored however it is labelled, and this route does not dress a failure
 * up as a 200 to get it cached – the panel's "Wetter nicht verfügbar" belongs
 * to a response that says it failed.
 */
const COOL_DOWN_S = 60;
let coolDownUntil = 0;

/**
 * What Open-Meteo answers, as far as this route asked for it: one column per
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

const forecast = async (
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
  // one failing pass must not blank the weather of all the others.
  if (Date.now() < coolDownUntil) throw new Error("Open-Meteo pausiert");

  // The cooldown is armed where it is earned, not in the handler: a handler
  // that armed it on every rejection would re-arm on its own "pausiert" throw
  // and, under steady traffic, never let the window end. The reading of the
  // answer is inside for the same reason – an answer this route cannot make
  // sense of is the host failing too, and a throw that escapes here is not
  // cached, so every later visitor would fetch the same unreadable answer
  // again.
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

/**
 * `s-maxage` lets the CDN answer the repeats, `max-age=0` keeps the browser
 * asking so a reload shows the newer forecast, and `stale-while-revalidate`
 * covers one more window: a forecast at most two hours old is still a forecast,
 * while a whole day of staleness would eventually label yesterday "heute".
 */
const CACHE_OK = `public, max-age=0, s-maxage=${REVALIDATE_S}, stale-while-revalidate=${REVALIDATE_S}`;
/** An unknown slug cannot become known without a deploy, and a 404 *is* cacheable. */
const CACHE_404 = "public, max-age=0, s-maxage=86400";

export const GET = async (
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await ctx.params;
  // The path segment is the one string a visitor hands this route, so it is
  // held against the rule every slug in `data/` is held against (`S.Slug`)
  // before anything is looked up with it. Whatever cannot name a pass gets the
  // same cacheable 404 as a pass that does not exist.
  const pass = S.Slug.safeParse(slug).success ? getPass(slug) : undefined;
  if (!pass)
    return Response.json(
      { error: "unbekannter Pass" },
      { headers: { "Cache-Control": CACHE_404 }, status: 404 },
    );

  try {
    const days = await forecast(pass.lat, pass.lon, pass.elevation);
    return Response.json(
      { days, slug },
      { headers: { "Cache-Control": CACHE_OK } },
    );
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
};
