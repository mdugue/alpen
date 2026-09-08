"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { MONTHS, periodLabel, PERIODS } from "@/lib/status";
import type { ClimateYear, Period } from "@/lib/types";

/**
 * The pass's own climate over the year: the share of days with frost (band)
 * and with snowfall (bars) on the left axis, mean day and night temperature
 * on the right. The chosen half-month is marked, and the tooltip gives all
 * four numbers for whichever half-month the pointer is on – the whole point
 * of the chart is comparing periods, not reading absolute values.
 */
const CHART_CONFIG = {
  frostPct: { label: "Frost", color: "var(--muted-foreground)" },
  snowPct: { label: "Schneefall", color: "var(--chart-4)" },
  tmax: { label: "Ø Tag", color: "var(--chart-5)" },
  tmin: { label: "Ø Nacht", color: "var(--chart-5)" },
} satisfies ChartConfig;

/** "Frost 82 %", "Ø Tag 4 °C" – the unit follows the axis the series is on. */
function formatValue(value: unknown, name?: number | string) {
  const key = name as keyof typeof CHART_CONFIG;
  const unit = key === "tmax" || key === "tmin" ? "°C" : "%";
  return (
    <span className="flex w-full justify-between gap-3 tabular-nums">
      <span className="text-muted-foreground">
        {CHART_CONFIG[key]?.label ?? name}
      </span>
      <span>
        {value as number} {unit}
      </span>
    </span>
  );
}

export function ClimateChart({
  climate,
  period,
}: {
  climate: ClimateYear;
  period: Period;
}) {
  const data = PERIODS.map((t, i) => {
    const bucket = climate[i];
    return {
      period: t,
      label: periodLabel(t),
      month: i % 2 === 0 ? MONTHS[i / 2]!.slice(0, 3) : "",
      frostPct: bucket?.frostPct ?? null,
      snowPct: bucket?.snowPct ?? null,
      tmax: bucket?.tmax ?? null,
      tmin: bucket?.tmin ?? null,
    };
  });
  if (data.every((d) => d.frostPct === null)) return null;

  return (
    <ChartContainer
      config={CHART_CONFIG}
      className="mt-3 aspect-auto h-44 w-full"
    >
      <ComposedChart data={data} margin={{ left: 0, right: 0, top: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          interval={0}
          tickFormatter={(_, i) => data[i]?.month ?? ""}
        />
        <YAxis
          yAxisId="pct"
          width={28}
          domain={[0, 100]}
          ticks={[0, 50, 100]}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <YAxis
          yAxisId="temp"
          orientation="right"
          width={30}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}°`}
        />
        <ReferenceLine
          yAxisId="pct"
          x={periodLabel(period)}
          stroke="var(--foreground)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
        <Area
          yAxisId="pct"
          dataKey="frostPct"
          type="step"
          stroke="none"
          fill="var(--color-frostPct)"
          fillOpacity={0.2}
          isAnimationActive={false}
        />
        <Bar
          yAxisId="pct"
          dataKey="snowPct"
          fill="var(--color-snowPct)"
          radius={2}
          isAnimationActive={false}
        />
        <Line
          yAxisId="temp"
          dataKey="tmax"
          stroke="var(--color-tmax)"
          strokeWidth={1.6}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          yAxisId="temp"
          dataKey="tmin"
          stroke="var(--color-tmin)"
          strokeWidth={1.6}
          strokeDasharray="4 2"
          dot={false}
          isAnimationActive={false}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={formatValue} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </ComposedChart>
    </ChartContainer>
  );
}
