import type { ElevationProfile, RouteGeometry } from "@/lib/types";

/**
 * What the stored geometry says about the character of one ascent, beyond the
 * figures of its profile line: how many hairpins it climbs through, how the
 * gradient is spread over its length, whether it gives height back on the
 * way, and which side of the mountain it climbs. All four are read off what
 * the repo already holds – the routed road and the hundred DEM samples – so
 * nothing here is fetched, and the page derives them with the detail files
 * (`lib/detail-assets.ts`) instead of storing a second copy.
 *
 * They are measurements of a routed line and a terrain model, not of the road,
 * and the panel says so: a hairpin is a turn the line makes, the rhythm is a
 * class rather than a number, and the facing is the direction from the start
 * to the top.
 */
export interface AscentShape {
  /** Turns of at least `HAIRPIN_TURN_DEG` within `HAIRPIN_WINDOW_M` of road. */
  hairpins: number;
  /** How the gradient is spread over the climb, see `rhythmOf`. */
  rhythm: Rhythm;
  /** Height given back on the way up, in m; 0 below `DIP_MIN_M`. */
  dip: number;
  /**
   * The side of the mountain the climb is on, as one of eight compass points:
   * a road that climbs northwards is on the south side.
   */
  facing: Facing;
}

export const RHYTHMS = [
  "steady",
  "steepening",
  "easing",
  "stepped",
  "irregular",
] as const;
export type Rhythm = (typeof RHYTHMS)[number];

export const FACINGS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export type Facing = (typeof FACINGS)[number];

/** How far the line is walked in one step when it is resampled, in m. */
const STEP_M = 10;
/**
 * A hairpin is a turn of this much heading within `HAIRPIN_WINDOW_M` of road.
 * Calibrated on the climbs whose bends are numbered on the road: the Stelvio
 * from Prad (48), Alpe d'Huez (21) and the San Boldo (18).
 */
export const HAIRPIN_TURN_DEG = 150;
export const HAIRPIN_WINDOW_M = 120;
/** A loss on the way up smaller than this is the terrain model's noise. */
export const DIP_MIN_M = 60;
/**
 * Below this gradient a kilometre counts as flat, for the stepped rhythm: a
 * climb that rests on the way.
 */
const FLAT_PCT = 2.5;
/** Difference of the first and last third that makes a climb steepen or ease. */
const TREND_PCT = 2;
/** Spread of the kilometre gradients above which a climb is irregular. */
const SPREAD_PCT = 2.6;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** The line in local metres, resampled to one point every `STEP_M`. */
const resample = (geom: RouteGeometry): [number, number][] => {
  const lat0 = geom[0]?.[0] ?? 0;
  const kx = 111_320 * Math.cos(toRad(lat0));
  const ky = 110_570;
  const pts = geom.map(([lat, lon]) => [lon * kx, lat * ky] as const);
  const out: [number, number][] = [];
  let carry = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    if (out.length === 0) out.push([ax, ay]);
    let at = STEP_M - carry;
    while (at <= len) {
      out.push([ax + ((bx - ax) * at) / len, ay + ((by - ay) * at) / len]);
      at += STEP_M;
    }
    carry = len - (at - STEP_M);
  }
  return out;
};

/**
 * The hairpins of a routed line: walk it in ten-metre steps and count every
 * stretch of `HAIRPIN_WINDOW_M` that turns by `HAIRPIN_TURN_DEG` or more,
 * then skip past it so one bend is counted once. A switchback drawn with a
 * short straight between its two halves still turns 180° inside the window;
 * a sweeping curve does not.
 */
export const hairpinsOf = (geom: RouteGeometry): number => {
  const pts = resample(geom);
  const heading: number[] = [];
  for (let i = 1; i < pts.length; i += 1)
    heading.push(
      Math.atan2(pts[i]![1] - pts[i - 1]![1], pts[i]![0] - pts[i - 1]![0]),
    );
  const turn: number[] = [];
  for (let i = 1; i < heading.length; i += 1) {
    let d = heading[i]! - heading[i - 1]!;
    d =
      ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) -
      Math.PI;
    turn.push(d);
  }
  const window = Math.round(HAIRPIN_WINDOW_M / STEP_M);
  const limit = toRad(HAIRPIN_TURN_DEG);
  let count = 0;
  let i = 0;
  while (i + window <= turn.length) {
    let sum = 0;
    for (let j = i; j < i + window; j += 1) sum += turn[j]!;
    if (Math.abs(sum) >= limit) {
      count += 1;
      i += window;
    } else i += 1;
  }
  return count;
};

/** The elevations smoothed over three samples, as `steepestKm` reads them. */
const smoothed = (ele: number[]) =>
  ele.map((_, i) => {
    const from = Math.max(0, i - 1);
    const to = Math.min(ele.length - 1, i + 1);
    let sum = 0;
    for (let k = from; k <= to; k += 1) sum += ele[k]!;
    return sum / (to - from + 1);
  });

/** Elevation at a distance along the profile, interpolated. */
const eleAt = (dist: number[], ele: number[], km: number) => {
  let j = 1;
  while (j < dist.length - 1 && dist[j]! < km) j += 1;
  const d0 = dist[j - 1]!;
  const d1 = dist[j]!;
  const t = d1 === d0 ? 0 : Math.min(1, Math.max(0, (km - d0) / (d1 - d0)));
  return ele[j - 1]! + (ele[j]! - ele[j - 1]!) * t;
};

/** The gradient of every full kilometre of the profile, in percent. */
const kmGradients = (profile: ElevationProfile): number[] => {
  const ele = smoothed(profile.ele);
  const total = profile.dist.at(-1) ?? 0;
  const out: number[] = [];
  for (let k = 0; k + 1 <= total; k += 1)
    out.push(
      (eleAt(profile.dist, ele, k + 1) - eleAt(profile.dist, ele, k)) / 10,
    );
  return out;
};

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : 0;

/**
 * How the gradient is spread over the climb, as one of five classes – a class
 * and not a number, because a kilometre of a hundred DEM samples is good for
 * a tendency and not for a figure:
 *
 * - `stepped`: it rests on the way – a kilometre in the middle below
 *   `FLAT_PCT`, or height given back.
 * - `steepening` / `easing`: the last third is `TREND_PCT` steeper or flatter
 *   than the first.
 * - `irregular`: the kilometres spread by more than `SPREAD_PCT`.
 * - `steady`: none of these.
 *
 * Climbs shorter than three kilometres are steady by definition: there is no
 * third to compare.
 */
export const rhythmOf = (profile: ElevationProfile, dip: number): Rhythm => {
  const g = kmGradients(profile);
  if (g.length < 3) return "steady";
  // The first and the last kilometre are where the route meets the village
  // and the summit car park; a flat one there says nothing about the climb.
  const inner = g.slice(1, -1);
  const rests = inner.some(
    (x, i) => x < FLAT_PCT && (inner[i + 1] ?? 99) < FLAT_PCT,
  );
  if (dip > 0 || rests) return "stepped";
  const third = Math.max(1, Math.floor(g.length / 3));
  const trend = mean(g.slice(-third)) - mean(g.slice(0, third));
  if (trend >= TREND_PCT) return "steepening";
  if (trend <= -TREND_PCT) return "easing";
  const m = mean(g);
  const spread = Math.sqrt(mean(g.map((x) => (x - m) ** 2)));
  return spread > SPREAD_PCT ? "irregular" : "steady";
};

/**
 * Height given back on the way up: every drop of the smoothed profile from a
 * high point to the next low point, summed where one drop is at least
 * `DIP_MIN_M`. Smaller drops are the terrain model's noise at a gorge wall.
 */
export const dipOf = (profile: ElevationProfile): number => {
  const ele = smoothed(profile.ele);
  let total = 0;
  let peak = ele[0] ?? 0;
  let low = peak;
  for (const e of ele) {
    if (e > peak) {
      if (peak - low >= DIP_MIN_M) total += peak - low;
      peak = e;
      low = e;
    } else if (e < low) low = e;
  }
  if (peak - low >= DIP_MIN_M) total += peak - low;
  return Math.round(total / 10) * 10;
};

/**
 * The side of the mountain the climb is on: the compass point opposite the
 * direction from the start to the top, in eight sectors.
 */
export const facingOf = (geom: RouteGeometry): Facing => {
  const [lat0, lon0] = geom[0]!;
  const [lat1, lon1] = geom.at(-1)!;
  const dx = (lon1 - lon0) * Math.cos(toRad((lat0 + lat1) / 2));
  const dy = lat1 - lat0;
  // Bearing of the climb, clockwise from north; the side faces the other way.
  const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
  const side = (bearing + 180 + 360) % 360;
  return FACINGS[Math.round(side / 45) % 8]!;
};

/** All four, for one ascent with its route and its profile. */
export const ascentShape = (
  geom: RouteGeometry,
  profile: ElevationProfile,
): AscentShape => {
  const dip = dipOf(profile);
  return {
    dip,
    facing: facingOf(geom),
    hairpins: hairpinsOf(geom),
    rhythm: rhythmOf(profile, dip),
  };
};
