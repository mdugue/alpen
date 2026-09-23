"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SITE_NAME } from "@/lib/brand";
import { fill } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n";
import { periodLabel } from "@/lib/period";
import { barTotal } from "@/lib/rows";
import type { SeasonBar } from "@/lib/rows";
import { GRADE_ORDER } from "@/lib/status";
import { cn, fmt, SHELL_BAR } from "@/lib/utils";

/**
 * The one sentence that says what this is, on the first screen, before
 * anything has been asked for – which is the whole reason the shell exists at
 * all. It is not a slogan: it is the chosen half-month and what the passes
 * currently in the list are doing in it, so it moves with every filter and
 * with every drag of the season band, and it is the same arithmetic the band's
 * ribbon draws (`seasonBand`, lib/rows.ts).
 *
 * The bar is translucent and sits **over** the map like every other surface in
 * this app; the map runs on underneath it rather than stopping at a card.
 */

/** "34 Pässe in bester Zeit, 61 gut, 42 eingeschränkt, 64 oft gesperrt"; the short form leaves out "gut". */
const counts = (bar: SeasonBar, long: boolean, w: Messages) =>
  GRADE_ORDER.filter((g) => long || g !== "good")
    .map((g) => fill(w.header.counts[g], { n: fmt(bar[g], 0, w.lang) }))
    .join(", ");

/**
 * "Anfang Oktober:" – or "Anfang Oktober, Pyrenäen:" once a range chip is
 * pressed. The range is the "where" the sentence is about then, and a
 * headline counting Pyrenean passes under the word Alpenpässe owes the
 * reader that one word (docs/plans/26-pyrenees.md).
 */
const Headline = ({
  bar,
  long,
  where,
}: {
  bar: SeasonBar;
  long: boolean;
  where: string | null;
}) => {
  const { t } = useT();
  return (
    <p className="min-w-0 text-sm leading-snug text-pretty">
      <span className="font-semibold">
        {periodLabel(bar.period, t)}
        {where ? `, ${where}` : ""}:
      </span>{" "}
      {barTotal(bar) === 0 ? t.header.noPass : `${counts(bar, long, t)}.`}
    </p>
  );
};

export const AppHeader = ({
  bar,
  where = null,
  sidebarOpen,
  onToggleSidebar,
  onOpenScales,
}: {
  /** The chosen half-month; the headline is its counts. */
  bar: SeasonBar;
  /** The ranges a chip narrowed the list to, as one phrase; `null` for all of them. */
  where?: string | null;
  /** The desktop sidebar's fold; the toggle is hidden where the list is a drawer. */
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenScales: () => void;
}) => {
  const { t } = useT();
  return (
    <header
      className={cn(
        "flex flex-col gap-0.5 border-b px-3 py-1.5 lg:flex-row lg:items-center lg:gap-4 lg:py-2",
        SHELL_BAR,
      )}
    >
      <div className="flex shrink-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                className="-ml-1 max-lg:hidden"
                onClick={onToggleSidebar}
                aria-label={
                  sidebarOpen ? t.header.hideSidebar : t.header.listAndFilters
                }
              />
            }
          >
            {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </TooltipTrigger>
          <TooltipContent>
            {sidebarOpen ? t.header.hideSidebar : t.header.listAndFilters}
          </TooltipContent>
        </Tooltip>
        <span className="bg-accent h-5 w-1 rounded-full" aria-hidden />
        <h1 className="font-heading text-sm font-bold tracking-wide uppercase">
          {SITE_NAME}
        </h1>
        <span className="text-muted-foreground truncate text-xs">
          {t.site.tagline}
        </span>
      </div>

      <div className="lg:hidden">
        <Headline bar={bar} long={false} where={where} />
      </div>
      <div className="min-w-0 max-lg:hidden">
        <Headline bar={bar} long where={where} />
      </div>

      <span className="text-muted-foreground ml-auto shrink-0 text-xs max-lg:hidden">
        {t.header.dataLine}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 max-lg:hidden"
        onClick={onOpenScales}
      >
        {t.header.scales}
      </Button>
    </header>
  );
};
