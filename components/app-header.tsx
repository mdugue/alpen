"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";
import { periodLabel } from "@/lib/period";
import { barTotal } from "@/lib/rows";
import type { SeasonBar } from "@/lib/rows";
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

/** "34 Pässe in bester Zeit, 61 gut, 42 eingeschränkt, 64 oft gesperrt" */
const counts = (bar: SeasonBar, long: boolean) =>
  [
    `${fmt(bar.best)} Pässe in bester Zeit`,
    long ? `${fmt(bar.good)} gut` : null,
    `${fmt(bar.limited)} eingeschränkt`,
    `${fmt(bar.closed)} oft gesperrt`,
  ]
    .filter(Boolean)
    .join(", ");

const Headline = ({ bar, long }: { bar: SeasonBar; long: boolean }) => (
  <p className="min-w-0 text-sm leading-snug text-pretty">
    <span className="font-semibold">{periodLabel(bar.period)}:</span>{" "}
    {barTotal(bar) === 0
      ? "kein Pass in dieser Auswahl."
      : `${counts(bar, long)}.`}
  </p>
);

export const AppHeader = ({
  bar,
  sidebarOpen,
  onToggleSidebar,
  onOpenScales,
}: {
  /** The chosen half-month; the headline is its counts. */
  bar: SeasonBar;
  /** Desktop only: no sidebar toggle is rendered without a handler. */
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onOpenScales: () => void;
}) => (
  <header
    className={cn(
      "flex flex-col gap-0.5 border-b px-3 py-1.5 lg:flex-row lg:items-center lg:gap-4 lg:py-2",
      SHELL_BAR,
    )}
  >
    <div className="flex shrink-0 items-center gap-2">
      {onToggleSidebar && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                className="-ml-1 max-lg:hidden"
                onClick={onToggleSidebar}
                aria-label={
                  sidebarOpen ? "Seitenleiste ausblenden" : "Liste und Filter"
                }
              />
            }
          >
            {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </TooltipTrigger>
          <TooltipContent>
            {sidebarOpen ? "Seitenleiste ausblenden" : "Liste und Filter"}
          </TooltipContent>
        </Tooltip>
      )}
      <span className="bg-accent h-5 w-1 rounded-full" aria-hidden />
      <h1 className="font-heading text-sm font-bold tracking-wide uppercase">
        {SITE_NAME}
      </h1>
      <span className="text-muted-foreground truncate text-xs">
        {SITE_TAGLINE}
      </span>
    </div>

    <div className="lg:hidden">
      <Headline bar={bar} long={false} />
    </div>
    <div className="min-w-0 max-lg:hidden">
      <Headline bar={bar} long />
    </div>

    <span className="text-muted-foreground ml-auto shrink-0 text-xs max-lg:hidden">
      Klima 2015–2024 · Prognose 7 Tage
    </span>
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 max-lg:hidden"
      onClick={onOpenScales}
    >
      Skalen &amp; Quellen
    </Button>
  </header>
);
