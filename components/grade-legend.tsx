import { BEST_MARK } from "@/components/season-strip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GRADE_HINT, GRADE_LABEL, GRADE_ORDER } from "@/lib/status";
import type { Grade } from "@/lib/status";
import { cn } from "@/lib/utils";

/** The same three fills the strip paints, see `CELL` in season-strip.tsx. */
const SWATCH: Record<Grade, string> = {
  best: "bg-status-open",
  closed: "bg-status-closed/12 ring-1 ring-status-closed/45 ring-inset",
  good: "bg-status-open",
  limited: "bg-status-risky",
};

const Swatch = ({ grade }: { grade: Grade }) => (
  <span aria-hidden className="inline-flex shrink-0 flex-col gap-px">
    <span className={cn("inline-block size-2 rounded-xs", SWATCH[grade])} />
    <span
      className={cn(
        "inline-block h-0.5 w-2 rounded-full",
        grade === "best" ? BEST_MARK : "opacity-0",
      )}
    />
  </span>
);

/**
 * What the colours and the mark of a season strip mean. The strip itself
 * explains nothing – it is 24 cells of 4 px – so the legend sits wherever a
 * strip stands on its own. `compact` is one line whose entries each carry
 * their sentence in a tooltip (the detail box); otherwise every entry is a
 * line with its sentence, for places that already are a tooltip (the period
 * control). The full rules are in the scales dialog.
 */
export const GradeLegend = ({
  compact = true,
  className,
  hint,
}: {
  compact?: boolean;
  className?: string;
  /** Optional trailing note, e.g. the counts of the half-month. */
  hint?: string;
}) =>
  compact ? (
    <div
      className={cn(
        "text-muted-foreground text-2xs flex flex-wrap items-center gap-x-2.5 gap-y-1 leading-none",
        className,
      )}
    >
      {GRADE_ORDER.map((g) => (
        <Tooltip key={g}>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="inline-flex cursor-help items-center gap-1 rounded-xs underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2"
              />
            }
          >
            <Swatch grade={g} />
            {GRADE_LABEL[g]}
          </TooltipTrigger>
          <TooltipContent className="max-w-60">{GRADE_HINT[g]}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ) : (
    <dl className={cn("text-2xs flex flex-col gap-1", className)}>
      {GRADE_ORDER.map((g) => (
        <div key={g} className="flex items-start gap-1.5">
          <dt className="flex shrink-0 items-center gap-1 font-semibold">
            <Swatch grade={g} />
            {GRADE_LABEL[g]}
          </dt>
          <dd className="opacity-80">{GRADE_HINT[g]}</dd>
        </div>
      ))}
      {hint && <div className="mt-0.5">{hint}</div>}
    </dl>
  );
