import { REGIONS } from "@/lib/regions";
import type { Grade } from "@/lib/status";
import type { Status } from "@/lib/types";

/**
 * The overview, aggregated by region.
 *
 * At the zoom the app opens on, the Alps are a thousand kilometres wide and
 * the map draws 201 dots into them – a swarm in which everything is the same
 * size and, in a good half-month, very nearly the same colour. The product
 * paragraph's first question is "which **regions** are good in early
 * October", and a swarm cannot answer a question about regions: it answers
 * "here are some passes" and leaves the counting to the eye.
 *
 * So one mark per region is added *on top of* the dots rather than instead of
 * them. That is the deliberate half of the design: the dots carry where the
 * roads actually are, how they string along the valleys and where they crowd
 * — real information that any clustering would throw away, and the reason the
 * usual "collapse them into a bubble" answer is wrong here. The badge adds
 * the one thing the swarm cannot say, which is *how many of these are good
 * right now*, and it says it in the same stacked colours as the period
 * scrubber's histogram and the destination bar.
 *
 * It lives only where the swarm is unreadable: above `REGION_MAX_ZOOM` the
 * dots have separated enough to be counted by eye and the badges disappear
 * on their own. And it is a switch in the layers popover, because a reader
 * who prefers the bare swarm should be able to have it.
 */

/** Above this the pass dots are separate enough to read; the badges fade out. */
export const REGION_MAX_ZOOM = 7.4;

export interface RegionMark {
  region: string;
  lat: number;
  lon: number;
  /** How many of the currently listed roads sit in the region. */
  total: number;
  best: number;
  good: number;
  limited: number;
  closed: number;
}

interface Input {
  region: string;
  lat: number;
  lon: number;
  status: Status;
  grade?: Grade;
}

/**
 * One mark per region that has anything in it, at the centroid of the roads
 * that are actually listed – not at a fixed label point. A filtered map
 * should move its badges: "Dolomiten" over the three roads left of it after
 * a hard filter is the truthful position, and a fixed anchor would claim a
 * region is where it is not.
 */
export const regionMarks = (items: readonly Input[]): RegionMark[] => {
  const by = new Map<string, Input[]>();
  for (const it of items) {
    if (!REGIONS.includes(it.region as (typeof REGIONS)[number])) continue;
    const list = by.get(it.region);
    if (list) list.push(it);
    else by.set(it.region, [it]);
  }
  return REGIONS.flatMap((region) => {
    const list = by.get(region);
    if (!list || list.length === 0) return [];
    const n = list.length;
    return [
      {
        best: list.filter((i) => i.grade === "best").length,
        closed: list.filter((i) => i.status === "closed").length,
        good: list.filter((i) => i.grade === "good").length,
        lat: list.reduce((s, i) => s + i.lat, 0) / n,
        limited: list.filter((i) => i.status === "risky").length,
        lon: list.reduce((s, i) => s + i.lon, 0) / n,
        region,
        total: n,
      },
    ];
  });
};

/** How many roads of a region a rider would go out for right now. */
export const regionRideable = (m: RegionMark) => m.best + m.good;

/**
 * The badge's own word. It names the count first, because the count is the
 * answer: "14 gut" is what makes one region a better October than another.
 */
export const regionLabel = (m: RegionMark) =>
  `${m.region}\n${regionRideable(m)} von ${m.total} gut`;
