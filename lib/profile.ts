import { haversine } from "@/lib/geo";
import type { ElevationProfile, RouteGeometry } from "@/lib/types";

/**
 * The geometry of an elevation profile: how it is sampled from a route, and
 * the figures derived from the samples. `scripts/build-data.ts` uses this when
 * it writes `data/generated/profiles.json`, the panel uses it to place the
 * profile cursor on the map – so both agree on which road point sample `i` is
 * by construction rather than by convention.
 */

/** How many samples one profile has at most (one elevation call per point). */
export const PROFILE_POINTS = 100;

/** Indices into the route geometry that a profile is sampled at. */
function sampleIndices(length: number): number[] {
  const n = Math.min(PROFILE_POINTS, length);
  if (n < 2) return [0];
  const step = (length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(i * step));
}

/**
 * The route coordinates a profile was sampled at, in profile order. The route
 * itself already ships for the map, so the coordinates are derived here rather
 * than stored a second time in `profiles.json`.
 */
export function profileCoords(geom: RouteGeometry): RouteGeometry {
  return sampleIndices(geom.length).map((i) => geom[i]!);
}

/**
 * Cumulative distance per sample in km, measured **along the road** and not
 * from sample to sample. On a pass with hairpins the samples cut the corners:
 * a chord chain through the 48 bends of the Stelvio is a good two kilometres
 * short, which makes every gradient derived from it far too steep.
 */
export function profileDistances(geom: RouteGeometry): number[] {
  const cum = [0];
  for (let i = 1; i < geom.length; i++)
    cum.push(
      cum[i - 1]! +
        haversine(
          { lat: geom[i - 1]![0], lon: geom[i - 1]![1] },
          { lat: geom[i]![0], lon: geom[i]![1] },
        ),
    );
  return sampleIndices(geom.length).map((i) => +cum[i]!.toFixed(2));
}

/**
 * Steepest full kilometre in percent – the figure a rider braces for, which an
 * average gradient hides.
 *
 * It has to be read as an estimate, not as a measurement. The samples are
 * ~100 points of a Copernicus DEM, a few hundred metres apart and good for
 * ±20 m at a hairpin, and taking the *maximum* over ninety windows is exactly
 * the operation that picks the worst of that noise – a raw endpoint delta puts
 * the Stelvio at 15 % where riders measure 11. Two things keep the bias down:
 * the elevations are smoothed over three samples first, and each window's
 * slope is a least-squares fit through every sample it contains instead of
 * its two endpoints. What is left still leans high, which is why the panel
 * labels the whole profile section as sampled from a terrain model.
 *
 * Profiles shorter than a kilometre report their overall gradient.
 */
export function steepestKm(dist: number[], ele: number[]): number {
  const total = dist.at(-1) ?? 0;
  const overall = total > 0 ? (ele.at(-1)! - ele[0]!) / (total * 10) : 0;
  if (total <= 1 || dist.length < 3) return +overall.toFixed(1);

  const smooth = ele.map((_, i) => {
    const from = Math.max(0, i - 1);
    const to = Math.min(ele.length - 1, i + 1);
    let sum = 0;
    for (let k = from; k <= to; k++) sum += ele[k]!;
    return sum / (to - from + 1);
  });
  /** Elevation at an arbitrary distance, interpolated between two samples. */
  const eleAt = (km: number) => {
    let j = 1;
    while (j < dist.length - 1 && dist[j]! < km) j++;
    const d0 = dist[j - 1]!;
    const d1 = dist[j]!;
    const t = d1 === d0 ? 0 : (km - d0) / (d1 - d0);
    return smooth[j - 1]! + (smooth[j]! - smooth[j - 1]!) * t;
  };

  let best = -Infinity;
  for (let i = 0; i < dist.length - 1; i++) {
    const end = dist[i]! + 1;
    if (end > total) break;
    // Every sample in the window, plus the interpolated point at exactly 1 km.
    const xs = [dist[i]!];
    const ys = [smooth[i]!];
    for (let k = i + 1; k < dist.length && dist[k]! < end; k++) {
      xs.push(dist[k]!);
      ys.push(smooth[k]!);
    }
    xs.push(end);
    ys.push(eleAt(end));
    const mx = xs.reduce((a, c) => a + c, 0) / xs.length;
    const my = ys.reduce((a, c) => a + c, 0) / ys.length;
    let num = 0;
    let den = 0;
    for (let k = 0; k < xs.length; k++) {
      num += (xs[k]! - mx) * (ys[k]! - my);
      den += (xs[k]! - mx) ** 2;
    }
    // Slope in m per km; in percent that is a tenth of it.
    if (den > 0) best = Math.max(best, num / den / 10);
  }
  return +(best === -Infinity ? overall : best).toFixed(1);
}

/** Gradient of the sample step ending at `i`, in percent. */
export function stepGradient(profile: ElevationProfile, i: number): number {
  if (i < 1) return 0;
  const run = (profile.dist[i]! - profile.dist[i - 1]!) * 10;
  return run > 0 ? (profile.ele[i]! - profile.ele[i - 1]!) / run : 0;
}

/** The figures that follow from `dist` and `ele`; recomputed by the backfill. */
export function profileStats(dist: number[], ele: number[]) {
  const km = +(dist.at(-1) ?? 0).toFixed(1);
  return {
    km,
    avgGradient: km > 0 ? +((ele.at(-1)! - ele[0]!) / (km * 10)).toFixed(1) : 0,
    maxKmGradient: steepestKm(dist, ele),
  };
}
