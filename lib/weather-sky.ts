import type { WeatherDay } from "@/lib/types";

/** The words a day's sky can be, as `panel.weather.code` keys them. */
export type Sky =
  | "sunny"
  | "partlyCloudy"
  | "cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "showers"
  | "snowShowers"
  | "thunderstorm";

/** What the row prints for an amount: rounded, so 0.4 mm reads "0 mm". */
const shown = (n: number | null) => Math.round(n ?? 0);

/** A day whose row shows neither a millimetre of rain nor a centimetre of snow. */
export const isDry = (day: WeatherDay) =>
  shown(day.precipitation) === 0 && shown(day.snowfall) === 0;

/**
 * The day's sky from its WMO weather code. Open-Meteo's daily code is the
 * most severe hour of the day, so a model hour of light showers or flurries
 * marks the whole day wet even where the day's sum is nothing the row can
 * print. Such a day is drawn as clouds, not as rain beside "0 mm": the icon
 * may never claim more than the figure next to it. A day without a code gets
 * no sky.
 */
export const skyOf = (day: WeatherDay): Sky | null => {
  const code = day.weatherCode;
  if (code === null) return null;
  if (code === 0) return "sunny";
  if (code <= 2) return "partlyCloudy";
  if (code === 3) return "overcast";
  if (code <= 48) return "fog";
  if (isDry(day)) return "cloudy";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "showers";
  if (code <= 86) return "snowShowers";
  return "thunderstorm";
};
