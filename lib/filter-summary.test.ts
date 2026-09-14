import { describe, expect, test } from "bun:test";

import { ALL_STATUS, ALL_TYPES, DEFAULT_FILTERS } from "@/lib/app-state";
import type { Filters } from "@/lib/app-state";
import { appliedFilters, difficultyLabel } from "@/lib/filter-summary";

const filters = (over: Partial<Filters> = {}): Filters => ({
  ...DEFAULT_FILTERS,
  ...over,
});

describe("appliedFilters", () => {
  test("nothing applied, nothing listed – period, sort and search included", () => {
    expect(appliedFilters(filters())).toEqual([]);
    expect(
      appliedFilters(filters({ period: 3, query: "stelvio", sort: "name" })),
    ).toEqual([]);
  });

  test("one chip per criterion, one per road label", () => {
    const chips = appliedFilters(
      filters({
        difficulty: [2, 4],
        favoritesOnly: true,
        maxTraffic: 2,
        maxValleyTmax: 26,
        maxWetPct: 53,
        minBeauty: 4,
        minElevation: 2000,
        minFame: 5,
        status: ["open", "risky"],
        tags: ["carfree", "glacier"],
        types: ["pass", "spur"],
      }),
    );
    expect(chips.map((c) => c.label)).toEqual([
      "nur Gemerkte",
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
    const chips = appliedFilters(f);
    const by = (key: string) => chips.find((c) => c.key === key)!.clear(f);
    expect(by("status").status).toEqual(ALL_STATUS);
    expect(by("status").types).toEqual(["valley"]);
    expect(by("types").types).toEqual(ALL_TYPES);
    expect(by("tag:carfree").tags).toEqual(["toll"]);
    expect(by("difficulty").difficulty).toEqual([1, 5]);
    expect(by("difficulty").tags).toEqual(["carfree", "toll"]);
  });

  test("difficultyLabel", () => {
    expect(difficultyLabel([3, 3])).toBe("Schwierigkeit 3");
    expect(difficultyLabel([1, 4])).toBe("Schwierigkeit 1–4");
  });
});
