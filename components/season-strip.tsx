import {
  GRADE_LABEL,
  MONTH_INITIALS,
  periodIndex,
  periodLabel,
  PERIODS,
  seasonSummary,
} from "@/lib/status";
import type { Grade } from "@/lib/status";
import type { Period } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The whole year of one pass or tour in 24 cells, so "when" is answered
 * without clicking. The fill is the rideability and nothing else: green for
 * "gut", amber for "eingeschränkt", hollow for "oft gesperrt" like the
 * circles on the map – a closure is a different kind of statement, not one
 * more step on the ramp. The pass's best window is not a fourth fill but a
 * mark under the green cells: "beste Zeit" is a distinction of a stretch,
 * not a grade of the cell. The current half-month is outlined, so the strip
 * still works without hue.
 */
const CELL: Record<Grade, string> = {
  best: "bg-status-open",
  closed: "bg-status-closed/12 ring-1 ring-status-closed/45 ring-inset",
  good: "bg-status-open",
  limited: "bg-status-risky",
};

/** The mark under a cell in the best window; same token as the underline the panel had before. */
export const BEST_MARK = "bg-foreground/55";

export const SeasonStrip = ({
  grades,
  current,
  size = "row",
  className,
}: {
  /** 24 grades, index 0 = early January. */
  grades: Grade[];
  /** Outlined half-month; usually the selected period. */
  current?: Period;
  /** `row`: 96 px, no labels. `panel`: full width with month initials. */
  size?: "row" | "panel";
  className?: string;
}) => {
  const panel = size === "panel";
  const currentIndex = current === undefined ? -1 : periodIndex(current);
  const label = [
    seasonSummary(grades),
    current !== undefined && grades[currentIndex]
      ? `${periodLabel(current)}: ${GRADE_LABEL[grades[currentIndex]]}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn(panel ? "w-full" : "w-24", className)}>
      <div
        role="img"
        aria-label={label}
        className={cn("flex gap-px", panel ? "h-4" : "h-2")}
      >
        {grades.map((grade, i) => (
          <span
            key={PERIODS[i]}
            className={cn(
              "relative flex-1 rounded-xs",
              CELL[grade],
              i === currentIndex &&
                "outline-foreground z-10 outline-1 outline-offset-1",
            )}
          />
        ))}
      </div>
      {/* The best-window mark: one segment per cell, so a run that wraps
          around the turn of the year draws as two bars by itself. */}
      {grades.some((g) => g === "best") && (
        <div
          aria-hidden
          className={cn("flex gap-px", panel ? "mt-1 h-0.5" : "mt-px h-0.5")}
        >
          {grades.map((grade, i) => (
            <span
              key={PERIODS[i]}
              className={cn(
                "flex-1 rounded-full",
                grade === "best" && BEST_MARK,
              )}
            />
          ))}
        </div>
      )}
      {panel && (
        <div
          aria-hidden
          className="text-muted-foreground text-2xs mt-0.5 flex leading-none"
        >
          {MONTH_INITIALS.map((m, i) => (
            <span key={m + String(i)} className="flex-1 text-center">
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
