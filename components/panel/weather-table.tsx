"use client";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import useFetch from "@/lib/use-fetch";
import { cn, fmt } from "@/lib/utils";
import type { WeatherDay } from "@/lib/types";

/** WMO weather code → icon and German label. */
function describe(code: number): [LucideIcon, string] {
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
}

/** 7-day forecast at pass altitude; comes from our own route (cached server-side). */
export function WeatherTable({ slug }: { slug: string }) {
  const { data, error, loading } = useFetch<{ days: WeatherDay[] }>(`/api/weather/${slug}`);

  if (loading)
    return (
      <div role="status" aria-busy aria-label="Wetter wird geladen" className="flex flex-col gap-1.5 py-1">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  if (error || !data)
    return (
      <Empty className="py-3">
        <EmptyHeader>
          <EmptyTitle>Wetter nicht verfügbar</EmptyTitle>
          <EmptyDescription>Open-Meteo antwortet gerade nicht.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  return (
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
          const [Icon, label] = describe(d.weatherCode);
          return (
            <TableRow
              key={d.date}
              className="tabular-nums [&>td]:px-1 [&>td]:py-1 [&>td]:text-right [&>td:first-child]:pl-0 [&>td:first-child]:text-left"
            >
              <TableCell>
                {new Date(d.date).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })}
              </TableCell>
              <TableCell>
                <Icon className="inline size-3.5 text-muted-foreground" aria-label={label} role="img" />
              </TableCell>
              <TableCell>{fmt(Math.round(d.tmin))}°</TableCell>
              <TableCell>{fmt(Math.round(d.tmax))}°</TableCell>
              <TableCell>{fmt(Math.round(d.precipitation))} mm</TableCell>
              <TableCell className={cn(d.snowfall > 0 && "font-semibold text-status-closed")}>
                {d.snowfall > 0 ? `${fmt(Math.round(d.snowfall))} cm` : "–"}
              </TableCell>
              <TableCell>{fmt(Math.round(d.windMax))} km/h</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
