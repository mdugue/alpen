import { describe, expect, test } from "bun:test";

import {
  areaScore,
  areaText,
  areaVerdict,
  destinationsOfTown,
  membersOf,
  RISKY_WEIGHT,
} from "@/lib/destination";
import { indexBySlug } from "@/lib/status";
import type { Destination } from "@/lib/types";
import { makePass, makeTour, makeTown, PERIOD, yearsOf } from "@/test/fixtures";

/**
 * The area half of `lib/destination.ts`: what a circle holds and how it is
 * judged. The fixture world lies on one line of latitude, so distance is
 * kilometres east of the origin.
 */

const near = makePass("near", 10, { beauty: 5 });
const edge = makePass("edge", 29, { beauty: 3 });
const far = makePass("far", 60, { beauty: 4 });
const passes = [near, edge, far];
const towns = [
  makeTown("base", 5),
  makeTown("other", 25),
  makeTown("away", 70),
];
const tours = [
  makeTour("inside", ["near"], { waypoints: [{ lat: 46, lon: 10.1 }] }),
  makeTour("outside", ["far"], { waypoints: [{ lat: 46, lon: 10.9 }] }),
];

const area: Destination = {
  access: "Bahn.",
  baseTowns: ["base"],
  center: { lat: 46, lon: 10 },
  character: "Testgebiet.",
  country: "IT",
  exclude: [],
  include: [],
  multiDay: "Drei Tage.",
  name: "Test",
  radiusKm: 30,
  slug: "test",
};

describe("membersOf", () => {
  test("takes what lies within the radius, plus include, minus exclude", () => {
    const m = membersOf(area, passes, tours, towns);
    expect(m.passes).toEqual(["near", "edge"]);
    expect(m.towns).toEqual(["base", "other"]);
    expect(m.tours).toEqual(["inside"]);
    const corrected = membersOf(
      { ...area, exclude: ["edge"], include: ["far"] },
      passes,
      tours,
      towns,
    );
    expect(corrected.passes).toEqual(["near", "far"]);
  });

  test("a base town beyond the radius is still a member", () => {
    const m = membersOf({ ...area, baseTowns: ["away"] }, passes, tours, towns);
    expect(m.towns).toEqual(["base", "other", "away"]);
  });

  test("the box holds the centre and every member", () => {
    const m = membersOf(area, passes, tours, towns);
    expect(m.bounds[0]).toBe(10);
    expect(m.bounds[2]).toBeCloseTo(edge.lon, 6);
  });
});

describe("destinationsOfTown", () => {
  test("names the areas a town lies in, the ones calling it a base first", () => {
    const other: Destination = { ...area, baseTowns: ["other"], slug: "b" };
    const members = {
      b: membersOf(other, passes, tours, towns),
      test: membersOf(area, passes, tours, towns),
    };
    expect(
      destinationsOfTown("other", [area, other], members).map((d) => d.slug),
    ).toEqual(["b", "test"]);
    expect(destinationsOfTown("away", [area, other], members)).toEqual([]);
  });
});

describe("areaScore and areaVerdict", () => {
  const years = yearsOf([
    ["near", "best"],
    ["edge", "limited"],
    ["far", "closed"],
  ]);
  const record = indexBySlug(passes);

  test("counts open roads whole, limited ones by the weight, closed ones not at all", () => {
    expect(areaScore(["near", "edge", "far"], record, years, PERIOD)).toBe(
      5 + RISKY_WEIGHT * 3,
    );
    expect(areaScore(["unknown"], record, years, PERIOD)).toBe(0);
  });

  test("the verdict counts the half-month and grades the year against the area's own peak", () => {
    const v = areaVerdict(["near", "edge", "far"], years, PERIOD);
    expect(v.total).toBe(3);
    expect(v.counts).toEqual({ best: 1, closed: 1, good: 0, limited: 1 });
    expect(v.peak).toBe(1);
    expect(v.year.cells).toHaveLength(24);
    expect(areaText(v)).toBe("1 von 3 Straßen gut");
    expect(areaText(areaVerdict([], years, PERIOD))).toBe(
      "keine Straße im Gebiet",
    );
  });
});
