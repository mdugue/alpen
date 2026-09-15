"use client";

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import type { CSSProperties } from "react";
import { useRef } from "react";

import { GradeLegend } from "@/components/grade-legend";
import { CELL } from "@/components/season-strip";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { barTotal } from "@/lib/rows";
import type { HistogramBar } from "@/lib/rows";
import type { Grade } from "@/lib/status";
import {
  GRADE_ORDER,
  MONTH_INITIALS,
  PERIODS,
  periodAt,
  periodIndex,
  periodLabel,
} from "@/lib/status";
import type { Period } from "@/lib/types";
import { cn, MAP_GROUP } from "@/lib/utils";

/** Share of one segment in its stack, in percent; 0 when the stack is empty. */
const percent = (part: number, total: number) =>
  total === 0 ? 0 : (part / total) * 100;

/**
 * One bar, bottom to top: the reverse of `GRADE_ORDER`, so the worse grades
 * sink and the best sits on top of the stack. Taking the order from the same
 * constant the legend in the tooltip above renders from is what keeps the two
 * readings of the same four grades in step.
 *
 * Three of the four fills are the strip's own (`CELL`), so the bars and the
 * strips in the list below them read as one ramp. `closed` is the exception
 * and stays a flat grey: the strip draws it hollow with a red hairline, which
 * at four pixels wide is mush rather than a ring – and red is the map's own
 * closure colour, which a backdrop must not compete with.
 */
const STACK: [Grade, string][] = GRADE_ORDER.toReversed().map((g) => [
  g,
  g === "closed" ? "bg-muted-foreground/25" : CELL[g],
]);

/**
 * The half-month drives every colour on the map, so it is the one domain
 * control that floats over it. It carries no surface of its own: it sits in
 * the map cluster (`MAP_CLUSTER`) together with the three map tools, and that
 * shared panel is what makes the corner read as one interaction area.
 *
 * It reads as a control from three sides: a stepper group with the current
 * label, a rail whose 24 stops highlight under the pointer, and a thumb around
 * the chosen half-month. Behind the stops a stacked bar per half-month counts
 * how many of the passes currently in the list are open, weather-dependent or
 * often closed – the status filter is ignored for those counts (see
 * `statusHistogram`), otherwise the histogram would hide the alternatives.
 */
export const PeriodScrubber = ({
  value,
  onChange,
  histogram,
  today,
}: {
  value: Period;
  onChange: (p: Period) => void;
  histogram: HistogramBar[];
  /** Today's half-month, marked on the rail. */
  today?: Period;
}) => {
  const track = useRef<HTMLDivElement>(null);
  const index = periodIndex(value);
  const max = Math.max(1, ...histogram.map(barTotal));
  const todayIndex = today === undefined ? -1 : periodIndex(today);
  const bar = histogram[index];

  const go = (i: number) => {
    const next = periodAt(Math.min(PERIODS.length - 1, Math.max(0, i)));
    if (next !== value) onChange(next);
  };

  const fromPointer = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    go(Math.floor(((clientX - rect.left) / rect.width) * PERIODS.length));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = {
      ArrowDown: -1,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -2,
      PageUp: 2,
    };
    if (e.key in step) go(index + step[e.key]!);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(PERIODS.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="w-76 max-w-full min-w-0">
      <ButtonGroup className={cn("w-full", MAP_GROUP)}>
        <Button
          variant="outline"
          size="icon-lg"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Früherer Halbmonat"
        >
          <ChevronLeft />
        </Button>
        {/* The label doubles as the legend: what the four colours of the bars
            and the strips mean, and the counts of this half-month. A button
            rather than the group's text element, so the legend also opens
            from the keyboard, on focus. */}
        <Tooltip>
          <TooltipTrigger
            render={
              <ButtonGroupText
                render={<button type="button" />}
                className="flex-1 cursor-default justify-center bg-transparent text-sm font-semibold"
              />
            }
          >
            {periodLabel(value)}
          </TooltipTrigger>
          <TooltipContent className="max-w-72">
            <GradeLegend
              hint={
                bar
                  ? `${periodLabel(value)}: ${bar.best} beste Zeit, ${bar.good} gut, ${bar.limited} eingeschränkt, ${bar.closed} oft gesperrt. Mehr unter „Skalen & Quellen“.`
                  : undefined
              }
            />
          </TooltipContent>
        </Tooltip>
        <Button
          variant="outline"
          size="icon-lg"
          onClick={() => go(index + 1)}
          disabled={index === PERIODS.length - 1}
          aria-label="Späterer Halbmonat"
        >
          <ChevronRight />
        </Button>
        {today !== undefined && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-lg"
                  onClick={() => onChange(today)}
                  disabled={value === today}
                  aria-label={`Zurück zu heute (${periodLabel(today)})`}
                />
              }
            >
              <RotateCcw />
            </TooltipTrigger>
            <TooltipContent>heute: {periodLabel(today)}</TooltipContent>
          </Tooltip>
        )}
      </ButtonGroup>

      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Zeitraum"
        aria-valuemin={1}
        aria-valuemax={PERIODS.length}
        aria-valuenow={index + 1}
        aria-valuetext={
          bar
            ? `${periodLabel(value)}: ${bar.best} beste Zeit, ${bar.good} gut, ${bar.limited} eingeschränkt, ${bar.closed} oft gesperrt`
            : periodLabel(value)
        }
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            fromPointer(e.clientX);
        }}
        className="focus-visible:ring-ring/50 ring-border/70 bg-muted/60 relative mt-1.5 h-11 cursor-pointer touch-none rounded-md p-1 ring-1 outline-none focus-visible:ring-2"
      >
        {/* The stops carry no gap of their own: each is exactly 1/24 wide, so
            the thumb below lines up with them at any width. The visual gap is
            the bar's own inset. */}
        <div className="relative flex h-full items-stretch">
          {histogram.map((b, i) => (
            <span
              key={b.period}
              className={cn(
                "relative flex flex-1 flex-col justify-end px-px transition-colors",
                i === index ? "" : "hover:bg-foreground/10 rounded-sm",
              )}
            >
              {i === todayIndex && (
                <span
                  aria-hidden
                  className="bg-foreground/45 absolute inset-x-px top-0 h-0.5 rounded-full"
                />
              )}
              {/* The bar's height and its four slices are data, so they travel
                  as custom properties rather than as class names: a class per
                  percentage is a class Tailwind cannot generate. */}
              <span
                aria-hidden
                className="flex h-(--bar) flex-col justify-end overflow-hidden rounded-xs"
                style={
                  { "--bar": `${(barTotal(b) / max) * 100}%` } as CSSProperties
                }
              >
                {STACK.map(([grade, fill]) => (
                  <span
                    key={grade}
                    className={cn("shrink-0 basis-(--slice)", fill)}
                    style={
                      {
                        "--slice": `${percent(b[grade], barTotal(b))}%`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
            </span>
          ))}
          {/* The thumb: inside the rail and inset, so it frames its own stop
              without reaching into its neighbours. */}
          <span
            aria-hidden
            style={
              {
                "--stop": `${(index / PERIODS.length) * 100}%`,
                "--stop-w": `${100 / PERIODS.length}%`,
              } as CSSProperties
            }
            className="ring-foreground pointer-events-none absolute -inset-y-1 left-(--stop) w-(--stop-w) rounded-md ring-2 ring-inset"
          />
        </div>
      </div>

      <div
        aria-hidden
        className="text-muted-foreground text-2xs mt-0.5 flex px-1 leading-none"
      >
        {MONTH_INITIALS.map((m, i) => (
          <span
            key={m + String(i)}
            className={cn(
              "flex-1 text-center",
              Math.floor(index / 2) === i && "text-foreground font-semibold",
            )}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
};
