import { getPass } from "@/lib/data";
import type { WeatherDay } from "@/lib/types";

/**
 * The app's only dynamic source. Runs server-side so that
 *   a) the forecast is fetched once per pass and half hour instead of
 *      once per visitor (Open-Meteo quota),
 *   b) the client makes no third-party requests.
 */
async function forecast(
  lat: number,
  lon: number,
  elevation: number,
): Promise<WeatherDay[]> {
  "use cache";
  const { cacheLife, cacheTag } = await import("next/cache");
  cacheLife({ stale: 300, revalidate: 1800, expire: 7200 });
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
    tmin: daily.temperature_2m_min![i] as number,
    tmax: daily.temperature_2m_max![i] as number,
    precipitation: daily.precipitation_sum![i] as number,
    snowfall: daily.snowfall_sum![i] as number,
    windMax: daily.wind_speed_10m_max![i] as number,
    weatherCode: daily.weather_code![i] as number,
  }));
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const pass = await getPass(slug);
  if (!pass)
    return Response.json({ error: "unbekannter Pass" }, { status: 404 });

  try {
    const days = await forecast(pass.lat, pass.lon, pass.elevation);
    return Response.json({ slug, days });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
