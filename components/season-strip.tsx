import {
  MONTH_INITIALS,
  periodIndex,
  periodLabel,
  PERIODS,
  seasonSummary,
  STATUS_LABEL,
} from "@/lib/status";
import type { Period, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The whole year of one pass or tour in 24 cells, so "when" is answered
 * without clicking. Colour carries the status, but never alone: "oft
 * gesperrt" is hollow like the circles on the map and the current half-month
 * is outlined, so the strip still works without hue.
 */
const CELL: Record<Status, string> = {
  open: "bg-status-open",
  risky: "bg-status-risky",
  closed: "bg-status-closed/12 ring-1 ring-status-closed/45 ring-inset",
};

export function SeasonStrip({
  statuses,
  current,
  best,
  size = "row",
  className,
}: {
  /** 24 verdicts, index 0 = early January. */
  statuses: Status[];
  /** Outlined half-month; usually the selected period. */
  current?: Period;
  /** Underlined range in the panel size (`bestPeriods`). */
  best?: [Period, Period] | null;
  /** `row`: 96 px, no labels. `panel`: full width with month initials. */
  size?: "row" | "panel";
  className?: string;
}) {
  const panel = size === "panel";
  const currentIndex = current === undefined ? -1 : periodIndex(current);
  const label = [
    seasonSummary(statuses),
    current !== undefined && statuses[currentIndex]
      ? `${periodLabel(current)}: ${STATUS_LABEL[statuses[currentIndex]]}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  // A run that wraps around the turn of the year cannot be drawn as one bar;
  // the sentence in `aria-label` still carries it.
  const from = best ? periodIndex(best[0]) : 0;
  const to = best ? periodIndex(best[1]) : 0;
  const bestBar =
    panel && best && from <= to
      ? {
          left: `${(from / PERIODS.length) * 100}%`,
          width: `${((to - from + 1) / PERIODS.length) * 100}%`,
        }
      : null;

  return (
    <div className={cn(panel ? "w-full" : "w-24", className)}>
      <div
        role="img"
        aria-label={label}
        className={cn("flex gap-px", panel ? "h-4" : "h-2")}
      >
        {statuses.map((status, i) => (
          <span
            key={PERIODS[i]}
            className={cn(
              "relative flex-1 rounded-[1px]",
              CELL[status],
              i === currentIndex &&
                "outline-foreground z-10 outline-1 outline-offset-1",
            )}
          />
        ))}
      </div>
      {bestBar && (
        <div aria-hidden className="relative mt-1 h-[3px]">
          <span
            style={bestBar}
            className="bg-foreground/55 absolute top-0 h-[3px] rounded-full"
          />
        </div>
      )}
      {panel && (
        <div
          aria-hidden
          className="text-muted-foreground mt-0.5 flex text-[10px] leading-none"
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
}
