import { describe, expect, test } from "bun:test";

import { destinationAt, destinationText, gradeOf } from "@/lib/destination";
import { reachBand, REACH_MAX_KM, reachWeight } from "@/lib/geo";
import { PERIODS } from "@/lib/status";
import type { Grade, Year, YearCell, Years } from "@/lib/status";
import type { Pass } from "@/lib/types";

const cell = (grade: Grade): YearCell => ({
  grade,
  reasons: [],
  snowy: false,
  status:
    grade === "closed" ? "closed" : grade === "limited" ? "risky" : "open",
});

const year = (grade: Grade): Year => ({
  best: null,
  cells: PERIODS.map(() => cell(grade)),
});

/** A pass `km` east of (46, 10); one degree of longitude there is ~77 km. */
const pass = (slug: string, km: number, extra: Partial<Pass> = {}): Pass =>
  ({
    ascents: [],
    beauty: 3,
    classicAscent: "",
    country: "IT",
    difficulty: 3,
    elevation: 2000,
    fame: 3,
    lat: 46,
    lon: 10 + km / 77.3,
    name: slug,
    note: "",
    region: "Zentralalpen",
    season: "",
    slug,
    traffic: 3,
    type: "pass",
    ...extra,
  }) as unknown as Pass;

const years = (entries: [string, Grade][]): Years => ({
  passes: Object.fromEntries(entries.map(([slug, g]) => [slug, year(g)])),
  tours: {},
});

describe("reach bands", () => {
  test("name the distance instead of cutting it", () => {
    expect(reachBand(5)).toBe("door");
    expect(reachBand(30)).toBe("day");
    expect(reachBand(70)).toBe("trip");
    expect(reachBand(REACH_MAX_KM + 1)).toBeNull();
  });

  test("the weight falls smoothly and never cliffs", () => {
    expect(reachWeight(0)).toBe(1);
    expect(reachWeight(REACH_MAX_KM)).toBe(0);
    // The old failure mode: 59 km and 61 km were worlds apart. They are now
    // within a few percent of each other, which is what they should be.
    expect(Math.abs(reachWeight(59) - reachWeight(61))).toBeLessThan(0.05);
    // And it is monotone.
    for (let km = 1; km < REACH_MAX_KM; km += 1)
      expect(reachWeight(km)).toBeLessThan(reachWeight(km - 1));
  });
});

describe("gradeOf", () => {
  test("counts rideable passes, it does not take a share", () => {
    // The whole reason this is absolute: a big base with a third of its
    // passes open beats a tiny one with all of its.
    const big = { best: 4, closed: 20, good: 4, limited: 2 };
    const small = { best: 2, closed: 0, good: 0, limited: 0 };
    expect(gradeOf(big)).toBe("best");
    expect(gradeOf(small)).toBe("limited");
  });

  test("nothing rideable is a closed destination", () => {
    expect(gradeOf({ best: 0, closed: 9, good: 0, limited: 3 })).toBe("closed");
  });
});

describe("destinationAt", () => {
  const passes = [
    pass("near", 5),
    pass("day", 30),
    pass("far", 70),
    pass("beyond", 120),
  ];
  const y = years([
    ["near", "best"],
    ["day", "best"],
    ["far", "best"],
    ["beyond", "best"],
  ]);
  const d = destinationAt({ lat: 46, lon: 10 }, passes, y, PERIODS[12]!);

  test("stops at the reach, not at the old radius", () => {
    expect(d.passes.map((r) => r.pass.slug)).toEqual(["near", "day", "far"]);
    expect(d.total).toBe(3);
  });

  test("groups by band in order and keeps every reached pass", () => {
    expect(d.bands.map((b) => b.band)).toEqual(["door", "day", "trip"]);
    expect(d.bands.flatMap((b) => b.passes).length).toBe(d.total);
  });

  test("ranks the nearer of two equal passes first, without excluding the far one", () => {
    const i = (slug: string) => d.passes.findIndex((r) => r.pass.slug === slug);
    expect(i("near")).toBeLessThan(i("day"));
    expect(i("day")).toBeLessThan(i("far"));
  });

  test("a better far pass can still out-rank a dull near one", () => {
    const mixed = destinationAt(
      { lat: 46, lon: 10 },
      [
        pass("dull", 5, { beauty: 1, fame: 1 }),
        pass("gem", 60, { beauty: 5, fame: 5 }),
      ],
      years([
        ["dull", "best"],
        ["gem", "best"],
      ]),
      PERIODS[12]!,
    );
    expect(mixed.passes[0]!.pass.slug).toBe("gem");
  });

  test("the derived year has one cell per half-month", () => {
    expect(d.year.cells).toHaveLength(24);
  });

  test("a base with nothing near says so", () => {
    const empty = destinationAt({ lat: 0, lon: 0 }, passes, y, PERIODS[12]!);
    expect(empty.total).toBe(0);
    expect(destinationText(empty)).toContain("Kein Pass");
  });

  test("the sentence names the counts the badge was made of", () => {
    expect(destinationText(d)).toContain("3 zur besten Zeit");
  });
});
