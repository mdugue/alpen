/**
 * Which single entity a pointer means.
 *
 * The hit areas overlap heavily – that is what they are for – so a pixel is
 * regularly answered by a pass dot, the name beside it, the ascent under both
 * and the tour band under that. Exactly one of them may open a panel, and the
 * rule that decides which is this module: a ranking by `HIT_GROUPS`, the
 * nearest mark within a group, and an ascent answered as its pass.
 *
 * It takes plain records rather than MapLibre features and a `project`
 * function rather than a map, so the rule behind every click on the map can be
 * read and tested without a WebGL context; `pass-map.tsx` queries the rendered
 * features once and asks.
 */

import type { Selection } from "@/lib/app-state";
import { HIT_GROUPS, LAYERS } from "@/lib/map-layers";

/**
 * How long a click waits before it selects, and how far the next one may sit
 * from it, for the two to count as one double click.
 *
 * A double click is MapLibre's zoom gesture, and the click that starts it must
 * not open a panel on the way in – so a click does not select at once: it
 * waits out this window, and a second click inside it drops the first instead
 * of selecting anything. MapLibre's own tap recognizer allows 500 ms and 30 px
 * between the two taps; the distance is taken from it, the time is not. Half a
 * second of lag in front of every panel is felt on every single click, while
 * the double click slow enough to leak past 300 ms is rare – and it ends on a
 * zoomed map either way.
 */
export const DOUBLE_MS = 300;
const DOUBLE_PX = 30;

/** Where and when the map was clicked. */
export interface Tap {
  t: number;
  x: number;
  y: number;
}

/**
 * Whether this click is the second half of a double click and therefore not a
 * pick at all. `null` for the first click of a session, which never is one.
 */
export const isDoubleClick = (previous: Tap | null, tap: Tap): boolean =>
  previous !== null &&
  tap.t - previous.t < DOUBLE_MS &&
  Math.hypot(tap.x - previous.x, tap.y - previous.y) < DOUBLE_PX;

/** One rendered feature, as much of it as the decision needs. */
export interface Hit {
  /** The layer that answered – what ranks the hit and names its kind. */
  layer: string;
  slug: string;
  /** Where the mark sits, for the tie-break; a line has no point of its own. */
  point: readonly [number, number] | null;
}

/** Screen coordinates, the units `at` and `project` share. */
interface Point {
  x: number;
  y: number;
}

const RANK = new Map(
  HIT_GROUPS.flatMap((group, i) => group.map((id) => [id, i] as const)),
);

/** An ascent belongs to its pass; every other kind answers for itself. */
const KIND: Record<keyof typeof LAYERS, Selection["kind"]> = {
  pass: "pass",
  route: "pass",
  tour: "tour",
  town: "town",
};

const OF_LAYER = new Map(
  Object.entries(LAYERS).flatMap(([kind, set]) =>
    [set.mark, set.hit, ...set.labels].map(
      (id) => [id, KIND[kind as keyof typeof LAYERS]] as const,
    ),
  ),
);

/**
 * The one entity under a point, across every hit layer at once.
 *
 * A line has no point to measure against, so it enters its group at distance
 * zero – which is right, because no two line layers share a group: the ascent
 * always beats the band it lies on.
 */
export const pick = (
  features: readonly Hit[],
  at: Point,
  project: (point: readonly [number, number]) => Point,
): Selection | null => {
  let best: Selection | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const f of features) {
    const rank = RANK.get(f.layer);
    const kind = OF_LAYER.get(f.layer);
    if (rank === undefined || kind === undefined || rank > bestRank) continue;
    if (!f.slug) continue;
    const p = f.point ? project(f.point) : null;
    const dist = p ? Math.hypot(p.x - at.x, p.y - at.y) : 0;
    if (rank === bestRank && dist >= bestDist) continue;
    bestRank = rank;
    bestDist = dist;
    best = { kind, slug: f.slug };
  }
  return best;
};
