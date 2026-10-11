import type { Pass, Town, WeatherDay } from "@/lib/types";

/**
 * Where the panel asks Open-Meteo for a forecast, and what that costs.
 *
 * A pass is not one climate: the summit can be at freezing point while the
 * valley the ascent starts in is at twenty degrees, and the day's choice of
 * jacket is made down there. So a pass is forecast at its marker *and* at the
 * start of every ascent – the altitude ladder mountain weather sites show as
 * "Berg / Tal" – and a town at the town. The summit carries the curated
 * elevation; a valley point carries none and Open-Meteo reads its own 90 m
 * terrain model there, which is what places the forecast at the right height
 * in a narrow valley (and what the panel shows as that point's elevation).
 *
 * Pure, so the quota arithmetic below can be checked against the data in a
 * test rather than in a comment that goes stale with the next road.
 */

export type PlaceKind = "summit" | "start" | "town";

export interface WeatherPlace {
  kind: PlaceKind;
  /** What the panel calls it: the ascent's label, the town's name; empty for a pass's top. */
  label: string;
  lat: number;
  lon: number;
  /** The curated elevation, where there is one; `null` lets Open-Meteo use its terrain model. */
  elevation: number | null;
}

/**
 * Two starts closer than this are one forecast: Open-Meteo's finest models run
 * on a grid of a kilometre or two, so a second call would only cost quota.
 * The same rounding is what the points are asked with, so two entities that
 * share a start share its cached forecast. Three decimals (~100 m) on purpose – coarser rounding would move a point in
 * a narrow valley onto the slope beside it, and the terrain model would put
 * the forecast hundreds of metres too high.
 */
const round = (x: number) => Math.round(x * 1000) / 1000;
const keyOf = (lat: number, lon: number) => `${round(lat)},${round(lon)}`;

/** The summit first, then each ascent's start once, in the curated order. */
export const passPlaces = (pass: Pass): WeatherPlace[] => {
  const places: WeatherPlace[] = [
    {
      elevation: pass.elevation,
      kind: "summit",
      // A pass's top is its "Passhöhe", which the panel says in its own words;
      // a spur or a valley road is better named than described.
      label: pass.type === "pass" ? "" : pass.name,
      lat: round(pass.lat),
      lon: round(pass.lon),
    },
  ];
  const seen = new Set([keyOf(pass.lat, pass.lon)]);
  for (const ascent of pass.ascents) {
    const key = keyOf(ascent.from.lat, ascent.from.lon);
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({
      elevation: null,
      kind: "start",
      label: ascent.label,
      lat: round(ascent.from.lat),
      lon: round(ascent.from.lon),
    });
  }
  return places;
};

export const townPlaces = (town: Town): WeatherPlace[] => [
  {
    elevation: null,
    kind: "town",
    label: town.name,
    lat: round(town.lat),
    lon: round(town.lon),
  },
];

/**
 * How long one point's forecast is reused, in seconds.
 *
 * The models behind Open-Meteo's European forecast run every three hours at
 * best (ICON-D2, AROME, ICON-CH), and a *daily* forecast does not move within
 * one run; a shorter window would spend quota on the same numbers.
 */
export const WEATHER_WINDOW_S = 3 * 3600;

/** Open-Meteo's non-commercial allowance, in calls a day. */
export const DAILY_QUOTA = 10_000;

/**
 * The worst case: every point opened in every window. Open-Meteo counts each
 * location of a request as one call, so this is a count of points, not of
 * panels – which is why the points are deduplicated across all entities. With
 * 279 roads, their starts and 71 towns this is 690 points, ≈ 5 500 calls a
 * day; `lib/weather-places.test.ts` holds it under the allowance.
 */
export const worstCallsPerDay = (points: number) =>
  Math.ceil(points * ((24 * 3600) / WEATHER_WINDOW_S));

/** Every point the app could ever ask for, once each. */
export const allPlaces = (
  passes: readonly Pass[],
  towns: readonly Town[],
): WeatherPlace[] => {
  const seen = new Map<string, WeatherPlace>();
  for (const place of [
    ...passes.flatMap(passPlaces),
    ...towns.flatMap(townPlaces),
  ])
    seen.set(
      `${keyOf(place.lat, place.lon)}@${place.elevation ?? "dem"}`,
      place,
    );
  return [...seen.values()];
};

/** What the panel shows for one place: its week, and the height it was forecast for. */
export interface PlaceForecast {
  place: WeatherPlace;
  days: WeatherDay[];
  elevation: number;
}
