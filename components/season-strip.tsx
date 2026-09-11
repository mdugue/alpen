import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  cellHint,
  GRADE_LABEL,
  MONTH_INITIALS,
  periodIndex,
  periodLabel,
  PERIODS,
  seasonSummary,
} from "@/lib/status";
import type { CellNote, Grade } from "@/lib/status";
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
 * panel every cell explains itself on tap or click as well as on hover –
 * a `Popover`, not a `Tooltip`, for the same reason as the panel's `info`
 * icon (`components/panel/section.tsx`): hover needs a pointer a phone
 * does not have.
 */
export const CELL: Record<Grade, string> = {
  best: "bg-grade-best",
  closed: "bg-status-closed/12 ring-1 ring-status-closed/45 ring-inset",
  good: "bg-grade-good",
  limited: "bg-grade-limited",
};

export const SeasonStrip = ({
  grades,
  notes,
  current,
  size = "row",
  className,
}: {
  /** 24 grades, index 0 = early January. */
  grades: Grade[];
  /** What each cell knows beyond its grade, so its popover can be specific. */
  notes?: CellNote[];
  /** Outlined half-month; usually the selected period. */
  current?: Period;
  /** `row`: 96 px, no labels. `panel`: full width with month initials and cell popovers. */
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

  const cellClass = (grade: Grade, i: number) =>
    cn(
      "relative flex-1 rounded-xs",
      CELL[grade],
      i === currentIndex &&
        "outline-foreground z-10 outline-1 outline-offset-1",
    );

  // In the panel every cell is a button: reachable with Tab, its popover
  // opening on tap or click as well as on focus, so the explanation is not
  // pointer-only. The strip is then a group rather than an image, since an
  // image role would make the cells presentational and hide them from a
  // screen reader.
  return (
    <div className={cn(panel ? "w-full" : "w-24", className)}>
      {panel ? (
        <div role="group" aria-label={label} className="flex h-4 gap-px">
          {grades.map((grade, i) => (
            <Popover key={PERIODS[i]}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label={`${periodLabel(PERIODS[i]!)}: ${GRADE_LABEL[grade]}`}
                    className={cn(
                      cellClass(grade, i),
                      "focus-visible:outline-ring cursor-default border-0 p-0 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1",
                    )}
                  />
                }
              />
              <PopoverContent className="w-56 gap-1" side="top">
                <p className="text-sm font-semibold">
                  {periodLabel(PERIODS[i]!)} · {GRADE_LABEL[grade]}
                </p>
                <p className="text-muted-foreground text-xs">
                  {cellHint(grade, notes?.[i])}
                </p>
              </PopoverContent>
            </Popover>
          ))}
        </div>
      ) : (
        <div role="img" aria-label={label} className="flex h-2 gap-px">
          {grades.map((grade, i) => (
            <span key={PERIODS[i]} className={cellClass(grade, i)} />
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
