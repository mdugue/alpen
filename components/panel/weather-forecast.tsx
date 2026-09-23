"use client";
import {
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { localeOf } from "@/lib/i18n";
import type { Lang, Messages } from "@/lib/i18n";
import type { WeatherDay } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A value Open-Meteo has none of. One empty cell costs the cell and nothing
 * else: the rest of the day, and the rest of the week, is still a forecast
 * (`WeatherDay` in lib/schema.ts).
 */
const MISSING = "–";

/**
 * The day column, one formatter per language built once: the same shape in
 * both – "Mi., 24.9." / "Wed, 24/09" – left to the locale rather than spelled
 * out. In UTC, because a forecast day is a calendar date ("2026-09-24"),
 * which `Date` reads as midnight UTC: formatted in a visitor's own zone west
 * of Greenwich it would be the day before.
 */
const DAY_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
  weekday: "short",
};
const DAY_FORMAT: Record<Lang, Intl.DateTimeFormat> = {
  de: new Intl.DateTimeFormat(localeOf("de"), DAY_OPTIONS),
  en: new Intl.DateTimeFormat(localeOf("en"), DAY_OPTIONS),
};

/** WMO weather code → icon and the word for it; a day without one gets neither. */
const describe = (
  code: number | null,
  words: Messages["panel"]["weather"]["code"],
): [LucideIcon, string] | null => {
  if (code === null) return null;
  if (code === 0) return [Sun, words.sunny];
  if (code <= 2) return [CloudSun, words.partlyCloudy];
  if (code === 3) return [Cloud, words.overcast];
  if (code <= 48) return [CloudFog, words.fog];
  if (code <= 57) return [CloudDrizzle, words.drizzle];
  if (code <= 67) return [CloudRain, words.rain];
  if (code <= 77) return [CloudSnow, words.snow];
  if (code <= 82) return [CloudRain, words.showers];
  if (code <= 86) return [CloudSnow, words.snowShowers];
  return [CloudLightning, words.thunderstorm];
};

/** What the block looks like while the route's payload is on its way. */
export const WeatherSkeleton = () => {
  const { t } = useT();
  return (
    <div
      role="status"
      aria-busy
      aria-label={t.panel.weather.loading}
      className="flex flex-col gap-1.5 py-1"
    >
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-full" />
    </div>
  );
};

/** The server could not get a forecast; the rest of the panel is unaffected. */
export const WeatherUnavailable = () => {
  const { t } = useT();
  return (
    <Empty className="py-3">
      <EmptyHeader>
        <EmptyTitle>{t.panel.weather.unavailableTitle}</EmptyTitle>
        <EmptyDescription>{t.panel.weather.unavailableText}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

/**
 * Forecast at pass altitude, rendered on the server for the pass's route and
 * streamed in (`components/panel/weather.tsx`); this is the table, a client
 * component only for the fold. The panel is about choosing a destination,
 * not about planning tomorrow's ride: today and tomorrow are shown as two
 * dense rows, the rest of the week stays one click away.
 */
export const WeatherForecast = ({ days }: { days: WeatherDay[] }) => {
  const { t, lang, fmt } = useT();
  const w = t.panel.weather;
  const value = (n: number | null, unit = "") =>
    n === null ? MISSING : `${fmt(Math.round(n))}${unit}`;
  const weekday = (date: string) => DAY_FORMAT[lang].format(new Date(date));
  const [today, tomorrow] = days;
  const rows: [WeatherDay | undefined, string][] = [
    [today, w.today],
    [tomorrow, w.tomorrow],
  ];

  return (
    <Collapsible>
      <div className="flex flex-col">
        {rows
          .filter((row): row is [WeatherDay, string] => row[0] !== undefined)
          .map(([d, when]) => {
            const [Icon, label] = describe(d.weatherCode, w.code) ?? [];
            // A day without a figure for it had no snow as far as the panel
            // is concerned: it says so by saying nothing.
            const snow = d.snowfall ?? 0;
            return (
              <div
                key={d.date}
                className="flex items-center gap-2 py-1 text-xs tabular-nums"
              >
                {Icon ? (
                  <Icon
                    className="text-muted-foreground size-4 shrink-0"
                    aria-label={label}
                    role="img"
                  />
                ) : (
                  <span className="size-4 shrink-0" />
                )}
                <span className="w-14 shrink-0 font-medium">{when}</span>
                <span className="w-16 shrink-0">
                  {value(d.tmin, "°")} / {value(d.tmax, "°")}
                </span>
                <span className="text-muted-foreground w-14 shrink-0">
                  {value(d.precipitation, " mm")}
                </span>
                {snow > 0 && (
                  <span className="text-status-closed font-semibold">
                    {value(d.snowfall, " cm")} {w.snow}
                  </span>
                )}
                <span className="text-muted-foreground ml-auto">
                  {value(d.windMax, " km/h")}
                </span>
              </div>
            );
          })}
      </div>

      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="group/week text-muted-foreground mt-1 px-1"
          />
        }
      >
        {w.allDays}
        <ChevronDown
          data-icon="inline-end"
          className="transition-transform group-aria-expanded/week:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Table>
          <TableHeader>
            <TableRow className="text-muted-foreground [&>th]:h-7 [&>th]:px-1 [&>th]:text-right [&>th:first-child]:pl-0 [&>th:first-child]:text-left">
              <TableHead>{w.columns.day}</TableHead>
              <TableHead>
                <span className="sr-only">{w.columns.weather}</span>
              </TableHead>
              <TableHead>{w.columns.tmin}</TableHead>
              <TableHead>{w.columns.tmax}</TableHead>
              <TableHead>{w.columns.rain}</TableHead>
              <TableHead>{w.columns.snow}</TableHead>
              <TableHead>{w.columns.wind}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((d) => {
              const [Icon, label] = describe(d.weatherCode, w.code) ?? [];
              const snow = d.snowfall ?? 0;
              return (
                <TableRow
                  key={d.date}
                  className="tabular-nums [&>td]:px-1 [&>td]:py-1 [&>td]:text-right [&>td:first-child]:pl-0 [&>td:first-child]:text-left"
                >
                  <TableCell>{weekday(d.date)}</TableCell>
                  <TableCell>
                    {Icon ? (
                      <Icon
                        className="text-muted-foreground inline size-3.5"
                        aria-label={label}
                        role="img"
                      />
                    ) : (
                      MISSING
                    )}
                  </TableCell>
                  <TableCell>{value(d.tmin, "°")}</TableCell>
                  <TableCell>{value(d.tmax, "°")}</TableCell>
                  <TableCell>{value(d.precipitation, " mm")}</TableCell>
                  <TableCell
                    className={cn(
                      snow > 0 && "text-status-closed font-semibold",
                    )}
                  >
                    {snow > 0 ? value(d.snowfall, " cm") : MISSING}
                  </TableCell>
                  <TableCell>{value(d.windMax, " km/h")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  );
};
