"use client";

import { SeasonStrip } from "@/components/season-strip";
import { StatusBadge } from "@/components/status-badge";
import { cellAt } from "@/lib/status";
import type { Year } from "@/lib/status";
import type { Period } from "@/lib/types";

/**
 * The "when" answer, boxed: the verdict for the chosen half-month, why it is
 * that, and the whole year under it.
 *
 * One box for a pass, a tour and a base. The three had a copy each and they
 * drifted the way copies do – the same badge, the same border, the same gap,
 * and three different ideas of what goes between them. What differs between
 * the three is only the sentence and what the year was derived from, so that
 * is what the box takes; everything that makes it *the* verdict box is here.
 *
 * `bar` and the children are the two places a caller may add to it: the
 * destination block puts its grade bar above the strip and the sentence that
 * says what the strip is graded against below it. Both belong inside the box,
 * because outside it they would read as something the strip does not explain.
 */
export const VerdictBox = ({
  year,
  period,
  best,
  text,
  bar,
  children,
}: {
  /** The graded year: the badge and the strip both read it. */
  year: Year | undefined;
  period: Period;
  /**
   * The best window as `bestText` writes it, next to the badge. A tour names
   * none: it is only as good as its worst pass in every half-month, and the
   * strip is the honest form of that.
   */
  best?: string | null;
  /** The one sentence under the badge: why the verdict is what it is. */
  text?: string | null;
  /** Between the sentence and the strip. */
  bar?: React.ReactNode;
  /** Under the strip: what the strip has to be read with. */
  children?: React.ReactNode;
}) => (
  <div className="bg-muted/40 border-border/70 mt-3 flex flex-col gap-2 rounded-lg border p-3">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <StatusBadge cell={cellAt(year, period)} period={period} />
      {best && <span className="text-muted-foreground text-xs">{best}</span>}
    </div>
    {text && (
      <p className="text-muted-foreground text-xs leading-relaxed">{text}</p>
    )}
    {bar}
    <SeasonStrip cells={year?.cells ?? []} current={period} size="panel" />
    {children}
  </div>
);
