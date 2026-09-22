import { describe, expect, test } from "bun:test";

import { Pass, WeatherDay } from "@/lib/schema";

/**
 * The rules that only the parent's `type` can decide, and that therefore live
 * in `Pass`'s refinement rather than in `Ascent` (plan 14). Everything else the
 * schemas say is exercised by `bun run data:check` against the real files.
 */
const road = (over: Record<string, unknown>) => ({
  ascents: [],
  beauty: 3,
  classicAscent: "",
  country: "IT",
  difficulty: 3,
  elevation: 1500,
  fame: 3,
  lat: 46,
  lon: 10,
  name: "Teststraße",
  note: "",
  region: "Dolomiten",
  season: null,
  slug: "teststrasse",
  surface: "asphalt",
  traffic: 3,
  type: "pass",
  ...over,
});
const climb = { from: { lat: 46.1, lon: 10.1 }, label: "Von unten" };
const traverse = { ...climb, km: 17, to: { lat: 45.9, lon: 9.9 } };
const issues = (input: unknown) =>
  Pass.safeParse(input).error?.issues.map((i) => i.message) ?? [];

describe("Pass", () => {
  test("a climb ends at the marker and says nothing more", () => {
    expect(Pass.safeParse(road({ ascents: [climb] })).success).toBe(true);
    expect(issues(road({ ascents: [traverse] })).join(" ")).toContain(
      "to und km gehören nicht dazu",
    );
  });

  test("a traverse names where it ends and how long it is", () => {
    const balcony = { ascents: [traverse], type: "balcony" };
    expect(Pass.safeParse(road(balcony)).success).toBe(true);
    expect(issues(road({ ...balcony, ascents: [climb] })).join(" ")).toContain(
      "braucht Ende (to) und Länge (km)",
    );
  });

  test("a check may only widen the limits its own validator reads", () => {
    const ascentCheck = { minPeakAt: 0.5, note: "endet am Berghaus" };
    const tourCheck = { maxKmDelta: 0.25, note: "Länge inkl. Zufahrt" };
    expect(
      Pass.safeParse(road({ ascents: [{ ...climb, check: ascentCheck }] }))
        .success,
    ).toBe(true);
    expect(
      issues(road({ ascents: [{ ...climb, check: tourCheck }] })).join(" "),
    ).toContain("kennt die Tour-Grenzen nicht");
    expect(
      issues(
        road({
          ascents: [{ ...traverse, check: ascentCheck }],
          type: "balcony",
        }),
      ).join(" "),
    ).toContain("maxKmDelta");
  });

  test("type is required and a label may not repeat", () => {
    const { type, ...withoutType } = road({});
    expect(type).toBe("pass");
    expect(Pass.safeParse(withoutType).success).toBe(false);
    expect(Pass.safeParse(road({ tags: ["toll", "toll"] })).success).toBe(
      false,
    );
    expect(Pass.safeParse(road({ tags: ["toll", "carfree"] })).success).toBe(
      true,
    );
  });
});

/**
 * Open-Meteo answers a day or a variable it has no value for with `null`, and
 * one of those must cost the panel that cell rather than the whole week.
 */
describe("WeatherDay", () => {
  const day = {
    date: "2026-07-01",
    precipitation: 0,
    snowfall: 0,
    tmax: 21,
    tmin: 9,
    weatherCode: 1,
    windMax: 12,
  };

  test("a measurement the host has no value for is a missing cell, not a broken day", () => {
    expect(WeatherDay.safeParse({ ...day, snowfall: null }).success).toBe(true);
    expect(
      WeatherDay.safeParse({ ...day, tmax: null, windMax: null }).success,
    ).toBe(true);
    // The date is what the row is keyed and labelled by, so it stays required,
    // and a value that is neither a number nor absent is still an error.
    expect(WeatherDay.safeParse({ ...day, date: null }).success).toBe(false);
    expect(WeatherDay.safeParse({ ...day, tmin: "kalt" }).success).toBe(false);
  });
});

describe("Pass · the range box", () => {
  test("the marker and every ride's ends lie inside the box of the road's own range", () => {
    // A Pyrenean col at an alpine coordinate: the region says Pyrenäen, the
    // marker sits in the Alps. One box for all ranges would let it through.
    expect(
      issues(road({ lat: 46, lon: 10, region: "Pyrenäen" })).join(" "),
    ).toContain("Punkt liegt außerhalb der Pyrenäen");
    expect(
      Pass.safeParse(road({ lat: 42.9, lon: 0.1, region: "Pyrenäen" })).success,
    ).toBe(true);
    // An ascent that starts in another range is the same mistake.
    expect(
      issues(
        road({
          ascents: [{ from: { lat: 42.9, lon: 0.2 }, label: "Luz" }],
          region: "Dolomiten",
        }),
      ).join(" "),
    ).toContain("Auffahrt liegt außerhalb der Alpen");
    // The union still refuses what no range holds at all.
    expect(Pass.safeParse(road({ lat: 51, lon: 10 })).success).toBe(false);
  });
});
