import { describe, expect, test } from "bun:test";

import {
  basesFor,
  destinationAt,
  destinationText,
  gradeOf,
} from "@/lib/destination";
import { reachBand, REACH_MAX_KM, reachWeight } from "@/lib/geo";
import { PERIODS } from "@/lib/status";
import type { Grade, Year, YearCell, Years } from "@/lib/status";
import type { Pass, Town } from "@/lib/types";

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

/** A cell with `n` rideable passes and nothing else. */
const counts = (n: number) => ({ best: n, closed: 0, good: 0, limited: 0 });

describe("gradeOf", () => {
  test("grades against this base's own peak, not an absolute count", () => {
    // The measurement that forced this: an absolute threshold put 47 of 48
    // towns at the top grade in September. A base is at its best when it is
    // near its *own* best, whether that best is forty passes or two.
    expect(gradeOf(counts(40), 40)).toBe("best");
    expect(gradeOf(counts(2), 2)).toBe("best");
  });

  test("so a big base in a weak half-month is not at its best", () => {
    // Ten rideable passes is a lot in absolute terms and a quarter of what
    // this base offers in September; the strip has to show that dip.
    expect(gradeOf(counts(10), 40)).toBe("limited");
    expect(gradeOf(counts(22), 40)).toBe("good");
  });

  test("nothing rideable is a closed destination, whatever the peak", () => {
    expect(gradeOf({ best: 0, closed: 9, good: 0, limited: 3 }, 40)).toBe(
      "closed",
    );
    expect(gradeOf(counts(0), 0)).toBe("closed");
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

/** A town `km` east of (46, 10). */
const town = (slug: string, km: number): Town =>
  ({
    country: "IT",
    lat: 46,
    lon: 10 + km / 77.3,
    name: slug,
    slug,
    tags: [],
    why: "",
  }) as unknown as Town;

describe("basesFor", () => {
  // Two candidate bases for a road at the origin, and a cluster of eight more
  // passes 100 km east. `rich` sits at 30 km, so the cluster is 70 km from it
  // and inside its reach; `poor` sits at 8 km, where the same cluster is 92 km
  // away and out of it. The nearer town is therefore the worse base, which is
  // exactly the case a plain distance sort gets backwards.
  const passes = [
    pass("here", 0),
    ...Array.from({ length: 8 }, (_, i) => pass(`p${i}`, 100 + i * 0.1)),
  ];
  const y = years(passes.map((p) => [p.slug, "best"] as [string, Grade]));
  const bases = basesFor(
    { lat: 46, lon: 10 },
    [town("poor", 8), town("rich", 30)],
    passes,
    y,
    PERIODS[12]!,
  );

  test("groups the towns by the same bands", () => {
    expect(bases.total).toBe(2);
    expect(bases.bands.map((b) => b.band)).toEqual(["door", "day"]);
  });

  test("a town is judged by what it reaches, not only by how near it is", () => {
    const all = bases.bands.flatMap((b) => b.towns);
    const rich = all.find((t) => t.town.slug === "rich")!;
    const poor = all.find((t) => t.town.slug === "poor")!;
    expect(rich.rideable).toBeGreaterThan(poor.rideable);
    expect(rich.score).toBeGreaterThan(poor.score);
  });

  test("the reach cut-off is the same one", () => {
    const far = basesFor(
      { lat: 46, lon: 10 },
      [town("far", REACH_MAX_KM + 10)],
      passes,
      y,
      PERIODS[12]!,
    );
    expect(far.total).toBe(0);
  });

  test("a town panel does not offer itself as a base", () => {
    const self = basesFor(
      { lat: 46, lon: 10 },
      [town("poor", 8), town("rich", 30)],
      passes,
      y,
      PERIODS[12]!,
      "poor",
    );
    expect(self.bands.flatMap((b) => b.towns).map((t) => t.town.slug)).toEqual([
      "rich",
    ]);
  });
});
