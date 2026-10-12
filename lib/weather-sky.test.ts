import { describe, expect, test } from "bun:test";

import type { WeatherDay } from "@/lib/types";
import { skyOf } from "@/lib/weather-sky";

const day = (
  weatherCode: number | null,
  precipitation = 0,
  snowfall = 0,
): WeatherDay => ({
  date: "2026-10-12",
  precipitation,
  snowfall,
  tmax: 8,
  tmin: -2,
  weatherCode,
  windMax: 20,
});

/**
 * Open-Meteo's daily code is the worst hour of the day, so it can say
 * "showers" over a day whose sum is nothing (seen at the Stelvio in October:
 * code 71 with 0.00 mm, code 80 with 0.4 mm). The icon follows the figure.
 */
describe("skyOf", () => {
  test("a wet code over a dry row is clouds, not rain", () => {
    expect(skyOf(day(80, 0.4))).toBe("cloudy");
    expect(skyOf(day(71, 0, 0.3))).toBe("cloudy");
    expect(skyOf(day(95, 0))).toBe("cloudy");
  });

  test("a wet code with a printed amount keeps its precipitation", () => {
    expect(skyOf(day(80, 1))).toBe("showers");
    expect(skyOf(day(61, 6.2))).toBe("rain");
    expect(skyOf(day(71, 0.4, 0.7))).toBe("snow");
    expect(skyOf(day(95, 12))).toBe("thunderstorm");
  });

  test("a dry code reads as itself, and no code is no sky", () => {
    expect(skyOf(day(0))).toBe("sunny");
    expect(skyOf(day(2))).toBe("partlyCloudy");
    expect(skyOf(day(3))).toBe("overcast");
    expect(skyOf(day(45))).toBe("fog");
    expect(skyOf(day(null))).toBeNull();
  });

  test("a missing amount counts as none", () => {
    expect(skyOf({ ...day(80), precipitation: null, snowfall: null })).toBe(
      "cloudy",
    );
  });
});
