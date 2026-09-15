import { getPass } from "@/lib/data";
import type { WeatherDay } from "@/lib/types";

/**
 * The app's only dynamic source, and the only free-tier quota a visitor can
 * spend. Three things keep 201 passes inside Open-Meteo's non-commercial
 * allowance of 10 000 calls a day:
 *
 *   a) the call runs on the server, cached per pass, so a pass costs one
 *      upstream call per window rather than one per visitor,
 *   b) the window is an hour (`REVALIDATE_S`), which puts the worst case –
 *      every pass opened in every window – at 201 × 24 ≈ 4 800 calls a day
 *      instead of the 9 600 a half-hour window allows,
 *   c) the answer carries `s-maxage`, so the CDN – not this function – serves
 *      the repeats within a window.
 *
 * The client makes no third-party request either way: what a browser fetches
 * is this route.
 */

/** How long one pass's forecast is reused. Open-Meteo refreshes hourly at best. */
const REVALIDATE_S = 3600;
/**
 * After a failed call, how long every pass answers from `COOL_DOWN_S` without
 * asking Open-Meteo again. A thrown forecast is deliberately *not* cached, so
 * without this each visitor would start a fresh upstream call – the moment a
 * rate limit or an outage makes the cache stop absorbing them is exactly the
 * moment the load arrives undamped. Module scope, so the window is per warm
 * instance; the `s-maxage` on the error does the same for the edge.
 */
const COOL_DOWN_S = 60;
let coolDownUntil = 0;

const forecast = async (
  lat: number,
  lon: number,
  elevation: number,
): Promise<WeatherDay[]> => {
  "use cache";
  const { cacheLife, cacheTag } = await import("next/cache");
  cacheLife({ expire: 14_400, revalidate: REVALIDATE_S, stale: 300 });
  cacheTag("weather");

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&elevation=${elevation}` +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max,weather_code" +
      "&timezone=Europe%2FBerlin&forecast_days=7",
  );
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const { daily } = (await res.json()) as {
    daily: Record<string, (number | string)[]>;
  };

  return (daily.time as string[]).map((date, i) => ({
    date,
    precipitation: daily.precipitation_sum![i] as number,
    snowfall: daily.snowfall_sum![i] as number,
    tmax: daily.temperature_2m_max![i] as number,
    tmin: daily.temperature_2m_min![i] as number,
    weatherCode: daily.weather_code![i] as number,
    windMax: daily.wind_speed_10m_max![i] as number,
  }));
};

/**
 * `s-maxage` lets the CDN answer the repeats, `max-age=0` keeps the browser
 * asking so a reload shows the newer forecast, and the long
 * `stale-while-revalidate` means an Open-Meteo outage shows yesterday's
 * numbers rather than an empty block.
 */
const CACHE_OK = `public, max-age=0, s-maxage=${REVALIDATE_S}, stale-while-revalidate=86400`;
const CACHE_ERROR = `public, max-age=0, s-maxage=${COOL_DOWN_S}`;

export const GET = async (
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await ctx.params;
  const pass = await getPass(slug);
  if (!pass)
    return Response.json({ error: "unbekannter Pass" }, { status: 404 });

  if (Date.now() < coolDownUntil)
    return Response.json(
      { error: "Open-Meteo pausiert" },
      { headers: { "Cache-Control": CACHE_ERROR }, status: 503 },
    );

  try {
    const days = await forecast(pass.lat, pass.lon, pass.elevation);
    return Response.json(
      { days, slug },
      { headers: { "Cache-Control": CACHE_OK } },
    );
  } catch (error) {
    coolDownUntil = Date.now() + COOL_DOWN_S * 1000;
    return Response.json(
      { error: (error as Error).message },
      { headers: { "Cache-Control": CACHE_ERROR }, status: 502 },
    );
  }
};
