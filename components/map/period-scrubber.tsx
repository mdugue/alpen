"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTH_INITIALS, PERIODS, periodAt, periodIndex, periodLabel } from "@/lib/status";
import type { HistogramBar } from "@/lib/rows";
import type { Period } from "@/lib/types";
import { cn, MAP_CONTROL } from "@/lib/utils";

/**
 * The half-month drives every colour on the map, so it is the one domain
 * control that floats over it – and it shows what it is scrubbing through:
 * behind the 24 stops a stacked bar per half-month counts how many of the
 * passes currently in the list are open, weather-dependent or often closed.
 * The status filter is ignored for those counts (see `statusHistogram`),
 * otherwise the histogram would hide the alternatives.
 */
export function PeriodScrubber({
  value,
  onChange,
  histogram,
  today,
}: {
  value: Period;
  onChange: (p: Period) => void;
  histogram: HistogramBar[];
  /** Today's half-month, marked on the track. */
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
      ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -2, PageUp: 2,
    };
    if (e.key in step) go(index + step[e.key]!);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(PERIODS.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className={cn("w-72 max-w-full rounded-md border border-border px-1.5 pt-0.5 pb-1", MAP_CONTROL)}>
      <div className="flex items-center gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Früherer Halbmonat"
        >
          <ChevronLeft />
        </Button>
        <span className="flex-1 truncate text-center text-sm font-semibold">{periodLabel(value)}</span>
        {today !== undefined && value !== today && (
          <Button
            size="xs"
            variant="ghost"
            className="h-6 px-1.5 text-xs text-muted-foreground"
            onClick={() => onChange(today)}
          >
            heute
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => go(index + 1)}
          disabled={index === PERIODS.length - 1}
          aria-label="Späterer Halbmonat"
        >
          <ChevronRight />
        </Button>
      </div>

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
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX);
        }}
        className="relative mt-0.5 flex h-9 cursor-pointer touch-none items-end gap-px rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {histogram.map((b, i) => (
          <span
            key={i}
            className={cn(
              "relative flex h-full flex-1 flex-col justify-end gap-px rounded-[1px]",
              i === index && "outline-1 outline-offset-1 outline-foreground",
              i === todayIndex && "border-l border-dashed border-foreground/50",
            )}
          >
            <span
              aria-hidden
              style={{ height: `${(b.closed / max) * 100}%` }}
              className="rounded-[1px] bg-status-closed/25"
            />
            <span
              aria-hidden
              style={{ height: `${(b.risky / max) * 100}%` }}
              className="rounded-[1px] bg-status-risky/70"
            />
            <span
              aria-hidden
              style={{ height: `${(b.open / max) * 100}%` }}
              className="rounded-[1px] bg-status-open"
            />
          </span>
        ))}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 border-b border-border" />
      </div>

      <div aria-hidden className="flex text-[10px] leading-none text-muted-foreground">
        {MONTH_INITIALS.map((m, i) => (
          <span key={i} className="flex-1 text-center">
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
