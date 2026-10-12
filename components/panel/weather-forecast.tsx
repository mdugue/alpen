"use client";
import {
  ChevronDown,
  ExternalLink,
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
import { useState } from "react";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { fill } from "@/lib/i18n/fill";
import { meteoblueHref } from "@/lib/links";
import type { WeatherDay } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { PlaceForecast } from "@/lib/weather-places";
import { skyOf } from "@/lib/weather-sky";
import type { Sky } from "@/lib/weather-sky";

/**
 * A value Open-Meteo has none of. One empty cell costs the cell and nothing
 * else: the rest of the day, and the rest of the week, is still a forecast
 * (`WeatherDay` in lib/schema.ts).
 */
const MISSING = "–";

/** A rounded figure with its unit, or the dash; never "-0°". */
const figure = (fmt: (n: number) => string, n: number | null, unit = "") =>
  n === null ? MISSING : `${fmt(Math.round(n) || 0)}${unit}`;

/** Snowfall counts once the row can print a centimetre; never a red "0 cm". */
const snowsOn = (day: WeatherDay) => Math.round(day.snowfall ?? 0) > 0;

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

/** Each sky's icon; the word comes from `panel.weather.code`. */
const SKY_ICON: Record<Sky, LucideIcon> = {
  cloudy: Cloud,
  drizzle: CloudDrizzle,
  fog: CloudFog,
  overcast: Cloud,
  partlyCloudy: CloudSun,
  rain: CloudRain,
  showers: CloudRain,
  snow: CloudSnow,
  snowShowers: CloudSnow,
  sunny: Sun,
  thunderstorm: CloudLightning,
};

/** A day's icon and the word for it; a day without a code gets neither. */
const describe = (
  day: WeatherDay,
  words: Messages["panel"]["weather"]["code"],
): [LucideIcon, string] | null => {
  const sky = skyOf(day);
  return sky === null ? null : [SKY_ICON[sky], words[sky]];
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

/** "Passhöhe", "Valloire (Nord)", "Bormio" – what one place is called in the panel. */
const placeName = ({ place }: PlaceForecast, w: Messages["panel"]["weather"]) =>
  place.label || w.summit;

const placeKey = ({ place }: PlaceForecast) => `${place.lat},${place.lon}`;

/** A link out to meteoblue's week for one place, in a new tab. */
const MeteoblueLink = ({
  forecast,
  className,
  children,
}: {
  forecast: PlaceForecast;
  className: string;
  children: React.ReactNode;
}) => {
  const { t, lang } = useT();
  return (
    <a
      href={meteoblueHref(forecast.place, lang)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 underline-offset-2 hover:underline",
        className,
      )}
    >
      {children}
      <ExternalLink className="size-3" />
      <span className="sr-only">{t.panel.external.newTab}</span>
    </a>
  );
};

/**
 * One day at one place as one dense line: the sky, the lead (the day or the
 * place), the two temperatures, the rain – or the snow, when there is any –
 * and the wind. The same line for a pass's ladder and a town's two days, so
 * the columns stand where the eye left them.
 */
const DayLine = ({
  day,
  lead,
  sub,
}: {
  day: WeatherDay;
  lead: string;
  sub?: string;
}) => {
  const { t, fmt } = useT();
  const w = t.panel.weather;
  const value = (n: number | null, unit?: string) => figure(fmt, n, unit);
  const [Icon, label] = describe(day, w.code) ?? [];
  return (
    <div className="flex items-center gap-2 py-1 text-xs tabular-nums">
      {Icon ? (
        <Icon
          className="text-muted-foreground size-4 shrink-0"
          aria-label={label}
          role="img"
        />
      ) : (
        <span className="size-4 shrink-0" />
      )}
      {/* The name wraps rather than truncates: "Col du Lautaret (Süd)" cut to
          "Col du Laut…" says nothing, and a second line costs less. */}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="font-medium">{lead}</span>
        {sub && (
          <span className="text-muted-foreground text-2xs whitespace-nowrap">
            {" "}
            {sub}
          </span>
        )}
      </span>
      <span className="w-16 shrink-0 text-right">
        {value(day.tmin, "°")} / {value(day.tmax, "°")}
      </span>
      {snowsOn(day) ? (
        <span className="text-status-closed w-12 shrink-0 text-right font-semibold">
          {value(day.snowfall, " cm")}
          <span className="sr-only"> {w.snow}</span>
        </span>
      ) : (
        <span className="text-muted-foreground w-12 shrink-0 text-right">
          {value(day.precipitation, " mm")}
        </span>
      )}
      <span className="text-muted-foreground w-14 shrink-0 text-right">
        {value(day.windMax, " km/h")}
      </span>
    </div>
  );
};

/** The week at one place, one row a day. */
const WeekTable = ({ days }: { days: WeatherDay[] }) => {
  const { t, lang, fmt } = useT();
  const w = t.panel.weather;
  const value = (n: number | null, unit?: string) => figure(fmt, n, unit);
  const weekday = (date: string) => DAY_FORMAT[lang].format(new Date(date));
  return (
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
          const [Icon, label] = describe(d, w.code) ?? [];
          const snow = snowsOn(d);
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
                className={cn(snow && "text-status-closed font-semibold")}
              >
                {snow ? value(d.snowfall, " cm") : MISSING}
              </TableCell>
              <TableCell>{value(d.windMax, " km/h")}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

/**
 * The forecast of an entity's places, rendered on the server for its route
 * and streamed in (`components/panel/weather.tsx`); this is the table, a
 * client component only for the fold and the place switch. The panel is about
 * choosing a destination, not about planning tomorrow's ride: today and
 * tomorrow are shown as dense rows, the rest of the week stays one click away.
 *
 * A pass has several places – its top and the start of each ascent – and
 * they are shown as a ladder under each day, top first: the comparison is
 * the point ("1 ° oben, 17 ° in Valloire"), the way mountain weather sites
 * put "Berg" over "Tal". The week below takes one place at a time. Each place
 * links out to meteoblue at the same point – the summit at its curated
 * height, a valley point at meteoblue's own terrain height – for the
 * meteogram and the model comparison the panel does not try to be.
 *
 * A height the panel did not curate is Open-Meteo's terrain model and says
 * so with "≈"; the summit's is the curated one and stands plain.
 */
export const WeatherForecast = ({ places }: { places: PlaceForecast[] }) => {
  const { t, fmt } = useT();
  const w = t.panel.weather;
  const [chosen, setChosen] = useState(0);
  const single = places.length === 1;
  const height = (p: PlaceForecast) => {
    const metres = fmt(Math.round(p.elevation));
    return p.place.elevation === null
      ? fill(w.modelHeight, { metres })
      : `${metres} m`;
  };
  const week = places[chosen] ?? places[0];
  const days: [number, string][] = [
    [0, w.today],
    [1, w.tomorrow],
  ];

  return (
    <Collapsible>
      <div className="flex flex-col">
        {days.map(([i, when]) => {
          if (single) {
            const day = places[0]?.days[i];
            return day && <DayLine key={when} day={day} lead={when} />;
          }
          return (
            <div key={when} className="flex flex-col">
              <span className="text-muted-foreground text-2xs mt-1 font-medium uppercase">
                {when}
              </span>
              {places.map((p) => {
                const day = p.days[i];
                return (
                  day && (
                    <DayLine
                      key={placeKey(p)}
                      day={day}
                      lead={placeName(p, w)}
                      sub={height(p)}
                    />
                  )
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3">
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="group/week text-muted-foreground px-1"
            />
          }
        >
          {w.allDays}
          <ChevronDown
            data-icon="inline-end"
            className="transition-transform group-aria-expanded/week:rotate-180"
          />
        </CollapsibleTrigger>
        {single && week && (
          <MeteoblueLink
            forecast={week}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            {w.more}
          </MeteoblueLink>
        )}
      </div>
      <CollapsibleContent>
        {/* One of n, so a radio group – not filter chips, which say a count
            and can all be on at once. */}
        {!single && (
          <RadioGroup
            aria-label={w.places}
            value={String(chosen)}
            onValueChange={(v) => setChosen(Number(v))}
            className="my-2 flex flex-wrap gap-x-4 gap-y-2"
          >
            {places.map((p, i) => (
              <label
                key={placeKey(p)}
                className="flex cursor-pointer items-center gap-1.5 text-xs"
              >
                <RadioGroupItem value={String(i)} />
                {placeName(p, w)}
              </label>
            ))}
          </RadioGroup>
        )}
        {week && <WeekTable days={week.days} />}
      </CollapsibleContent>

      {!single && (
        <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {w.more}:
          {places.map((p) => (
            <MeteoblueLink
              key={placeKey(p)}
              forecast={p}
              className="text-foreground gap-0.5"
            >
              {placeName(p, w)}
            </MeteoblueLink>
          ))}
        </p>
      )}
    </Collapsible>
  );
};
