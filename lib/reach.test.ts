import { describe, expect, test } from "bun:test";

import { reachBand, REACH_MAX_KM, reachWeight } from "@/lib/geo";
import {
  byDistance,
  inBands,
  reachCount,
  reachCounts,
  reachedPasses,
  reachedTours,
  reachedTowns,
  rideable,
  withinReach,
} from "@/lib/reach";
import type { Grade } from "@/lib/status";
import {
  makePass,
  makeTour,
  makeTown,
  ORIGIN,
  PERIOD,
  yearsOf,
} from "@/test/fixtures";

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

describe("reachedPasses", () => {
  const passes = [
    makePass("near", 5),
    makePass("day", 30),
    makePass("far", 70),
    makePass("beyond", 120),
  ];
  const years = yearsOf(passes.map((p) => [p.slug, "best"] as [string, Grade]));
  const reached = reachedPasses(ORIGIN, passes, years, PERIOD);

  test("stops at the reach, not at the old radius", () => {
    expect(reached.map((r) => r.pass.slug)).toEqual(["near", "day", "far"]);
  });

  test("ranks the nearer of two equal passes first, without excluding the far one", () => {
    expect(reached.map((r) => r.pass.slug)).toEqual(["near", "day", "far"]);
  });

  test("a better far pass can still out-rank a dull near one", () => {
    const mixed = reachedPasses(
      ORIGIN,
      [
        makePass("dull", 5, { beauty: 1, fame: 1 }),
        makePass("gem", 60, { beauty: 5, fame: 5 }),
      ],
      yearsOf([
        ["dull", "best"],
        ["gem", "best"],
      ]),
      PERIOD,
    );
    expect(mixed[0]!.pass.slug).toBe("gem");
  });

  test("a pass panel leaves its own road out", () => {
    expect(
      reachedPasses(ORIGIN, passes, years, PERIOD, "near").map(
        (r) => r.pass.slug,
      ),
    ).not.toContain("near");
  });

  test("a pass without a graded year is not reachable at all", () => {
    expect(reachedPasses(ORIGIN, passes, yearsOf([]), PERIOD)).toEqual([]);
  });
});

describe("the two readings of one measurement", () => {
  // A dull pass at the door and a gem at the edge of a day's ride: the ranked
  // list and the nearest-first list disagree, which is the whole point of
  // keeping both (docs/plans/31-panel-model.md, "Optional against deliberate").
  const reached = reachedPasses(
    ORIGIN,
    [
      makePass("dull", 5, { beauty: 1, fame: 1 }),
      makePass("gem", 40, { beauty: 5, fame: 5 }),
    ],
    yearsOf([
      ["dull", "best"],
      ["gem", "best"],
    ]),
    PERIOD,
  );

  test("ranked puts the better one first", () => {
    expect(reached.map((r) => r.pass.slug)).toEqual(["gem", "dull"]);
  });

  test("nearest-first puts the closer one first, from the same value", () => {
    expect(byDistance(reached).map((r) => r.pass.slug)).toEqual([
      "dull",
      "gem",
    ]);
  });

  test("bands group in order and keep every reached thing", () => {
    const bands = inBands(reached);
    expect(bands.map((b) => b.band)).toEqual(["door", "day"]);
    expect(bands.flatMap((b) => b.items)).toHaveLength(reached.length);
    expect(bands[0]!.maxKm).toBe(18);
  });
});

describe("reachCount", () => {
  const passes = [makePass("a", 5), makePass("b", 30), makePass("c", 120)];
  const years = yearsOf([
    ["a", "best"],
    ["b", "limited"],
    ["c", "best"],
  ]);

  test("counts the reachable passes by grade and nothing else", () => {
    expect(reachCount(ORIGIN, passes, years, PERIOD)).toEqual({
      best: 1,
      closed: 0,
      good: 0,
      limited: 1,
    });
    expect(rideable(reachCount(ORIGIN, passes, years, PERIOD))).toBe(1);
  });

  test("the 24 counts are tallied from seasons already in hand", () => {
    const counts = reachCounts(reachedPasses(ORIGIN, passes, years, PERIOD));
    expect(counts).toHaveLength(24);
    expect(counts.every((c) => c.best === 1 && c.limited === 1)).toBe(true);
  });
});

describe("reachedTowns", () => {
  // Two candidate bases for a road at the origin, and a cluster of eight more
  // passes 100 km east. `rich` sits at 30 km, so the cluster is 70 km from it
  // and inside its reach; `poor` sits at 8 km, where the same cluster is 92 km
  // away and out of it. The nearer town is therefore the worse base, which is
  // exactly the case a plain distance sort gets backwards.
  const passes = [
    makePass("here", 0),
    ...Array.from({ length: 8 }, (_, i) => makePass(`p${i}`, 100 + i * 0.1)),
  ];
  const years = yearsOf(passes.map((p) => [p.slug, "best"] as [string, Grade]));
  const towns = [makeTown("poor", 8), makeTown("rich", 30)];
  const reached = reachedTowns(ORIGIN, towns, passes, years, PERIOD);

  test("a town is judged by what it reaches, not only by how near it is", () => {
    const rich = reached.find((t) => t.town.slug === "rich")!;
    const poor = reached.find((t) => t.town.slug === "poor")!;
    expect(rich.rideable).toBeGreaterThan(poor.rideable);
    expect(rich.score).toBeGreaterThan(poor.score);
    expect(reached[0]!.town.slug).toBe("rich");
  });

  test("it keeps two numbers per town and no pass objects", () => {
    // What the old `basesFor` allocated a 24-cell `ReachedPass` per reachable
    // pass per candidate to arrive at.
    expect(Object.keys(reached[0]!).toSorted()).toEqual([
      "band",
      "km",
      "rideable",
      "score",
      "total",
      "town",
    ]);
  });

  test("the reach cut-off is the same one", () => {
    expect(
      reachedTowns(
        ORIGIN,
        [makeTown("far", REACH_MAX_KM + 10)],
        passes,
        years,
        PERIOD,
      ),
    ).toEqual([]);
  });

  test("a town panel does not offer itself as a base", () => {
    expect(
      reachedTowns(ORIGIN, towns, passes, years, PERIOD, "poor").map(
        (t) => t.town.slug,
      ),
    ).toEqual(["rich"]);
  });
});

describe("reachedTours", () => {
  const tours = [makeTour("runde", ["a"]), makeTour("weit", ["b"])];
  const years = yearsOf(
    [],
    [
      ["runde", "best"],
      ["weit", "best"],
    ],
  );

  test("reads the server's line-to-point measurement and bands it", () => {
    const reached = reachedTours(
      [
        { km: 60, slug: "weit" },
        { km: 4, slug: "runde" },
      ],
      tours,
      years,
      PERIOD,
    );
    expect(reached.map((r) => r.tour.slug)).toEqual(["runde", "weit"]);
    expect(reached.map((r) => r.band)).toEqual(["door", "trip"]);
  });

  test("a slug the page no longer knows is dropped rather than guessed at", () => {
    expect(
      reachedTours([{ km: 4, slug: "weg" }], tours, years, PERIOD),
    ).toEqual([]);
  });
});

describe("withinReach", () => {
  const passes = [makePass("a", 5), makePass("b", 30)];
  const tours = [makeTour("runde", ["a"])];
  const towns = [makeTown("ort", 10)];
  const years = yearsOf(
    [
      ["a", "best"],
      ["b", "best"],
    ],
    [["runde", "best"]],
  );
  const opts = {
    passes,
    period: PERIOD,
    tourReach: [{ km: 4, slug: "runde" }],
    tours,
    towns,
    years,
  };

  test("answers all three kinds from one point", () => {
    const reach = withinReach(ORIGIN, opts);
    expect(reach.passes).toHaveLength(2);
    expect(reach.tours).toHaveLength(1);
    expect(reach.towns).toHaveLength(1);
  });

  test("what a block above already ranks comes back empty", () => {
    // The two `skip*` booleans the nearby block used to take, said once and in
    // the place that does the measuring.
    expect(
      withinReach(ORIGIN, { ...opts, claimed: ["passes"] }).passes,
    ).toEqual([]);
    expect(withinReach(ORIGIN, { ...opts, claimed: ["towns"] }).towns).toEqual(
      [],
    );
  });
});
