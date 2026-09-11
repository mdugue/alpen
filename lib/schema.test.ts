import { describe, expect, test } from "bun:test";

import { Pass } from "@/lib/schema";

/**
 * The rules that only the parent's `type` can decide, and that therefore live
 * in `Pass`'s refinement rather than in `Ascent` (plan 14). Everything else the
 * schemas say is exercised by `bun run data:check` against the real files.
 */
const road = (over: Record<string, unknown>) => ({
  ascents: [],
  beauty: 3,
  classicAscent: "",
  country: "IT",
  difficulty: 3,
  elevation: 1500,
  fame: 3,
  lat: 46,
  lon: 10,
  name: "Teststraße",
  note: "",
  region: "Dolomiten",
  season: null,
  slug: "teststrasse",
  traffic: 3,
  type: "pass",
  ...over,
});
const climb = { from: { lat: 46.1, lon: 10.1 }, label: "Von unten" };
const traverse = { ...climb, km: 17, to: { lat: 45.9, lon: 9.9 } };
const issues = (input: unknown) =>
  Pass.safeParse(input).error?.issues.map((i) => i.message) ?? [];

describe("Pass", () => {
  test("a climb ends at the marker and says nothing more", () => {
    expect(Pass.safeParse(road({ ascents: [climb] })).success).toBe(true);
    expect(issues(road({ ascents: [traverse] })).join(" ")).toContain(
      "to und km gehören nicht dazu",
    );
  });

  test("a traverse names where it ends and how long it is", () => {
    const balcony = { ascents: [traverse], type: "balcony" };
    expect(Pass.safeParse(road(balcony)).success).toBe(true);
    expect(issues(road({ ...balcony, ascents: [climb] })).join(" ")).toContain(
      "braucht Ende (to) und Länge (km)",
    );
  });

  test("a check may only widen the limits its own validator reads", () => {
    const ascentCheck = { minPeakAt: 0.5, note: "endet am Berghaus" };
    const tourCheck = { maxKmDelta: 0.25, note: "Länge inkl. Zufahrt" };
    expect(
      Pass.safeParse(road({ ascents: [{ ...climb, check: ascentCheck }] }))
        .success,
    ).toBe(true);
    expect(
      issues(road({ ascents: [{ ...climb, check: tourCheck }] })).join(" "),
    ).toContain("kennt die Tour-Grenzen nicht");
    expect(
      issues(
        road({
          ascents: [{ ...traverse, check: ascentCheck }],
          type: "balcony",
        }),
      ).join(" "),
    ).toContain("maxKmDelta");
  });

  test("type is required and a label may not repeat", () => {
    const { type, ...withoutType } = road({});
    expect(type).toBe("pass");
    expect(Pass.safeParse(withoutType).success).toBe(false);
    expect(Pass.safeParse(road({ tags: ["toll", "toll"] })).success).toBe(
      false,
    );
    expect(Pass.safeParse(road({ tags: ["toll", "carfree"] })).success).toBe(
      true,
    );
  });
});
