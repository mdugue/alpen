import { describe, expect, test } from "bun:test";

import {
  ALL_STATUS,
  ALL_TYPES,
  DEFAULT_FILTERS,
  NO_FILTERS,
} from "@/lib/app-state";
import type { Filters } from "@/lib/app-state";
import {
  appliedFilters,
  bestRelief,
  difficultyLabel,
  filterCount,
  isStandard,
  standardFilters,
  CRITERIA,
  CRITERION_GROUPS,
  resetFilters,
} from "@/lib/filter-summary";
import { DE } from "@/lib/i18n/dictionaries";

const filters = (over: Partial<Filters> = {}): Filters => ({
  ...NO_FILTERS,
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

  test("one token per criterion, in the table's order", () => {
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
      "Jura, Vogesen",
      "nur Gemerkte",
      "Bekanntheit nur 5",
      "Schwierigkeit 2–4",
      "ab 2.000 m",
      "Pass, Stichstraße",
      "Autofrei + Gletscherstraße",
      "Verkehr bis 2",
      "Schönheit ab 4",
      "gut oder eingeschränkt",
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
    expect(by("tags").tags).toEqual([]);
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

describe("the classics the app opens on", () => {
  test("are one applied chip, named as on the map, and the reset lifts them", () => {
    const opening = { ...DEFAULT_FILTERS };
    expect(appliedFilters(opening, DE).map((c) => c.label)).toEqual([
      "Klassiker",
    ]);
    expect(appliedFilters(filters({ minFame: 3 }), DE)[0]?.label).toBe(
      "Bekanntheit ab 3",
    );
    expect(resetFilters(opening).minFame).toBe(1);
  });

  test("are the standard, and the way back to it keeps period, sort and search", () => {
    expect(isStandard({ ...DEFAULT_FILTERS }, DE)).toBe(true);
    expect(isStandard(filters({ minFame: 1 }), DE)).toBe(false);
    expect(isStandard(filters({ minFame: 3 }), DE)).toBe(false);
    expect(isStandard({ ...DEFAULT_FILTERS, maxTraffic: 2 }, DE)).toBe(false);
    // Period, sort and search are not filters the bar carries.
    expect(
      isStandard(
        { ...DEFAULT_FILTERS, period: 3, query: "x", sort: "name" },
        DE,
      ),
    ).toBe(true);
    const back = standardFilters(
      filters({ maxTraffic: 2, period: 3, query: "gal", sort: "name" }),
    );
    expect(back).toEqual({
      ...DEFAULT_FILTERS,
      period: 3,
      query: "gal",
      sort: "name",
    });
  });
});

describe("the criteria table", () => {
  test("names every applied filter once, in the table's order", () => {
    const keys = appliedFilters(
      filters({
        favoritesOnly: true,
        maxTraffic: 2,
        minElevation: 2000,
        minFame: 4,
        status: ["open"],
        tags: ["toll", "carfree"],
        tourTypes: ["loop"],
      }),
      DE,
    ).map((a) => a.key);
    const order = CRITERIA.map((c) => c.id as string);
    expect(keys).toEqual(
      keys.toSorted((a, b) => order.indexOf(a) - order.indexOf(b)),
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("tags");
  });

  test("joins the labels into one token, and its × lifts them all", () => {
    const f = filters({ tags: ["toll", "carfree"] });
    const tags = appliedFilters(f, DE).find((a) => a.key === "tags");
    expect(tags?.label).toContain(" + ");
    expect(tags?.clear(f).tags).toEqual([]);
  });

  test("lists every criterion under one of the four questions", () => {
    for (const c of CRITERIA) expect(CRITERION_GROUPS).toContain(c.group);
    expect(new Set(CRITERIA.map((c) => c.id)).size).toBe(CRITERIA.length);
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
