/**
 * The fan: an area's roads named round its outline, each with a thin line to
 * its dot.
 *
 * Where roads crowd – the Dolomites at zoom 7, the Maurienne – the names on
 * the dots collide and MapLibre keeps a few. Pointing at an area (or opening
 * it) lays every road it holds out in two columns beside the outline instead,
 * the way a printed map names a crowded valley in its margin (boundary
 * labelling; interactively, excentric labelling). It is never there at rest:
 * a line on this map reads as a road first, and two dozen of them on every
 * area would be the clutter this is meant to clear.
 *
 * Two pure halves, both decided here: which area is fanned out now
 * (`fanTarget`) and where each name goes on the screen (`fanLayout`).
 * `FanOverlay` (components/map/fan-overlay.tsx) projects the points, draws
 * the result and reports the pointer back – it decides nothing itself.
 */
import type { Selection } from "@/lib/app-state";
import { statusRank } from "@/lib/status";
import type { Status } from "@/lib/types";

/** A point on the screen, in CSS pixels from the map's top-left corner. */
export interface Px {
  x: number;
  y: number;
}

/** One road the fan names, where its dot is on the screen. */
export interface FanRoad {
  slug: string;
  name: string;
  status: Status;
  classic: boolean;
  at: Px;
}

/** A road placed: its dot, where its name stands and on which side. */
export interface FanEntry extends FanRoad {
  /** The end of the line at the name: the name stands left of it on the left side, right of it on the right. */
  label: Px;
  side: "left" | "right";
}

export interface Fan {
  entries: FanEntry[];
  /** How many roads did not fit on the screen; said as "+ n weitere" under a column. */
  more: number;
  /** Where that line stands, if there is one. */
  moreAt: (Px & { side: "left" | "right" }) | null;
}

/** What the map does not cover: the panels' share of the screen comes off each side. */
export interface FanView {
  width: number;
  height: number;
  /** One name's row height; a finger needs more than `FAN.step`. */
  step?: number;
  inset: { top: number; right: number; bottom: number; left: number };
}

export const FAN = {
  /** A rough width per character, for deciding whether a column fits at all. */
  charPx: 7,
  /** The dot, the padding and the line's end beside a name, in px. */
  chrome: 30,
  /** From the outline's edge to the end of a line, in px. */
  gap: 28,
  /** Kept free at the edges of what the panels leave. */
  margin: 8,
  /** One name's row height in a column, in px. */
  step: 24,
} as const;

/** How wide a name's label is, near enough to decide which side has room. */
const widthOf = (name: string) => name.length * FAN.charPx + FAN.chrome;

/** Rideable first, then the classics, then by name: who keeps a place when the screen is short. */
const byWeight = (a: FanRoad, b: FanRoad) =>
  statusRank(a.status) - statusRank(b.status) ||
  Number(b.classic) - Number(a.classic) ||
  a.name.localeCompare(b.name);

/**
 * Spreads names that want to stand at `ideal` heights over a column from
 * `top` to `bottom`, `step` apart, in their order: each as near its own dot as
 * the others let it, so the lines run nearly level and do not cross. Pushed
 * down from the top first, then up from the bottom; a column that is too
 * long for the room is the caller's to shorten.
 */
export const spread = (
  ideal: readonly number[],
  top: number,
  bottom: number,
  step: number,
): number[] => {
  const ys = ideal.map((y) => Math.min(Math.max(y, top), bottom));
  for (let i = 1; i < ys.length; i += 1)
    ys[i] = Math.max(ys[i]!, ys[i - 1]! + step);
  if (ys.length > 0 && ys.at(-1)! > bottom) ys[ys.length - 1] = bottom;
  for (let i = ys.length - 2; i >= 0; i -= 1)
    ys[i] = Math.min(ys[i]!, ys[i + 1]! - step);
  return ys;
};

/**
 * Where every name goes. The roads left of the outline's middle are named on
 * its left, the others on its right, each column sorted by height so the
 * lines run level; a side with no room for its widest name gives its roads
 * to the other. When the screen holds fewer rows than there are roads, the
 * rideable ones and the classics keep their place and the rest are counted.
 */
export const fanLayout = (
  roads: readonly FanRoad[],
  outline: readonly Px[],
  view: FanView,
): Fan => {
  if (roads.length === 0 || outline.length === 0)
    return { entries: [], more: 0, moreAt: null };
  const step = view.step ?? FAN.step;
  const xs = outline.map((p) => p.x);
  const west = Math.min(...xs);
  const east = Math.max(...xs);
  const middle = (west + east) / 2;
  const top = view.inset.top + FAN.margin + step / 2;
  const bottom = view.height - view.inset.bottom - FAN.margin - step / 2;
  const rows = Math.max(1, Math.floor((bottom - top) / step) + 1);

  const widest = Math.max(...roads.map((r) => widthOf(r.name)));
  const roomLeft = west - FAN.gap - widest >= view.inset.left + FAN.margin;
  const roomRight =
    east + FAN.gap + widest <= view.width - view.inset.right - FAN.margin;
  // With room on one side only, that side; with room on neither, the wider.
  const wider =
    west - view.inset.left > view.width - view.inset.right - east
      ? "left"
      : "right";
  const sides: ("left" | "right")[] =
    roomLeft && roomRight
      ? ["left", "right"]
      : [roomRight ? "right" : roomLeft ? "left" : wider];

  // Who is named at all: as many as the columns hold, the weightiest first,
  // keeping a row for the count when some are left over.
  const capacity = rows * sides.length;
  const ranked = roads.toSorted(byWeight);
  const kept =
    ranked.length > capacity ? ranked.slice(0, capacity - 1) : ranked;
  const more = roads.length - kept.length;

  const sideOf = (r: FanRoad): "left" | "right" =>
    sides.length === 1 ? sides[0]! : r.at.x < middle ? "left" : "right";
  const columns = { left: [] as FanRoad[], right: [] as FanRoad[] };
  for (const r of kept) columns[sideOf(r)].push(r);
  // A side with more roads than rows hands the ones nearest the middle over.
  if (sides.length === 2) {
    const [full, other] =
      columns.left.length > rows
        ? (["left", "right"] as const)
        : (["right", "left"] as const);
    const extra = columns[full].length - rows;
    if (extra > 0) {
      const byMiddle = columns[full].toSorted(
        (a, b) => Math.abs(a.at.x - middle) - Math.abs(b.at.x - middle),
      );
      const moved = new Set(byMiddle.slice(0, extra).map((r) => r.slug));
      columns[other].push(...columns[full].filter((r) => moved.has(r.slug)));
      columns[full] = columns[full].filter((r) => !moved.has(r.slug));
    }
  }

  // The count takes the last row of the shorter column.
  const moreSide =
    sides.length === 1
      ? sides[0]!
      : columns.left.length <= columns.right.length
        ? "left"
        : "right";
  const entries: FanEntry[] = [];
  const bottoms: Record<"left" | "right", number> = { left: top, right: top };
  for (const side of ["left", "right"] as const) {
    const column = columns[side].toSorted((a, b) => a.at.y - b.at.y);
    const ys = spread(
      column.map((r) => r.at.y),
      top,
      more > 0 && side === moreSide ? bottom - step : bottom,
      step,
    );
    const x = side === "left" ? west - FAN.gap : east + FAN.gap;
    for (const [i, r] of column.entries())
      entries.push({ ...r, label: { x, y: ys[i]! }, side });
    bottoms[side] = ys.at(-1) ?? top - step;
  }
  return {
    entries,
    more,
    moreAt:
      more > 0
        ? {
            side: moreSide,
            x: moreSide === "left" ? west - FAN.gap : east + FAN.gap,
            y: bottoms[moreSide] + step,
          }
        : null,
  };
};

/** What decides which area is fanned out. */
export interface FanInput {
  hovered: Selection | null;
  selection: Selection | null;
  /** The area fanned out now, if any. */
  current: string | null;
  /** Whether the pointer is on one of the fan's names. */
  overFan: boolean;
  /** Whether a road belongs to an area – the fan's own roads keep it open. */
  holds: (area: string, road: string) => boolean;
}

/**
 * Which area is fanned out: the one pointed at; the one already fanned out
 * while the pointer is on its names or on one of its roads, so moving from
 * the outline to a name does not close it on the way; else the one that is
 * open in the panel. `null` is the map at rest.
 *
 * The component waits a moment before it acts on a `null` (or on a fall back
 * to the open area): the pointer crosses a few pixels of nothing between the
 * outline and a name, and a fan that shut there could never be reached.
 */
export const fanTarget = ({
  current,
  holds,
  hovered,
  overFan,
  selection,
}: FanInput): string | null => {
  if (hovered?.kind === "destination") return hovered.slug;
  if (current && overFan) return current;
  if (current && hovered?.kind === "pass" && holds(current, hovered.slug))
    return current;
  return selection?.kind === "destination" ? selection.slug : null;
};
