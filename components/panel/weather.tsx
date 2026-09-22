import { connection } from "next/server";

import {
  WeatherForecast,
  WeatherUnavailable,
} from "@/components/panel/weather-forecast";
import type { Pass } from "@/lib/types";
import { forecast } from "@/lib/weather";

/**
 * The forecast of one pass, rendered on the server and streamed into the
 * pass page's Suspense hole (plan 02). `connection()` first: the forecast
 * is the one thing on an entity page that must not be baked into the
 * prerender – a week-old forecast labelled "heute" is worse than none – and
 * it is also what keeps `next build` from asking Open-Meteo 262 times. The
 * cached function behind it (`lib/weather.ts`) holds the quota arithmetic.
 *
 * A failure is rendered, not thrown: the panel says "Wetter nicht
 * verfügbar" in the same place the table would stand, and the rest of the
 * page is unaffected.
 */
export const Weather = async ({ pass }: { pass: Pass }) => {
  await connection();
  const days = await forecast(pass.lat, pass.lon, pass.elevation).catch(
    () => null,
  );
  return days ? <WeatherForecast days={days} /> : <WeatherUnavailable />;
};
