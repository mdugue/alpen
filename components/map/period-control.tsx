"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PERIODS, periodLabel } from "@/lib/status";
import type { Period } from "@/lib/types";
import { cn, MAP_CONTROL } from "@/lib/utils";

/**
 * The half-month drives every colour on the map, so it is the one domain
 * control that floats over the map: a select plus two steppers to scrub
 * through the season.
 */
export function PeriodControl({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const step = (dir: 1 | -1) => {
    const i = PERIODS.indexOf(value);
    onChange(PERIODS[(i + dir + PERIODS.length) % PERIODS.length]!);
  };
  return (
    <div
      className={cn(
        "border-border flex items-center rounded-md border",
        MAP_CONTROL,
      )}
    >
      <Button
        size="icon-lg"
        variant="ghost"
        onClick={() => step(-1)}
        aria-label="Früherer Halbmonat"
      >
        <ChevronLeft />
      </Button>
      <NativeSelect
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Zeitraum"
        className="[&>select]:h-8 [&>select]:border-0 [&>select]:bg-transparent [&>select]:font-semibold dark:[&>select]:bg-transparent"
      >
        {PERIODS.map((p) => (
          <NativeSelectOption key={p} value={p}>
            {periodLabel(p)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button
        size="icon-lg"
        variant="ghost"
        onClick={() => step(1)}
        aria-label="Späterer Halbmonat"
      >
        <ChevronRight />
      </Button>
      <span className="sr-only" aria-live="polite">
        {periodLabel(value)}
      </span>
    </div>
  );
}
