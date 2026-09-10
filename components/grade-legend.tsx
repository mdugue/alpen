import { CELL } from "@/components/season-strip";
import { GRADE_HINT, GRADE_LABEL, GRADE_ORDER } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * What the four colours of a season strip mean, one line each with its
 * sentence – for the period control's tooltip, the one place a strip's
 * colours show without a cell to hover. In the panel the cells explain
 * themselves (`SeasonStrip`, size "panel").
 */
export const GradeLegend = ({
  className,
  hint,
}: {
  className?: string;
  /** Optional trailing note, e.g. the counts of the half-month. */
  hint?: string;
}) => (
  <dl className={cn("text-2xs flex flex-col gap-1", className)}>
    {GRADE_ORDER.map((g) => (
      <div key={g} className="flex items-start gap-1.5">
        <dt className="flex shrink-0 items-center gap-1 font-semibold">
          <span
            aria-hidden
            className={cn("inline-block size-2 rounded-xs", CELL[g])}
          />
          {GRADE_LABEL[g]}
        </dt>
        <dd className="opacity-80">{GRADE_HINT[g]}</dd>
      </div>
    ))}
    {hint && <div className="mt-0.5">{hint}</div>}
  </dl>
);
