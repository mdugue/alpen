/**
 * The climbs a tour line rides, measured on its own height profile – the
 * second half of `analyze-coverage.ts --tours` after the saddles.
 *
 * The saddle report asks OSM which `mountain_pass` and `saddle` nodes from
 * 600 m lie on the line. That finds crossings, and only named ones high
 * enough: the summit a permanent climbs to a checkpoint and back, a climb up
 * an escarpment onto a plateau, a 790 m top in the Erzgebirge – none of those
 * is a saddle node, so the Stoneman Miriquidi Road came out of it with two
 * entries for thirteen climbs. Here the line is sampled, the DEM gives every
 * sample a height, and every rise of at least `CLIMB_MIN_GAIN` metres is a
 * climb, matched against the entries by where it tops out. What the report
 * prints is the curator's list; nothing here becomes data.
 */
import { haversine } from "../../lib/geo";
import type { LatLon, RouteGeometry } from "../../lib/types";

/** A climb gains at least this much from its foot to its top. */
export const CLIMB_MIN_GAIN = 150;
/**
 * A climb ends where the road has dropped this far below its top: less, and
 * the DEM's noise and a short dip on a long climb would cut it in two.
 */
export const CLIMB_DROP = 40;
/**
 * A climb steadier than this is a valley road gaining height, not a climb:
 * 200 m over 30 km up the Ohře is no Stich.
 */
export const CLIMB_MIN_GRADE = 2;
/**
 * A climb steeper than this over its whole length is no road but the DEM: a
 * tunnel under a ridge or a gorge road the 25 m cells fill with the slope
 * above it (the Viamala gave 36 %). The steepest classics stay below 13 %.
 */
export const CLIMB_MAX_GRADE = 16;
/**
 * The foot moves up to the last point within this share of the gain above
 * the lowest one, so a long flat run-in does not water the gradient down.
 */
const FOOT_SLACK = 0.05;
/** The line is sampled this often – fine enough for a 1 km ramp. */
export const SAMPLE_KM = 0.25;
/** An entry whose marker lies this close to a climb's top is that climb. */
export const TOP_MATCH_KM = 1;
/**
 * A climb whose top lies this close to one of an entry's ascents is part of
 * that ascent: the hump before the Brenner at Schönberg, a top the DEM puts
 * 2 km up a ridge from the road's marker. Matching the marker alone printed
 * them as roads without an entry.
 */
export const ON_ASCENT_KM = 0.15;
/** No ascent is longer than this; entries farther off are not asked. */
const REACH_KM = 40;
/**
 * An entry whose marker the way up passes this close, in the climb's top
 * quarter, is that climb too: the road goes on rising past the col, as the
 * Ma-10 does for 3 km past the Coll de Femenia towards Lluc.
 */
export const ON_WAY_KM = 0.3;
const TOP_SHARE = 0.75;
/**
 * A climb whose line comes back within this distance of a point on its way up
 * is ridden up and back down: a spur, not a crossing.
 */
const BACK_KM = 0.1;

export interface Sample extends LatLon {
  /** Distance along the line from its start. */
  km: number;
}

/** Points every `step` km along the line, its first and last included. */
export const resample = (
  line: RouteGeometry,
  step: number = SAMPLE_KM,
): Sample[] => {
  const [first] = line;
  if (!first) return [];
  const out: Sample[] = [{ km: 0, lat: first[0], lon: first[1] }];
  let walked = 0;
  let next = step;
  for (let i = 1; i < line.length; i += 1) {
    const [aLat, aLon] = line[i - 1] ?? first;
    const [bLat, bLon] = line[i] ?? first;
    const seg = haversine({ lat: aLat, lon: aLon }, { lat: bLat, lon: bLon });
    // A repeated point has no length to put a sample on.
    const end = seg > 0 ? walked + seg : -1;
    while (next <= end) {
      const f = (next - walked) / seg;
      out.push({
        km: next,
        lat: aLat + (bLat - aLat) * f,
        lon: aLon + (bLon - aLon) * f,
      });
      next += step;
    }
    walked += seg;
  }
  const [lat, lon] = line.at(-1) ?? first;
  if (walked - (out.at(-1)?.km ?? 0) > step / 10)
    out.push({ km: walked, lat, lon });
  return out;
};

/**
 * Heights with the DEM's gaps filled from their neighbours. A cell without
 * data read as 0 m would be a 1500 m drop in the middle of a pass – a climb
 * cut in two and a second one measured from sea level.
 */
export const fillGaps = (heights: readonly (number | null)[]): number[] => {
  const known = heights.flatMap((h, i) => (h === null ? [] : [i]));
  return heights.map((h, i) => {
    if (h !== null) return h;
    const before = known.findLast((k) => k < i);
    const after = known.find((k) => k > i);
    const a = before === undefined ? null : heights[before]!;
    const b = after === undefined ? null : heights[after]!;
    if (a === null || before === undefined) return b ?? 0;
    if (b === null || after === undefined) return a;
    return a + ((b - a) * (i - before)) / (after - before);
  });
};

export interface Climb {
  foot: Sample & { ele: number };
  top: Sample & { ele: number };
  gain: number;
  /** Mean gradient from foot to top, in per cent. */
  grade: number;
  /** Ridden up and back down the same road: a spur. */
  outAndBack: boolean;
  /** The samples from foot to top. */
  way: (Sample & { ele: number })[];
}

/** Does the line after the top pass back over the way up? */
const comesBack = (
  samples: readonly Sample[],
  foot: number,
  top: number,
): boolean => {
  const up = samples.slice(foot, top);
  const topKm = samples[top]?.km ?? 0;
  const climbKm = topKm - (samples[foot]?.km ?? 0);
  // Half the climb's length back down is enough to tell: a crossing has left
  // the way up by then, a spur is still on it.
  const probe = samples.find((s) => s.km >= topKm + Math.min(climbKm / 2, 2));
  return probe !== undefined && up.some((u) => haversine(u, probe) <= BACK_KM);
};

/**
 * Every rise of at least `minGain` metres along the samples, foot to top. A
 * climb runs from the lowest point since the last climb to the highest point
 * before the road drops `CLIMB_DROP` below it; the next one starts from there.
 */
export const climbsOf = (
  samples: readonly Sample[],
  heights: readonly number[],
  minGain: number = CLIMB_MIN_GAIN,
): Climb[] => {
  const at = (i: number) => ({
    ...samples[i]!,
    ele: heights[i] ?? 0,
  });
  const out: Climb[] = [];
  const close = (low: number, top: number) => {
    const t = at(top);
    if (t.ele - at(low).ele < minGain) return;
    const slack = at(low).ele + (t.ele - at(low).ele) * FOOT_SLACK;
    let foot = low;
    for (let j = low; j < top; j += 1) if ((heights[j] ?? 0) <= slack) foot = j;
    const f = at(foot);
    const gain = t.ele - f.ele;
    const run = (t.km - f.km) * 1000;
    const grade = run > 0 ? Math.round((gain / run) * 1000) / 10 : 0;
    if (grade < CLIMB_MIN_GRADE || grade > CLIMB_MAX_GRADE) return;
    out.push({
      foot: f,
      gain: Math.round(gain),
      grade,
      outAndBack: comesBack(samples, foot, top),
      top: t,
      way: samples.slice(foot, top + 1).map((_, k) => at(foot + k)),
    });
  };
  let foot = 0;
  let top = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const h = heights[i] ?? 0;
    if (h > (heights[top] ?? 0)) top = i;
    else if ((heights[top] ?? 0) - h >= CLIMB_DROP) {
      close(foot, top);
      // The next climb starts at the lowest point after this top.
      foot = i;
      top = i;
      continue;
    }
    // Below the foot, what came before is no climb: start again from here.
    if (h < (heights[foot] ?? 0)) {
      foot = i;
      top = i;
    }
  }
  close(foot, top);
  return out;
};

export interface ClimbMatch<P> {
  climb: Climb;
  /** The entry that tops out where the climb does, if any. */
  entry: P | null;
  /** That entry is in the tour's `passes` or `touches`. */
  named: boolean;
}

/** The shortest distance from a point to a line, in km (flat over a segment). */
export const distanceToSegments = (p: LatLon, line: RouteGeometry): number => {
  const kx = 111.32 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110.57;
  let best = Infinity;
  for (let i = 0; i < line.length; i += 1) {
    const [aLat, aLon] = line[i]!;
    const [bLat, bLon] = line[i + 1] ?? [aLat, aLon];
    const ax = (aLon - p.lon) * kx;
    const ay = (aLat - p.lat) * ky;
    const dx = (bLon - aLon) * kx;
    const dy = (bLat - aLat) * ky;
    const len = dx * dx + dy * dy;
    const f =
      len > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(ax + f * dx, ay + f * dy));
  }
  return best;
};

/**
 * Each climb with the entry it belongs to: the one whose marker lies at its
 * top, else one whose marker the way up passes near the top, else one whose
 * ascent runs over its top (`ascentsOf` hands the stored lines). A tour's
 * own entries are asked first at every step, so a climb shared by two roads
 * counts for the one the tour names.
 */
export const matchClimbs = <P extends LatLon & { slug: string }>(
  climbs: readonly Climb[],
  entries: readonly P[],
  tour: { passes: readonly string[]; touches?: readonly string[] },
  ascentsOf: (p: P) => readonly RouteGeometry[] = () => [],
): ClimbMatch<P>[] => {
  const named = new Set([...tour.passes, ...(tour.touches ?? [])]);
  const own = entries.filter((p) => named.has(p.slug));
  const ordered = [...own, ...entries.filter((p) => !named.has(p.slug))];
  /** The nearest marker at the top. */
  const atTop = (climb: Climb, among: readonly P[]): P | null => {
    let entry: P | null = null;
    let best = TOP_MATCH_KM;
    for (const p of among) {
      const d = haversine(p, climb.top);
      if (d <= best) {
        best = d;
        entry = p;
      }
    }
    return entry;
  };
  return climbs.map((climb) => {
    let entry = atTop(climb, own) ?? atTop(climb, entries);
    const high = climb.foot.ele + climb.gain * TOP_SHARE;
    entry ??=
      ordered.find(
        (p) =>
          haversine(p, climb.top) <= REACH_KM &&
          climb.way.some((w) => w.ele >= high && haversine(w, p) <= ON_WAY_KM),
      ) ??
      ordered.find(
        (p) =>
          haversine(p, climb.top) <= REACH_KM &&
          ascentsOf(p).some(
            (l) => distanceToSegments(climb.top, l) <= ON_ASCENT_KM,
          ),
      ) ??
      null;
    return { climb, entry, named: entry !== null && named.has(entry.slug) };
  });
};
