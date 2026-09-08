import { describe, expect, test } from "bun:test";

import profilesJson from "@/data/generated/profiles.json";
import routesJson from "@/data/generated/routes.json";
import {
  PROFILE_POINTS,
  profileCoords,
  profileDistances,
  profileStats,
  steepestKm,
  stepGradient,
} from "@/lib/profile";
import type { ElevationProfile, RouteGeometry } from "@/lib/types";

const profiles = profilesJson as Record<string, ElevationProfile>;
const routes = routesJson as unknown as Record<string, RouteGeometry>;

/** A straight line east from (46, 10); `n` points, `stepM` metres apart. */
const straight = (n: number, stepM = 100): RouteGeometry =>
  Array.from(
    { length: n },
    (_, i) => [46, 10 + (i * stepM) / 77_500] as const,
  ).map(([lat, lon]) => [lat, +lon.toFixed(6)] as [number, number]);

describe("profileCoords", () => {
  test("keeps first and last point and caps the sample count", () => {
    const geom = straight(500);
    const pts = profileCoords(geom);
    expect(pts).toHaveLength(PROFILE_POINTS);
    expect(pts[0]).toEqual(geom[0]!);
    expect(pts.at(-1)).toEqual(geom.at(-1)!);
  });

  test("shorter routes are sampled point for point", () => {
    const geom = straight(7);
    expect(profileCoords(geom)).toEqual(geom);
  });

  test("as many coordinates as the stored profile has elevations", () => {
    for (const [key, p] of Object.entries(profiles)) {
      const geom = routes[key];
      if (!geom) continue;
      expect([key, profileCoords(geom).length]).toEqual([key, p.ele.length]);
    }
  });
});

describe("profileDistances", () => {
  test("measures along the road, not between the samples", () => {
    // A square wave: the samples land on every fourth point and would cut the
    // corners, so a chord chain comes out far shorter than the road.
    const geom: RouteGeometry = [];
    for (let i = 0; i < 400; i++)
      geom.push([46 + (i % 2) * 0.002, 10 + i * 0.0002]);
    const dist = profileDistances(geom);
    let chords = 0;
    const pts = profileCoords(geom);
    for (let i = 1; i < pts.length; i++)
      chords += Math.hypot(
        (pts[i]![0] - pts[i - 1]![0]) * 111,
        (pts[i]![1] - pts[i - 1]![1]) * 77,
      );
    expect(dist.at(-1)!).toBeGreaterThan(chords * 1.5);
  });

  test("starts at zero and never goes backwards", () => {
    const dist = profileDistances(straight(500));
    expect(dist[0]).toBe(0);
    for (let i = 1; i < dist.length; i++)
      expect(dist[i]!).toBeGreaterThan(dist[i - 1]!);
  });

  test("matches the distances stored for every profile", () => {
    for (const [key, p] of Object.entries(profiles)) {
      const geom = routes[key];
      if (!geom) continue;
      expect([key, profileDistances(geom)]).toEqual([key, p.dist]);
    }
  });
});

describe("steepestKm", () => {
  test("a constant 8 % ramp is 8 % everywhere", () => {
    const dist = Array.from({ length: 60 }, (_, i) => i * 0.2);
    const ele = dist.map((d) => 1000 + d * 80);
    expect(steepestKm(dist, ele)).toBeCloseTo(8, 1);
  });

  test("finds the steep kilometre inside an otherwise flat ascent", () => {
    // 10 km at 2 %, with kilometre 5 replaced by 14 %.
    const dist = Array.from({ length: 101 }, (_, i) => i * 0.1);
    let e = 1000;
    const ele = dist.map((d, i) => {
      // A 0.1 km step at g % gains g metres.
      if (i > 0) e += d > 5 && d <= 6 ? 14 : 2;
      return e;
    });
    expect(steepestKm(dist, ele)).toBeGreaterThan(12);
    expect(steepestKm(dist, ele)).toBeLessThan(15);
  });

  test("profiles under a kilometre report their overall gradient", () => {
    expect(steepestKm([0, 0.3, 0.6], [1000, 1030, 1060])).toBe(10);
  });

  test("is at least the average gradient of every stored ascent", () => {
    for (const [key, p] of Object.entries(profiles))
      expect([key, p.maxKmGradient >= p.avgGradient]).toEqual([key, true]);
  });
});

describe("profileStats", () => {
  test("derives km, average and steepest kilometre from the samples", () => {
    const dist = Array.from({ length: 51 }, (_, i) => i * 0.2);
    const ele = dist.map((d) => 500 + d * 70);
    expect(profileStats(dist, ele)).toEqual({
      km: 10,
      avgGradient: 7,
      maxKmGradient: 7,
    });
  });

  test("reproduces what is stored in profiles.json", () => {
    for (const [key, p] of Object.entries(profiles))
      expect([key, profileStats(p.dist, p.ele)]).toEqual([
        key,
        {
          km: p.km,
          avgGradient: p.avgGradient,
          maxKmGradient: p.maxKmGradient,
        },
      ]);
  });
});

describe("stepGradient", () => {
  const profile = {
    dist: [0, 0.5, 1],
    ele: [1000, 1050, 1050],
  } as ElevationProfile;

  test("percent over the step that ends at the index", () => {
    expect(stepGradient(profile, 1)).toBeCloseTo(10, 5);
    expect(stepGradient(profile, 2)).toBe(0);
  });

  test("the first sample has no step before it", () => {
    expect(stepGradient(profile, 0)).toBe(0);
  });
});
