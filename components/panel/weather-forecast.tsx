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
import type { WeatherDay } from "@/lib/types";
import useFetch from "@/lib/use-fetch";
import { cn, fmt } from "@/lib/utils";

/**
 * A value Open-Meteo has none of. One empty cell costs the cell and nothing
 * else: the rest of the day, and the rest of the week, is still a forecast
 * (`WeatherDay` in lib/schema.ts).
 */
const MISSING = "–";
const value = (n: number | null, unit = "") =>
  n === null ? MISSING : `${fmt(Math.round(n))}${unit}`;

/** WMO weather code → icon and German label; a day without one gets neither. */
const describe = (code: number | null): [LucideIcon, string] | null => {
  if (code === null) return null;
  if (code === 0) return [Sun, "sonnig"];
  if (code <= 2) return [CloudSun, "leicht bewölkt"];
  if (code === 3) return [Cloud, "bedeckt"];
  if (code <= 48) return [CloudFog, "Nebel"];
  if (code <= 57) return [CloudDrizzle, "Nieselregen"];
  if (code <= 67) return [CloudRain, "Regen"];
  if (code <= 77) return [CloudSnow, "Schneefall"];
  if (code <= 82) return [CloudRain, "Regenschauer"];
  if (code <= 86) return [CloudSnow, "Schneeschauer"];
  return [CloudLightning, "Gewitter"];
};

const weekday = (date: string) =>
  new Date(date).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "numeric",
    weekday: "short",
  });

/**
 * Forecast at pass altitude, from our own cached route. The panel is about
 * choosing a destination, not about planning tomorrow's ride: today and
 * tomorrow are shown as two dense rows, the rest of the week stays one click
 * away.
 */
export const WeatherForecast = ({ slug }: { slug: string }) => {
  const { data, error, loading } = useFetch<{ days: WeatherDay[] }>(
    `/api/weather/${slug}`,
  );

  if (loading)
    return (
      <div
        role="status"
        aria-busy
        aria-label="Wetter wird geladen"
        className="flex flex-col gap-1.5 py-1"
      >
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
    );
  if (error || !data)
    return (
      <Empty className="py-3">
        <EmptyHeader>
          <EmptyTitle>Wetter nicht verfügbar</EmptyTitle>
          <EmptyDescription>
            Open-Meteo antwortet gerade nicht.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  const [today, tomorrow] = data.days;
  const rows: [WeatherDay | undefined, string][] = [
    [today, "heute"],
    [tomorrow, "morgen"],
  ];

  return (
    <Collapsible>
      <div className="flex flex-col">
        {rows
          .filter((row): row is [WeatherDay, string] => row[0] !== undefined)
          .map(([d, when]) => {
            const [Icon, label] = describe(d.weatherCode) ?? [];
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
                    {value(d.snowfall, " cm")} Schnee
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
        Alle 7 Tage
        <ChevronDown
          data-icon="inline-end"
          className="transition-transform group-aria-expanded/week:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Table>
          <TableHeader>
            <TableRow className="text-muted-foreground [&>th]:h-7 [&>th]:px-1 [&>th]:text-right [&>th:first-child]:pl-0 [&>th:first-child]:text-left">
              <TableHead>Tag</TableHead>
              <TableHead>
                <span className="sr-only">Wetter</span>
              </TableHead>
              <TableHead>Tmin</TableHead>
              <TableHead>Tmax</TableHead>
              <TableHead>Regen</TableHead>
              <TableHead>Schnee</TableHead>
              <TableHead>Wind</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.days.map((d) => {
              const [Icon, label] = describe(d.weatherCode) ?? [];
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
