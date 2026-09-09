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
 * without clicking. Four rungs, two hues: the pass's best window is the full
 * green, "gut" a tint of the same token, "eingeschränkt" amber, and "oft
 * gesperrt" hollow like the circles on the map – a closure is a different
 * kind of statement, not one more step on the ramp. The current half-month
 * is outlined, so the strip still works without hue.
 */
const CELL: Record<Grade, string> = {
  best: "bg-status-open",
  closed: "bg-status-closed/12 ring-1 ring-status-closed/45 ring-inset",
  good: "bg-status-open/40",
  limited: "bg-status-risky",
};

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
