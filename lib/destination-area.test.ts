import { describe, expect, test } from "bun:test";

import {
  areaScore,
  areaText,
  areaVerdict,
  destinationsOfTown,
  homeAreasOf,
  membersOf,
  RISKY_WEIGHT,
} from "@/lib/destination";
import { DE } from "@/lib/i18n/dictionaries";
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

  test("the outline holds the centre and every member, and the box the outline", () => {
    const m = membersOf(area, passes, tours, towns);
    const [west, south, east, north] = m.bounds;
    // Five kilometres past the westernmost point, the centre …
    expect(west).toBeLessThan(10);
    expect(west).toBeGreaterThan(9.9);
    // … and past the easternmost member.
    expect(east).toBeGreaterThan(edge.lon);
    // The ring is closed, and every vertex of it lies inside the box.
    expect(m.outline[0]).toEqual(m.outline.at(-1));
    for (const [lon, lat] of m.outline) {
      expect(lon).toBeGreaterThanOrEqual(west);
      expect(lon).toBeLessThanOrEqual(east);
      expect(lat).toBeGreaterThanOrEqual(south);
      expect(lat).toBeLessThanOrEqual(north);
    }
  });
});

const slugs = (list: readonly Destination[]) => list.map((d) => d.slug);

describe("destinationsOfTown and homeAreasOf", () => {
  const [, other, away] = towns;
  /** An area centred on the town "other", 25 km east of the test area's centre. */
  const around = (slug: string, baseTowns: string[]): Destination => ({
    ...area,
    baseTowns,
    center: { lat: other!.lat, lon: other!.lon },
    slug,
  });
  const membersFor = (list: readonly Destination[]) =>
    Object.fromEntries(
      list.map((d) => [d.slug, membersOf(d, passes, tours, towns)]),
    );

  test("names the areas a town lies in, the ones calling it a base first", () => {
    const list = [area, around("b", ["other"])];
    const members = membersFor(list);
    expect(slugs(destinationsOfTown(other!, list, members))).toEqual([
      "b",
      "test",
    ]);
    expect(destinationsOfTown(away!, list, members)).toEqual([]);
  });

  test("lists a town under every area calling it a base", () => {
    const list = [
      area,
      around("b", ["other"]),
      { ...area, baseTowns: ["other"], slug: "c" },
    ];
    const members = membersFor(list);
    // Both bases, the nearer centre first; the area it only lies in is left out.
    expect(slugs(homeAreasOf(other!, list, members))).toEqual(["b", "c"]);
  });

  test("and a town no area calls a base under the nearest one it lies in", () => {
    const list = [{ ...area, baseTowns: [] }, around("b", [])];
    const members = membersFor(list);
    expect(slugs(destinationsOfTown(other!, list, members))).toEqual([
      "b",
      "test",
    ]);
    expect(slugs(homeAreasOf(other!, list, members))).toEqual(["b"]);
    expect(homeAreasOf(away!, list, members)).toEqual([]);
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
    expect(areaText(v, DE)).toBe("1 von 3 Straßen gut");
    expect(areaText(areaVerdict([], years, PERIOD), DE)).toBe(
      "keine Straße im Gebiet",
    );
  });
});
