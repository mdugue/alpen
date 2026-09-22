"use client";

import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useSyncExternalStore } from "react";

import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SITE_NAME } from "@/lib/brand";
import { otherLang } from "@/lib/i18n";
import type { Lang, Messages } from "@/lib/i18n";
import { periodLabel } from "@/lib/period";
import { barTotal } from "@/lib/rows";
import type { SeasonBar } from "@/lib/rows";
import { useStored } from "@/lib/use-stored";
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
const counts = (
  bar: SeasonBar,
  long: boolean,
  t: Messages["header"]["counts"],
  lang: Lang,
) =>
  [
    t.best(fmt(bar.best, 0, lang)),
    long ? t.good(fmt(bar.good, 0, lang)) : null,
    t.limited(fmt(bar.limited, 0, lang)),
    t.closed(fmt(bar.closed, 0, lang)),
  ]
    .filter(Boolean)
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
  const { t, lang } = useT();
  return (
    <p className="min-w-0 text-sm leading-snug text-pretty">
      <span className="font-semibold">
        {periodLabel(bar.period, lang)}
        {where ? `, ${where}` : ""}:
      </span>{" "}
      {barTotal(bar) === 0
        ? t.header.noPass
        : `${counts(bar, long, t.header.counts, lang)}.`}
    </p>
  );
};

/**
 * The first-visit hint (plan 08): a browser whose language is the other one,
 * on a page nothing has been stored for yet, is offered the other version
 * once. Read after mount – the language of the browser is nothing the server
 * knows, and the prerendered page must not differ from the first client
 * render. A dismissal or a switch stores the page's or the other language,
 * and the hint never shows again on this browser.
 */
/** Nothing to subscribe to: the browser's language does not change under a page. */
const never = () => () => {
  /* nothing subscribed, nothing to release */
};
const browserLang = () => navigator.language.slice(0, 2).toLowerCase();
const useLangHint = (lang: Lang, otherHref: string) => {
  const [stored, setStored] = useStored("lang");
  // The browser's language is an external value the server does not have:
  // null in the prerender, read once the client is up.
  const browser = useSyncExternalStore(never, browserLang, () => null);
  if (stored !== null || browser === null || browser !== otherLang(lang))
    return null;
  return {
    accept: () => setStored(otherLang(lang)),
    dismiss: () => setStored(lang),
    href: otherHref,
  };
};

export const AppHeader = ({
  bar,
  where = null,
  sidebarOpen,
  onToggleSidebar,
  onOpenScales,
  otherHref,
}: {
  /** The chosen half-month; the headline is its counts. */
  bar: SeasonBar;
  /** The ranges a chip narrowed the list to, as one phrase; `null` for all of them. */
  where?: string | null;
  /** Desktop only: no sidebar toggle is rendered without a handler. */
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onOpenScales: () => void;
  /** The same view in the other language (`switchLangHref`). */
  otherHref: string;
}) => {
  const { t, lang } = useT();
  const other = otherLang(lang);
  const hint = useLangHint(lang, otherHref);
  return (
    <header
      className={cn(
        "relative flex flex-col gap-0.5 border-b px-3 py-1.5 lg:flex-row lg:items-center lg:gap-4 lg:py-2",
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
        )}
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
      {/* The other language, as a plain link: the same path under the other
        prefix, with the hash – camera, half-month, selection – carried along
        (`switchLangHref`). A full load on purpose: the page under the other
        prefix is another prerender, and the text of every row changes with
        it. */}
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 font-semibold tracking-wide uppercase"
        render={<a href={otherHref} hrefLang={other} lang={other} />}
        nativeButton={false}
      >
        {other}
        <span className="sr-only"> – {t.header.switchTo}</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 max-lg:hidden"
        onClick={onOpenScales}
      >
        {t.header.scales}
      </Button>
      {hint && (
        <div
          role="status"
          // Over the map rather than in the header's flow: it appears after
          // hydration, and a row that grows then would move every tab and
          // control under it. Right-aligned short of the map's own corner
          // controls, which stay reachable beside it.
          className="bg-card text-foreground border-border/60 absolute top-full right-16 left-3 z-40 mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg lg:left-auto"
        >
          <span>{t.header.hint}</span>
          <a
            href={otherHref}
            hrefLang={other}
            lang={other}
            className="text-foreground font-semibold underline"
            onClick={hint.accept}
          >
            {t.header.hintOpen}
          </a>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-label={t.header.hintDismiss}
            onClick={hint.dismiss}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}
    </header>
  );
};
