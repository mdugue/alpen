"use client";

import { Info, RotateCcw } from "lucide-react";
import { useRef } from "react";

import { useT } from "@/components/i18n";
import { CELL } from "@/components/season-strip";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { dayLength } from "@/lib/daylight";
import type { Lang, Messages } from "@/lib/i18n";
import {
  monthInitialsOf,
  monthsOf,
  periodAt,
  periodIndex,
  periodLabel,
  PERIODS,
} from "@/lib/period";
import type { SeasonBand as Band, SeasonBar } from "@/lib/rows";
import { GRADE_ORDER, gradeLabel } from "@/lib/status";
import type { Grade } from "@/lib/status";
import type { Period } from "@/lib/types";
import { cn, fmt } from "@/lib/utils";

/**
 * The half-month drives every colour on the map, so it is the one domain
 * control that has a bar of its own: along the bottom of the screen on a
 * phone, a card at the foot of the map beside the panels on desktop – over
 * the map like everything else.
 *
 * Each of the 24 columns carries three quantities of the passes currently in
 * the list, not one colour:
 *
 * - the **bar's height and fill**: their mean daily maximum, so the shape of
 *   the year is visible before a single word is read;
 * - the **ribbon**: the grade most of them are in, in the season strip's own
 *   fills (`RIBBON`), so the band and a row's strip say the same thing in the
 *   same colours;
 * - the **hanging bar**: their mean share of days with snowfall, which is what
 *   turns a warm-looking April into one you would not ride.
 *
 * The bar is relative by design: its height maps the band's own coldest
 * half-month to its warmest, because what it is for is comparing half-months,
 * not reading a temperature off an axis. The numbers of the chosen one are
 * spelled out above it, and they are means over summits of different heights –
 * a property of the current selection, which is why the label says "der
 * gezeigten Pässe" rather than naming the Alps.
 */

/** Where the bars start, so the coldest half-month is still a bar. */
const MIN_BAR_PCT = 12;

/**
 * The ribbon's fills. Three of them are the season strip's own (`CELL`), so a
 * column here and a strip in a row say the same thing in the same colours.
 * "Oft gesperrt" is the exception: a strip draws it hollow with a red hairline
 * so that a winter of closures stays light at 4 px, but a ribbon cell is ten
 * times as wide and a hollow one reads there as a hole in the band rather than
 * as a colour. It keeps the hue and takes a fill light enough to stay quiet –
 * the same light red the mini strips resolve to at their size.
 */
const RIBBON: Record<Grade, string> = {
  ...CELL,
  closed: "bg-status-closed/20",
};

/** One column's share of the rail; the thumb is laid out in the same unit. */
const COLUMN_PCT = 100 / PERIODS.length;

/**
 * Where `value` sits between `lo` and `hi`, 0…1; 0.5 when the two are equal,
 * which is the only honest answer for a band whose temperature never moves.
 */
const ramp = (value: number, lo: number, hi: number) =>
  hi === lo ? 0.5 : (value - lo) / (hi - lo);

/** The words and the number format the two sentences below are built with. */
interface Words {
  lang: Lang;
  t: Messages["band"];
}

/** "9,4 °C / −1,2 °C · 25 % Schnee · 31 % nass · 11 h Tageslicht" */
const summary = (
  bar: SeasonBar,
  lat: number | null,
  long: boolean,
  { lang, t }: Words,
) => {
  const parts: string[] = [];
  if (bar.tmax !== null && bar.tmin !== null)
    parts.push(`${fmt(bar.tmax, 1, lang)} / ${fmt(bar.tmin, 1, lang)} °C`);
  if (bar.snowPct !== null) parts.push(t.snow(fmt(bar.snowPct, 0, lang)));
  if (bar.wetPct !== null) parts.push(t.wet(fmt(bar.wetPct, 0, lang)));
  if (long && lat !== null)
    parts.push(t.daylight(fmt(dayLength(lat, bar.period), 1, lang)));
  return parts.join(" · ");
};

/** What a screen reader hears instead of 24 columns of colour. */
const spoken = (bar: SeasonBar, lat: number | null, words: Words) => {
  const { lang, t } = words;
  return [
    `${periodLabel(bar.period, lang)}: ${bar.grade ? t.mostly(gradeLabel(bar.grade, lang)) : t.noPass}`,
    GRADE_ORDER.map(
      (g) => `${fmt(bar[g], 0, lang)} ${gradeLabel(g, lang)}`,
    ).join(", "),
    summary(bar, lat, true, words),
  ]
    .filter(Boolean)
    .join(". ");
};

/**
 * What the three shapes of a column mean. Behind the band's ⓘ on desktop
 * (`legend`), and in the scales dialog, which is where a phone reads it –
 * three lines of legend next to a band that is already only 390 px wide would
 * leave neither of them legible.
 */
export const SeasonBandLegend = ({ className }: { className?: string }) => {
  const { t } = useT();
  return (
    <dl className={cn("text-2xs flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <dt aria-hidden className="shrink-0">
          <span
            className="block h-5 w-2.5 rounded-xs"
            style={{
              background:
                "linear-gradient(to top, var(--temp-cold), var(--temp-warm))",
            }}
          />
        </dt>
        <dd>{t.band.legend.bar}</dd>
      </div>
      <div className="flex items-center gap-2">
        <dt aria-hidden className="flex w-8 shrink-0 gap-px">
          {GRADE_ORDER.map((g) => (
            <span key={g} className={cn("h-2 flex-1 rounded-xs", RIBBON[g])} />
          ))}
        </dt>
        <dd>{t.band.legend.ribbon}</dd>
      </div>
      <div className="flex items-center gap-2">
        <dt aria-hidden className="shrink-0">
          <span className="bg-chart-4 block h-4 w-2.5 rounded-xs" />
        </dt>
        <dd>{t.band.legend.snow}</dd>
      </div>
    </dl>
  );
};

export const SeasonBand = ({
  band,
  bar,
  onChange,
  today,
  legend = false,
  className,
}: {
  band: Band;
  /** The chosen half-month's column (`currentBar`), the one the headline reads too. */
  bar: SeasonBar;
  onChange: (p: Period) => void;
  /** Today's half-month, marked on the rail and offered as the way back. */
  today?: Period;
  /** Offer the legend behind an ⓘ beside the label. */
  legend?: boolean;
  className?: string;
}) => {
  const { t: messages, lang } = useT();
  const words: Words = { lang, t: messages.band };
  const rail = useRef<HTMLDivElement>(null);
  const index = periodIndex(bar.period);
  const todayIndex = today === undefined ? -1 : periodIndex(today);
  const temps = band.bars.map((b) => b.tmax).filter((t) => t !== null);
  const lo = temps.length ? Math.min(...temps) : 0;
  const hi = temps.length ? Math.max(...temps) : 0;

  const go = (i: number) => {
    const next = periodAt(Math.min(PERIODS.length - 1, Math.max(0, i)));
    if (next !== bar.period) onChange(next);
  };

  const fromPointer = (clientX: number) => {
    const rect = rail.current?.getBoundingClientRect();
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
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="font-heading shrink-0 text-sm font-bold lg:text-base">
          {periodLabel(bar.period, lang)}
        </span>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs tabular-nums">
          <span className="lg:hidden">
            {summary(bar, band.lat, false, words)}
          </span>
          <span className="max-lg:hidden">
            {summary(bar, band.lat, true, words)}
          </span>
        </span>
        {legend && (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  aria-label={words.t.whatBarsMean}
                />
              }
            >
              <Info />
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-72">
              <SeasonBandLegend className="text-muted-foreground" />
            </PopoverContent>
          </Popover>
        )}
        {today !== undefined && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => onChange(today)}
                  disabled={bar.period === today}
                  aria-label={words.t.backToToday(periodLabel(today, lang))}
                />
              }
            >
              <RotateCcw />
            </TooltipTrigger>
            <TooltipContent>
              {words.t.today(periodLabel(today, lang))}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div
        ref={rail}
        role="slider"
        tabIndex={0}
        aria-label={words.t.period}
        aria-valuemin={1}
        aria-valuemax={PERIODS.length}
        aria-valuenow={index + 1}
        aria-valuetext={spoken(bar, band.lat, words)}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            fromPointer(e.clientX);
        }}
        className="focus-visible:ring-ring/50 relative flex cursor-pointer touch-none items-stretch rounded-md outline-none focus-visible:ring-2"
      >
        {/* The columns carry no gap of their own: each is exactly 1/24 wide,
            so the thumb lines up with them at any width. The visual gap is
            each column's own inset. */}
        {band.bars.map((b, i) => (
          <span
            key={b.period}
            className="relative flex flex-1 flex-col gap-0.5 px-px"
          >
            {i === todayIndex && (
              <span
                aria-hidden
                className="bg-foreground/45 absolute inset-x-px -top-1 h-0.5 rounded-full"
              />
            )}
            <span
              aria-hidden
              className="flex h-7 items-end lg:h-10"
              title={`${periodLabel(b.period, lang)}: ${spoken(b, band.lat, words)}`}
            >
              <span
                className="w-full rounded-t-xs"
                style={{
                  background:
                    b.tmax === null
                      ? "var(--muted)"
                      : `color-mix(in oklab, var(--temp-warm) ${ramp(b.tmax, lo, hi) * 100}%, var(--temp-cold))`,
                  height:
                    b.tmax === null
                      ? "2%"
                      : `${MIN_BAR_PCT + (100 - MIN_BAR_PCT) * ramp(b.tmax, lo, hi)}%`,
                }}
              />
            </span>
            <span
              aria-hidden
              className={cn(
                "h-1.5 rounded-xs lg:h-2",
                b.grade ? RIBBON[b.grade] : "bg-muted",
              )}
            />
            <span aria-hidden className="h-2.5 lg:h-3">
              <span
                className="bg-chart-4 block w-full rounded-b-xs"
                style={{ height: `${b.snowPct ?? 0}%` }}
              />
            </span>
          </span>
        ))}
        {/* The thumb frames its own column without reaching into its
            neighbours, so the chosen half-month is readable without hue. */}
        <span
          aria-hidden
          style={{ left: `${index * COLUMN_PCT}%`, width: `${COLUMN_PCT}%` }}
          className="ring-foreground pointer-events-none absolute -inset-y-1 rounded-md ring-2 ring-inset"
        />
      </div>

      <div
        aria-hidden
        className="text-muted-foreground text-2xs flex leading-none"
      >
        {monthInitialsOf(lang).map((m, i) => (
          <span
            key={m + String(i)}
            className={cn(
              "flex-1 text-center",
              Math.floor(index / 2) === i && "text-foreground font-semibold",
            )}
          >
            <span className="lg:hidden">{m}</span>
            <span className="max-lg:hidden">
              {monthsOf(lang)[i]!.slice(0, 3)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};
