import { describe, expect, test } from "bun:test";

import {
  basesOf,
  destinationOf,
  destinationText,
  gradeOfBase,
} from "@/lib/destination";
import { REACH_MAX_KM } from "@/lib/geo";
import { reachedPasses, reachedTowns } from "@/lib/reach";
import type { Grade } from "@/lib/status";
import { makePass, makeTown, ORIGIN, PERIOD, yearsOf } from "@/test/fixtures";

/** A cell with `n` rideable passes and nothing else. */
const counts = (n: number) => ({ best: n, closed: 0, good: 0, limited: 0 });

describe("gradeOfBase", () => {
  test("grades against this base's own peak, not an absolute count", () => {
    // The measurement that forced this: an absolute threshold put 47 of 48
    // towns at the top grade in September. A base is at its best when it is
    // near its *own* best, whether that best is forty passes or two.
    expect(gradeOfBase(counts(40), 40)).toBe("best");
    expect(gradeOfBase(counts(2), 2)).toBe("best");
  });

  test("so a big base in a weak half-month is not at its best", () => {
    // Ten rideable passes is a lot in absolute terms and a quarter of what
    // this base offers in September; the strip has to show that dip.
    expect(gradeOfBase(counts(10), 40)).toBe("limited");
    expect(gradeOfBase(counts(22), 40)).toBe("good");
  });

  test("nothing rideable is a closed destination, whatever the peak", () => {
    expect(gradeOfBase({ best: 0, closed: 9, good: 0, limited: 3 }, 40)).toBe(
      "closed",
    );
    expect(gradeOfBase(counts(0), 0)).toBe("closed");
  });

  test("the two shares are an argument, which is what calibrates them", () => {
    // `scripts/analyze-destinations.ts` reads the same 24 cells at several
    // pairs of shares; at a peak of one the comparison is the absolute rule
    // that was tried first.
    expect(gradeOfBase(counts(22), 40, { best: 0.5, good: 0.2 })).toBe("best");
    expect(gradeOfBase(counts(4), 1, { best: 6, good: 3 })).toBe("good");
    expect(gradeOfBase(counts(6), 1, { best: 6, good: 3 })).toBe("best");
  });
});

describe("destinationOf", () => {
  const passes = [
    makePass("near", 5),
    makePass("day", 30),
    makePass("far", 70),
    makePass("beyond", 120),
  ];
  const years = yearsOf(passes.map((p) => [p.slug, "best"] as [string, Grade]));
  const d = destinationOf(reachedPasses(ORIGIN, passes, years, PERIOD), PERIOD);

  test("judges what lib/reach.ts measured and nothing further out", () => {
    expect(d.passes.map((r) => r.pass.slug)).toEqual(["near", "day", "far"]);
    expect(d.total).toBe(3);
  });

  test("groups by band in order and keeps every reached pass", () => {
    expect(d.bands.map((b) => b.band)).toEqual(["door", "day", "trip"]);
    expect(d.bands.flatMap((b) => b.items)).toHaveLength(d.total);
  });

  test("the derived year has one cell per half-month", () => {
    expect(d.year.cells).toHaveLength(24);
  });

  test("a base with nothing near says so", () => {
    const empty = destinationOf(
      reachedPasses({ lat: 0, lon: 0 }, passes, years, PERIOD),
      PERIOD,
    );
    expect(empty.total).toBe(0);
    expect(destinationText(empty)).toContain("Kein Pass");
  });

  test("the sentence names the counts the badge was made of", () => {
    expect(destinationText(d)).toContain("3 zur besten Zeit");
  });
});

describe("basesOf", () => {
  const passes = [
    makePass("here", 0),
    ...Array.from({ length: 8 }, (_, i) => makePass(`p${i}`, 100 + i * 0.1)),
  ];
  const years = yearsOf(passes.map((p) => [p.slug, "best"] as [string, Grade]));
  const bases = basesOf(
    reachedTowns(
      ORIGIN,
      [makeTown("poor", 8), makeTown("rich", 30)],
      passes,
      years,
      PERIOD,
    ),
  );

  test("groups the towns by the same bands", () => {
    expect(bases.total).toBe(2);
    expect(bases.bands.map((b) => b.band)).toEqual(["door", "day"]);
  });

  test("the reach cut-off is the same one", () => {
    expect(
      basesOf(
        reachedTowns(
          ORIGIN,
          [makeTown("far", REACH_MAX_KM + 10)],
          passes,
          years,
          PERIOD,
        ),
      ).total,
    ).toBe(0);
  });

  test("a town panel does not offer itself as a base", () => {
    const self = basesOf(
      reachedTowns(
        ORIGIN,
        [makeTown("poor", 8), makeTown("rich", 30)],
        passes,
        years,
        PERIOD,
        "poor",
      ),
    );
    expect(self.bands.flatMap((b) => b.items).map((t) => t.town.slug)).toEqual([
      "rich",
    ]);
  });
});
