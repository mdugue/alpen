import { describe, expect, test } from "bun:test";

import { ALL_STATUS, ALL_TYPES, DEFAULT_FILTERS } from "@/lib/app-state";
import type { Filters } from "@/lib/app-state";
import {
  appliedFilters,
  bestRelief,
  difficultyLabel,
  filterCount,
  hasSecondaryFilters,
  resetFilters,
} from "@/lib/filter-summary";
import { DE } from "@/lib/i18n/dictionaries";

const filters = (over: Partial<Filters> = {}): Filters => ({
  ...DEFAULT_FILTERS,
  ...over,
});

describe("appliedFilters", () => {
  test("nothing applied, nothing listed – period, sort and search included", () => {
    expect(appliedFilters(filters(), DE)).toEqual([]);
    expect(
      appliedFilters(
        filters({ period: 3, query: "stelvio", sort: "name" }),
        DE,
      ),
    ).toEqual([]);
  });

  test("one chip per criterion, one per road label", () => {
    const chips = appliedFilters(
      filters({
        difficulty: [2, 4],
        favoritesOnly: true,
        maxTraffic: 2,
        maxValleyTmax: 26,
        maxWetDays: 8,
        minBeauty: 4,
        minElevation: 2000,
        minFame: 5,
        ranges: ["Jura", "Vogesen"],
        status: ["open", "risky"],
        tags: ["carfree", "glacier"],
        types: ["pass", "spur"],
      }),
      DE,
    );
    expect(chips.map((c) => c.label)).toEqual([
      "nur Gemerkte",
      "Jura, Vogesen",
      "gut oder eingeschränkt",
      "Pass, Stichstraße",
      "Autofrei",
      "Gletscherstraße",
      "Schwierigkeit 2–4",
      "ab 2.000 m",
      "Verkehr bis 2",
      "Schönheit ab 4",
      "Bekanntheit nur 5",
      "Tal unter 26 °C",
      "Regentage bis 8 von 15",
    ]);
    expect(new Set(chips.map((c) => c.key)).size).toBe(chips.length);
  });

  test("clearing a chip lifts exactly that filter", () => {
    const f = filters({
      difficulty: [3, 3],
      status: ["closed"],
      tags: ["carfree", "toll"],
      types: ["valley"],
    });
    const chips = appliedFilters(f, DE);
    const by = (key: string) => chips.find((c) => c.key === key)!.clear(f);
    expect(by("status").status).toEqual(ALL_STATUS);
    expect(by("status").types).toEqual(["valley"]);
    expect(by("types").types).toEqual(ALL_TYPES);
    expect(by("tag:carfree").tags).toEqual(["toll"]);
    expect(by("difficulty").difficulty).toEqual([1, 5]);
    expect(by("difficulty").tags).toEqual(["carfree", "toll"]);
  });

  test("difficultyLabel", () => {
    expect(difficultyLabel([3, 3], DE)).toBe("Schwierigkeit 3");
    expect(difficultyLabel([1, 4], DE)).toBe("Schwierigkeit 1–4");
  });
});

describe("filterCount", () => {
  test("counts the chips the row lists, the period and the sort excluded", () => {
    expect(filterCount(filters(), DE)).toBe(0);
    expect(
      filterCount(filters({ period: 3, query: "x", sort: "name" }), DE),
    ).toBe(0);
    expect(
      filterCount(
        filters({ maxTraffic: 2, minElevation: 2000, tags: ["toll"] }),
        DE,
      ),
    ).toBe(3);
  });
});

describe("hasSecondaryFilters", () => {
  test("opens the second half for every filter in it, and for none outside it", () => {
    expect(hasSecondaryFilters(filters())).toBe(false);
    expect(
      hasSecondaryFilters(filters({ minElevation: 2000, status: ["open"] })),
    ).toBe(false);
    // The surface chip sits behind "Weitere Filter" too; a link carrying
    // "Schotter" must not hide the control that lifts it.
    expect(hasSecondaryFilters(filters({ surfaces: ["gravel"] }))).toBe(true);
    expect(hasSecondaryFilters(filters({ tags: ["toll"] }))).toBe(true);
    expect(hasSecondaryFilters(filters({ maxTraffic: 2 }))).toBe(true);
    // A group toggled off and on again is its default, whatever the array.
    expect(hasSecondaryFilters(filters({ types: [...ALL_TYPES] }))).toBe(false);
  });
});

describe("resetFilters", () => {
  test("lifts every filter and keeps the period and the sort", () => {
    const f = filters({
      favoritesOnly: true,
      maxTraffic: 2,
      period: 3,
      query: "stelvio",
      sort: "name",
      types: ["spur"],
    });
    const reset = resetFilters(f);
    expect(filterCount(reset, DE)).toBe(0);
    expect(reset.query).toBe("");
    expect(reset.period).toBe(3);
    expect(reset.sort).toBe("name");
  });
});

// A stand-in for the row count: lifting the height bound brings 40 roads
// back, lifting the traffic bound 9.
const countWith = (patch: Partial<Filters>) => {
  const f = { ...filters({ maxTraffic: 2, minElevation: 2000 }), ...patch };
  return (f.minElevation === 0 ? 40 : 0) + (f.maxTraffic === 5 ? 9 : 0);
};

describe("bestRelief", () => {
  test("names the one filter that brings the most back", () => {
    const relief = bestRelief(
      filters({ maxTraffic: 2, minElevation: 2000 }),
      countWith,
      DE,
    );
    expect(relief?.chip.key).toBe("elevation");
    expect(relief?.n).toBe(40);
  });

  test("no relief when nothing is applied, and none that brings nothing back", () => {
    expect(bestRelief(filters(), countWith, DE)).toBeUndefined();
    expect(bestRelief(filters({ minBeauty: 4 }), () => 0, DE)).toBeUndefined();
  });
});
