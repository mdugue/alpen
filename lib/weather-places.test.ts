import { describe, expect, test } from "bun:test";

import passesJson from "@/data/passes.json" with { type: "json" };
import townsJson from "@/data/towns.json" with { type: "json" };
import type { Pass, Town } from "@/lib/types";
import {
  allPlaces,
  DAILY_QUOTA,
  passPlaces,
  townPlaces,
  worstCallsPerDay,
} from "@/lib/weather-places";
import { makePass, makeTown } from "@/test/fixtures";

describe("passPlaces", () => {
  test("the summit with its curated height, then each start on the terrain model", () => {
    const pass = makePass("col", 0, {
      ascents: [
        { from: { lat: 45.1654, lon: 6.43 }, label: "Valloire (Nord)" },
        { from: { lat: 45.034, lon: 6.405 }, label: "Lautaret (Süd)" },
      ],
      elevation: 2642,
    });
    expect(passPlaces(pass)).toEqual([
      { elevation: 2642, kind: "summit", label: "", lat: 46, lon: 10 },
      {
        elevation: null,
        kind: "start",
        label: "Valloire (Nord)",
        lat: 45.165,
        lon: 6.43,
      },
      {
        elevation: null,
        kind: "start",
        label: "Lautaret (Süd)",
        lat: 45.034,
        lon: 6.405,
      },
    ]);
  });

  test("two ascents from the same place are one forecast", () => {
    const from = { lat: 46.2, lon: 10.1 };
    const pass = makePass("col", 0, {
      ascents: [
        { from, label: "A" },
        { from: { lat: 46.2001, lon: 10.1 }, label: "B" },
      ],
    });
    expect(passPlaces(pass).map((p) => p.label)).toEqual(["", "A"]);
  });
});

test("a town is forecast where it is", () => {
  expect(townPlaces(makeTown("bormio", 0, { name: "Bormio" }))).toEqual([
    { elevation: null, kind: "town", label: "Bormio", lat: 46, lon: 10 },
  ]);
});

test("every point opened in every window stays inside Open-Meteo's allowance", () => {
  // Each location of a request is one call upstream; this is the worst case
  // the window in `WEATHER_WINDOW_S` has to absorb. A list that grows past it
  // needs a longer window, not a hope.
  const points = allPlaces(
    passesJson as unknown as Pass[],
    townsJson as unknown as Town[],
  ).length;
  expect(worstCallsPerDay(points)).toBeLessThan(DAILY_QUOTA);
});
