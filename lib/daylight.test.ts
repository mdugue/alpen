import { describe, expect, test } from "bun:test";

import { clockTime, dayLength, periodDate, sunTimes } from "@/lib/daylight";

const BOZEN = { lat: 46.5, lon: 11.35 };
const NICE = { lat: 43.7, lon: 7.27 };

describe("sunTimes", () => {
  test("the equinox gives twelve hours (and a bit) at every latitude", () => {
    for (const lat of [43, 46.5, 48]) {
      const { dayLength: h } = sunTimes(lat, 10, new Date("2026-03-20T12:00Z"));
      // A little over twelve: refraction and the disc's radius lengthen the day.
      expect(h).toBeGreaterThan(12);
      expect(h).toBeLessThan(12.4);
    }
  });

  test("midsummer in Bozen is close to sixteen hours, midwinter in Nice nine", () => {
    expect(
      sunTimes(BOZEN.lat, BOZEN.lon, new Date("2026-06-21T12:00Z")).dayLength,
    ).toBeCloseTo(15.8, 0);
    expect(
      sunTimes(NICE.lat, NICE.lon, new Date("2026-12-21T12:00Z")).dayLength,
    ).toBeCloseTo(9, 0);
  });

  test("sunrise and sunset in Bozen on 21 June, Berlin clock", () => {
    const { sunrise, sunset } = sunTimes(
      BOZEN.lat,
      BOZEN.lon,
      new Date("2026-06-21T12:00Z"),
    );
    // Almanac values are 05:23 and 21:10; the equation is good to a minute or two.
    expect(clockTime(sunrise)).toMatch(/^05:2[1-5]$/u);
    expect(clockTime(sunset)).toMatch(/^21:(?:08|09|1[0-2])$/u);
  });

  test("longitude shifts the clock, not the day length", () => {
    const d = new Date("2026-09-01T12:00Z");
    const east = sunTimes(46, 15, d);
    const west = sunTimes(46, 5, d);
    // 10° of longitude are 40 minutes of clock time.
    expect(
      (east.sunrise.getTime() - west.sunrise.getTime()) / 60_000,
    ).toBeCloseTo(-40, 0);
    expect(east.dayLength).toBeCloseTo(west.dayLength, 5);
  });
});

describe("half-months", () => {
  test("periodDate picks the middle day", () => {
    expect(periodDate(1, 2026).toISOString()).toBe("2026-01-08T12:00:00.000Z");
    expect(periodDate(10.5, 2026).toISOString()).toBe(
      "2026-10-23T12:00:00.000Z",
    );
  });

  test("dayLength at 46.5° N: long in June, short from late October on", () => {
    expect(dayLength(46.5, 6.5)).toBeGreaterThan(15.5);
    expect(dayLength(46.5, 10)).toBeGreaterThan(11);
    expect(dayLength(46.5, 10.5)).toBeLessThan(10.75);
    expect(dayLength(46.5, 12.5)).toBeLessThan(9);
  });
});
