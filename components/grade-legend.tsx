import { BEST_MARK } from "@/components/season-strip";
import { GRADE_LABEL } from "@/lib/status";
import type { Grade } from "@/lib/status";
import { cn } from "@/lib/utils";

/** The same three fills the strip paints, see `CELL` in season-strip.tsx. */
const SWATCH: Record<Grade, string> = {
  best: "bg-status-open",
  closed: "bg-status-closed/12 ring-1 ring-status-closed/45 ring-inset",
  good: "bg-status-open",
  limited: "bg-status-risky",
};

const ORDER: Grade[] = ["good", "best", "limited", "closed"];

/**
 * What the colours and the mark of a season strip mean, in one line. The
 * strip itself explains nothing – it is 24 cells of 4 px – so the legend
 * sits wherever a strip stands on its own: in the detail box and in the
 * tooltip of the period control. The full rules are in the scales dialog.
 */
export const GradeLegend = ({
  className,
  hint,
}: {
  className?: string;
  /** Optional trailing note, e.g. "das erste Wort ist der Grund". */
  hint?: string;
}) => (
  <div
    className={cn(
      "text-muted-foreground text-2xs flex flex-wrap items-center gap-x-2.5 gap-y-1 leading-none",
      className,
    )}
  >
    {ORDER.map((g) => (
      <span key={g} className="inline-flex items-center gap-1">
        <span aria-hidden className="inline-flex flex-col gap-px">
          <span className={cn("inline-block size-2 rounded-xs", SWATCH[g])} />
          <span
            className={cn(
              "inline-block h-0.5 w-2 rounded-full",
              g === "best" ? BEST_MARK : "opacity-0",
            )}
          />
        </span>
        {GRADE_LABEL[g]}
      </span>
    ))}
    {hint && <span className="basis-full">{hint}</span>}
  </div>
);
