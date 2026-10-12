import { describe, expect, test } from "bun:test";

import { dipOf, facingOf, hairpinsOf, rhythmOf } from "@/lib/ascent-shape";
import type { ElevationProfile, RouteGeometry } from "@/lib/types";

/** Metres to degrees at 46° N, close enough for a test line. */
const M_LAT = 1 / 110_570;
const M_LON = 1 / (111_320 * Math.cos((46 * Math.PI) / 180));

/**
 * A climb of `n` switchbacks: legs of `leg` metres running east and west in
 * turn, each a little further north, joined by a short northward step.
 */
const zigzag = (n: number, leg = 300, step = 30): RouteGeometry => {
  const pts: RouteGeometry = [];
  let x = 0;
  let y = 0;
  pts.push([46, 9]);
  for (let i = 0; i <= n; i += 1) {
    x += i % 2 === 0 ? leg : -leg;
    pts.push([46 + y * M_LAT, 9 + x * M_LON]);
    y += step;
    pts.push([46 + y * M_LAT, 9 + x * M_LON]);
  }
  return pts;
};

/** A profile from kilometre gradients, ten samples per kilometre. */
const profileOf = (pcts: number[]): ElevationProfile => {
  const dist = [0];
  const ele = [1000];
  for (const pct of pcts)
    for (let k = 0; k < 10; k += 1) {
      dist.push(+(dist.at(-1)! + 0.1).toFixed(2));
      ele.push(ele.at(-1)! + pct);
    }
  return {
    avgGradient: 0,
    dist,
    ele,
    elevationGain: 0,
    km: dist.at(-1)!,
    maxKmGradient: 0,
    start: ele[0]!,
    top: ele.at(-1)!,
  };
};

describe("hairpinsOf", () => {
  test("counts every switchback once", () => {
    expect(hairpinsOf(zigzag(12))).toBe(12);
    expect(hairpinsOf(zigzag(1))).toBe(1);
  });

  test("a straight road and a wide curve have none", () => {
    expect(
      hairpinsOf([
        [46, 9],
        [46.1, 9],
      ]),
    ).toBe(0);
    // A quarter circle of 1 km radius turns 90°, nowhere near a hairpin.
    const arc: RouteGeometry = Array.from({ length: 40 }, (_, i) => {
      const a = (i / 39) * (Math.PI / 2);
      return [46 + Math.sin(a) * 1000 * M_LAT, 9 + Math.cos(a) * 1000 * M_LON];
    });
    expect(hairpinsOf(arc)).toBe(0);
  });
});

describe("rhythmOf", () => {
  test("names the five classes", () => {
    expect(rhythmOf(profileOf([7, 7, 7, 7, 7, 7]), 0)).toBe("steady");
    expect(rhythmOf(profileOf([5, 5, 6, 8, 9, 9]), 0)).toBe("steepening");
    expect(rhythmOf(profileOf([9, 9, 8, 6, 5, 5]), 0)).toBe("easing");
    expect(rhythmOf(profileOf([7, 7, 1, 1, 7, 7]), 0)).toBe("stepped");
    expect(rhythmOf(profileOf([4, 11, 4, 11, 4, 11]), 0)).toBe("irregular");
  });

  test("height given back makes a climb stepped", () => {
    expect(rhythmOf(profileOf([7, 7, 7, 7, 7, 7]), 80)).toBe("stepped");
  });

  test("a single flat kilometre is a village, not a rest", () => {
    expect(rhythmOf(profileOf([7, 7, 1, 7, 7, 7]), 0)).toBe("steady");
  });
});

describe("dipOf", () => {
  test("sums the drops a climb gives back, ignoring the noise", () => {
    // A hundred metres down, a little less after the three-sample smoothing.
    expect(dipOf(profileOf([7, 7, -10, 7, 7]))).toBe(90);
    expect(dipOf(profileOf([7, 7, -3, 7, 7]))).toBe(0);
  });
});

describe("facingOf", () => {
  test("a road that climbs north is on the south side", () => {
    expect(
      facingOf([
        [46, 9],
        [46.1, 9],
      ]),
    ).toBe("s");
    expect(
      facingOf([
        [46, 9],
        [46, 9.1],
      ]),
    ).toBe("w");
    expect(
      facingOf([
        [46.1, 9.1],
        [46, 9],
      ]),
    ).toBe("ne");
  });
});
