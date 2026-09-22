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

import { useT } from "@/components/i18n";
import { CHART_HEIGHT } from "@/components/panel/chart-size";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import type { Lang, Messages } from "@/lib/i18n";
import { monthsOf, periodLabel, PERIODS } from "@/lib/period";
import type { ClimateYear, Period } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The pass's own climate over the year: the share of days with frost (band)
 * and with snowfall (bars) on the left axis, mean day and night temperature
 * on the right. The chosen half-month is marked, and the tooltip gives all
 * four numbers for whichever half-month the pointer is on – the whole point
 * of the chart is comparing periods, not reading absolute values.
 */
const chartConfig = (words: Messages["panel"]["chart"]) =>
  ({
    frostPct: { color: "var(--muted-foreground)", label: words.frost },
    snowPct: { color: "var(--chart-4)", label: words.snow },
    tmax: { color: "var(--chart-5)", label: words.tmax },
    tmin: { color: "var(--chart-5)", label: words.tmin },
  }) satisfies ChartConfig;

type Series = keyof ReturnType<typeof chartConfig>;

/** "Frost 82 %", "Ø Tag 4 °C" – the unit follows the axis the series is on. */
const formatValue = (
  config: ReturnType<typeof chartConfig>,
  fmt: (n: number, digits?: number) => string,
  value: unknown,
  name?: number | string,
) => {
  const key = name as Series;
  const unit = key === "tmax" || key === "tmin" ? "°C" : "%";
  return (
    <span className="flex w-full justify-between gap-3 tabular-nums">
      <span className="text-muted-foreground">
        {config[key]?.label ?? name}
      </span>
      <span>
        {typeof value === "number" ? fmt(value, 1) : String(value)} {unit}
      </span>
    </span>
  );
};

/** The month name as the axis writes it: three letters, in the page's language. */
const monthTick = (i: number, lang: Lang) =>
  i % 2 === 0 ? monthsOf(lang)[i / 2]!.slice(0, 3) : "";

export const ClimateChart = ({
  climate,
  period,
}: {
  climate: ClimateYear;
  period: Period;
}) => {
  const { t: words, lang, fmt } = useT();
  const config = chartConfig(words.panel.chart);
  const data = PERIODS.map((t, i) => {
    const bucket = climate[i];
    return {
      frostPct: bucket?.frostPct ?? null,
      label: periodLabel(t, lang),
      month: monthTick(i, lang),
      period: t,
      snowPct: bucket?.snowPct ?? null,
      tmax: bucket?.tmax ?? null,
      tmin: bucket?.tmin ?? null,
    };
  });
  if (data.every((d) => d.frostPct === null)) return null;

  return (
    <ChartContainer
      config={config}
      className={cn("mt-3 aspect-auto w-full", CHART_HEIGHT)}
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
          x={periodLabel(period, lang)}
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
          content={
            <ChartTooltipContent
              formatter={(value, name) => formatValue(config, fmt, value, name)}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
      </ComposedChart>
    </ChartContainer>
  );
};
