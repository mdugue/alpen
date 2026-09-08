"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HistogramBar } from "@/lib/rows";
import {
  MONTH_INITIALS,
  PERIODS,
  periodAt,
  periodIndex,
  periodLabel,
} from "@/lib/status";
import type { Period } from "@/lib/types";
import { cn, PANEL } from "@/lib/utils";

/**
 * The half-month drives every colour on the map, so it is the one domain
 * control that floats over it, on the same translucent surface as the sidebar.
 *
 * It reads as a control from three sides: a stepper group with the current
 * label, a rail whose 24 stops highlight under the pointer, and a thumb around
 * the chosen half-month. Behind the stops a stacked bar per half-month counts
 * how many of the passes currently in the list are open, weather-dependent or
 * often closed – the status filter is ignored for those counts (see
 * `statusHistogram`), otherwise the histogram would hide the alternatives.
 * "Often closed" is grey rather than red: red is the map's closure colour and
 * a backdrop must not compete with it.
 */
/** Share of one segment in its stack, in percent; 0 when the stack is empty. */
const percent = (part: number, total: number) =>
  total === 0 ? 0 : (part / total) * 100;

export function PeriodScrubber({
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
}) {
  const track = useRef<HTMLDivElement>(null);
  const index = periodIndex(value);
  const max = Math.max(1, ...histogram.map((b) => b.open + b.risky + b.closed));
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
      ArrowLeft: -1,
      ArrowDown: -1,
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
    <div className={cn("w-76 max-w-full p-1.5", PANEL)}>
      <ButtonGroup className="bg-background w-full rounded-md">
        <Button
          variant="outline"
          size="icon-lg"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Früherer Halbmonat"
        >
          <ChevronLeft />
        </Button>
        <ButtonGroupText className="flex-1 justify-center bg-transparent text-sm font-semibold">
          {periodLabel(value)}
        </ButtonGroupText>
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
              <CalendarDays />
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
            ? `${periodLabel(value)}: ${bar.open} meist offen, ${bar.risky} wetterabhängig, ${bar.closed} oft gesperrt`
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
                i === index ? "" : "hover:bg-foreground/8 rounded-[3px]",
              )}
            >
              {i === todayIndex && (
                <span
                  aria-hidden
                  className="bg-foreground/45 absolute inset-x-px top-0 h-0.5 rounded-full"
                />
              )}
              <span
                aria-hidden
                className="flex flex-col justify-end overflow-hidden rounded-[2px]"
                style={{
                  height: `${((b.closed + b.risky + b.open) / max) * 100}%`,
                }}
              >
                <span
                  className="bg-muted-foreground/25 shrink-0"
                  style={{
                    flexBasis: `${percent(b.closed, b.closed + b.risky + b.open)}%`,
                  }}
                />
                <span
                  className="bg-status-risky shrink-0"
                  style={{
                    flexBasis: `${percent(b.risky, b.closed + b.risky + b.open)}%`,
                  }}
                />
                <span
                  className="bg-status-open shrink-0"
                  style={{
                    flexBasis: `${percent(b.open, b.closed + b.risky + b.open)}%`,
                  }}
                />
              </span>
            </span>
          ))}
          {/* The thumb: inside the rail and inset, so it frames its own stop
              without reaching into its neighbours. */}
          <span
            aria-hidden
            style={{
              left: `${(index / PERIODS.length) * 100}%`,
              width: `${100 / PERIODS.length}%`,
            }}
            className="ring-foreground pointer-events-none absolute -inset-y-1 rounded-[5px] ring-2 ring-inset"
          />
        </div>
      </div>

      <div
        aria-hidden
        className="text-muted-foreground mt-0.5 flex px-1 text-[10px] leading-none"
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
}
