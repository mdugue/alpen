import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  cellHint,
  GRADE_LABEL,
  MONTH_INITIALS,
  periodIndex,
  periodLabel,
  PERIODS,
  seasonSummary,
} from "@/lib/status";
import type { Grade, StatusReason } from "@/lib/status";
import type { Period } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The whole year of one pass or tour in 24 cells, so "when" is answered
 * without clicking. Three fills that differ in lightness as well as hue
 * (`--grade-*` in app/globals.css): deep green for the pass's best window,
 * light yellow for "gut", orange for "eingeschränkt" – and "oft gesperrt"
 * hollow with a red hairline, like the circles on the map, so a closure is
 * told apart by weight and a winter of them stays light. The current
 * half-month is outlined, so the strip still works without hue, and in the
 * panel every cell explains itself on hover.
 */
export const CELL: Record<Grade, string> = {
  best: "bg-grade-best",
  closed: "bg-status-closed/12 ring-1 ring-status-closed/45 ring-inset",
  good: "bg-grade-good",
  limited: "bg-grade-limited",
};

export const SeasonStrip = ({
  grades,
  reasons,
  current,
  size = "row",
  className,
}: {
  /** 24 grades, index 0 = early January. */
  grades: Grade[];
  /** The first reason per half-month, so a limited cell can name its caveat. */
  reasons?: (StatusReason | null)[];
  /** Outlined half-month; usually the selected period. */
  current?: Period;
  /** `row`: 96 px, no labels. `panel`: full width with month initials and cell tooltips. */
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

  const cell = (grade: Grade, i: number) => (
    <span
      key={PERIODS[i]}
      className={cn(
        "relative flex-1 rounded-xs",
        CELL[grade],
        i === currentIndex &&
          "outline-foreground z-10 outline-1 outline-offset-1",
      )}
    />
  );

  return (
    <div className={cn(panel ? "w-full" : "w-24", className)}>
      <div
        role="img"
        aria-label={label}
        className={cn("flex gap-px", panel ? "h-4" : "h-2")}
      >
        {grades.map((grade, i) =>
          panel ? (
            <Tooltip key={PERIODS[i]}>
              <TooltipTrigger render={cell(grade, i)} />
              <TooltipContent className="max-w-64">
                <div className="flex flex-col gap-0.5">
                  <p className="font-semibold">
                    {periodLabel(PERIODS[i]!)} · {GRADE_LABEL[grade]}
                  </p>
                  <p className="opacity-80">{cellHint(grade, reasons?.[i])}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            cell(grade, i)
          ),
        )}
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
