import { MONTH_INITIALS, periodIndex, periodLabel, seasonSummary, STATUS_LABEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Period, Status } from "@/lib/types";

/**
 * The whole year of one pass or tour in 24 cells, so "when" is answered
 * without clicking. Colour carries the status, but never alone: "oft
 * gesperrt" is hollow like the circles on the map and the current half-month
 * is outlined, so the strip still works without hue.
 */
const CELL: Record<Status, string> = {
  open: "bg-status-open",
  risky: "bg-status-risky",
  closed: "bg-transparent ring-1 ring-status-closed/70 ring-inset",
};

export function SeasonStrip({
  statuses,
  current,
  size = "row",
  className,
}: {
  /** 24 verdicts, index 0 = early January. */
  statuses: Status[];
  /** Outlined half-month; usually the selected period. */
  current?: Period;
  /** `row`: 96 px, no labels. `panel`: 288 px with month initials. */
  size?: "row" | "panel";
  className?: string;
}) {
  const currentIndex = current === undefined ? -1 : periodIndex(current);
  const label = [
    seasonSummary(statuses),
    current !== undefined && statuses[currentIndex]
      ? `${periodLabel(current)}: ${STATUS_LABEL[statuses[currentIndex]]}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn(size === "panel" ? "w-72 max-w-full" : "w-24", className)}>
      <div role="img" aria-label={label} className={cn("flex gap-px", size === "panel" ? "h-3.5" : "h-2")}>
        {statuses.map((status, i) => (
          <span
            key={i}
            className={cn(
              "relative flex-1 rounded-[1px]",
              CELL[status],
              i === currentIndex && "z-10 outline-1 outline-offset-1 outline-foreground",
            )}
          />
        ))}
      </div>
      {size === "panel" && (
        <div aria-hidden className="mt-0.5 flex text-[10px] leading-none text-muted-foreground">
          {MONTH_INITIALS.map((m, i) => (
            <span key={i} className="flex-1 text-center tabular-nums">
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
