import { describe, expect, test } from "bun:test";

import { bucketClimate, halfMonthOf } from "./climate";
import type { DailySeries } from "./hosts";

/** A day, as Open-Meteo hands one over. */
interface Day {
  date: string;
  precipitation?: number | null;
  snow?: number | null;
  tmax?: number | null;
  tmin?: number | null;
}

const series = (days: Day[]): DailySeries => ({
  precipitation_sum: days.map((d) => d.precipitation ?? 0),
  snowfall_sum: days.map((d) => d.snow ?? 0),
  temperature_2m_max: days.map((d) => d.tmax ?? null),
  temperature_2m_min: days.map((d) => d.tmin ?? null),
  time: days.map((d) => d.date),
});

describe("halfMonthOf", () => {
  test("the 15th is still the early half, the 16th the late one", () => {
    expect(halfMonthOf("2020-01-15")).toBe(0);
    expect(halfMonthOf("2020-01-16")).toBe(1);
    expect(halfMonthOf("2020-12-31")).toBe(23);
  });

  test("anything that is not a date belongs in no half-month", () => {
    expect(halfMonthOf("2020-13-01")).toBeNull();
    expect(halfMonthOf("")).toBeNull();
  });
});

describe("bucketClimate", () => {
  test("a year with no data at all is 24 nulls", () => {
    expect(bucketClimate(series([]))).toEqual(
      Array.from({ length: 24 }, () => null),
    );
  });

  test("means over every year in the series, shares in percent", () => {
    const year = bucketClimate(
      series([
        { date: "2015-07-03", tmax: 20, tmin: 10 },
        { date: "2024-07-05", tmax: 24, tmin: 14 },
      ]),
    );
    expect(year[12]).toEqual({
      frostPct: 0,
      snowPct: 0,
      tmax: 22,
      tmin: 12,
      wetPct: 0,
    });
    expect(year[13]).toBeNull();
  });

  test("a snow day is 1 cm, a wet day 1 mm, a frost day a minimum below zero", () => {
    const year = bucketClimate(
      series([
        { date: "2020-10-01", precipitation: 0.9, snow: 0.9, tmax: 4, tmin: 0 },
        { date: "2020-10-02", precipitation: 1, snow: 1, tmax: 2, tmin: -0.1 },
      ]),
    );
    expect(year[18]).toMatchObject({ frostPct: 50, snowPct: 50, wetPct: 50 });
  });

  test("a day without temperatures carries nothing – a gap is not a frost-free day", () => {
    const year = bucketClimate(
      series([
        { date: "2020-02-02", snow: 5, tmax: null, tmin: null },
        { date: "2020-02-03", snow: 0, tmax: -2, tmin: -8 },
      ]),
    );
    expect(year[2]).toMatchObject({ frostPct: 100, snowPct: 0 });
  });
});
