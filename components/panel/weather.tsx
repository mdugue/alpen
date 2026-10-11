import { connection } from "next/server";

import {
  WeatherForecast,
  WeatherUnavailable,
} from "@/components/panel/weather-forecast";
import { forecast } from "@/lib/weather";
import type { WeatherPlace } from "@/lib/weather-places";

/**
 * The forecast of one entity's places – a pass's summit and the start of each
 * ascent, or a town – rendered on the server and streamed into the entity
 * page's Suspense hole (plan 02). `connection()` first: the forecast is the
 * one thing on an entity page that must not be baked into the prerender – a
 * week-old forecast labelled "heute" is worse than none – and it is also what
 * keeps `next build` from asking Open-Meteo for every point. The cached
 * function behind it (`lib/weather.ts`) holds the quota arithmetic.
 *
 * A failure is rendered, not thrown: a place Open-Meteo did not answer for is
 * left out, and with none answered the panel says "Wetter nicht verfügbar" in
 * the same place the table would stand. The rest of the page is unaffected.
 */
export const Weather = async ({ places }: { places: WeatherPlace[] }) => {
  await connection();
  const answered = await Promise.all(
    places.map((place) =>
      forecast(place.lat, place.lon, place.elevation).then(
        (f) => ({ ...f, place }),
        () => null,
      ),
    ),
  );
  const shown = answered.filter((a) => a !== null);
  return shown.length > 0 ? (
    <WeatherForecast places={shown} />
  ) : (
    <WeatherUnavailable />
  );
};
