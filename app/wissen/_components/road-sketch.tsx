import type { Sketch } from "@/lib/docs/sketch";
import { cn } from "@/lib/utils";

/**
 * The app's roads as a line drawing (lib/docs/sketch.ts), coloured by the
 * page's tokens so it follows the OS scheme like the map does. The summits are
 * one path of zero-length strokes with round caps: a dot each, and the stroke
 * width stays the same however the drawing is scaled.
 */
export const RoadSketch = ({
  className,
  fill = false,
  sketch,
}: {
  className?: string;
  /** Cover the box (crop the drawing); fitted, the drawing keeps to the right. */
  fill?: boolean;
  sketch: Sketch;
}) => (
  <svg
    aria-hidden
    className={cn("wissen-sketch", className)}
    preserveAspectRatio={fill ? "xMidYMid slice" : "xMaxYMid meet"}
    viewBox={`0 0 ${sketch.width} ${sketch.height}`}
  >
    <path className="wissen-sketch-roads" d={sketch.roads} />
    <path
      className="wissen-sketch-summits"
      d={sketch.summits.map(([x, y]) => `M${x} ${y}h0`).join("")}
    />
  </svg>
);
