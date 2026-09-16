"use client";

import { PanelLeftClose, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  AppliedFilters,
  FilterBody,
  filterCount,
  FilterTrigger,
} from "@/components/sidebar/filter-panel";
import { KIND_LABEL, KindTabs } from "@/components/sidebar/kind-tabs";
import { PassList } from "@/components/sidebar/pass-list";
import { TourList } from "@/components/sidebar/tour-list";
import { TownList } from "@/components/sidebar/town-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { ALL_KINDS, DEFAULT_FILTERS } from "@/lib/app-state";
import type { EntityKind, Filters, Selection } from "@/lib/app-state";
import { hasSecondaryFilters } from "@/lib/filter-summary";
import type { PassRow, TourRow, TownRow } from "@/lib/rows";
import type { Tour } from "@/lib/types";
import { cn, fmt, TOUCH_CONTROL } from "@/lib/utils";

export interface SidebarProps {
  /** `aside` renders the brand row; the bottom sheet shows its swipe handle instead. */
  variant: "aside" | "sheet";
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  passRows: PassRow[];
  tourRows: TourRow[];
  townRows: TownRow[];
  totals: Record<EntityKind, number>;
  /** How many roads a filter change would leave – the number on every chip. */
  countWith: (patch: Partial<Filters>) => number;
  tours: Tour[];
  hiddenTours: string[];
  setHiddenTours: (update: (h: string[]) => string[]) => void;
  showPasses: boolean;
  setShowPasses: (v: boolean) => void;
  showTowns: boolean;
  setShowTowns: (v: boolean) => void;
  /** Which of the three lists is on screen. */
  tab: EntityKind;
  setTab: (kind: EntityKind) => void;
  onToggleFavorite: (kind: EntityKind, slug: string) => void;
  onSelect: (sel: Selection) => void;
  /** Highlighted in the lists and scrolled into view. */
  selection: Selection | null;
  /** What the pointer is over, on the map or in the list; the two share one highlight. */
  hovered: Selection | null;
  onHover: (sel: Selection | null) => void;
  onCollapse?: () => void;
  onOpenScales: () => void;
  /** Tap on the peek row's search button: the sheet opens, the field it reveals is the real one. */
  onOpenSearch?: () => void;
  /** Bottom sheet at its peek height: only the search row is visible. */
  peek?: boolean;
}

export const Sidebar = (p: SidebarProps) => {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    p.setFilters((f) => ({ ...f, [key]: value }));
  // The sort is a preference, not a filter: it survives the reset.
  const resetFilters = () =>
    p.setFilters((f) => ({
      ...DEFAULT_FILTERS,
      period: f.period,
      sort: f.sort,
    }));
  const allTourSlugs = p.tours.map((t) => t.slug);
  const visibleTourCount = allTourSlugs.filter(
    (s) => !p.hiddenTours.includes(s),
  ).length;
  // The panel opens by itself when a link carries filters; the visitor's own
  // toggling wins from then on. The second half stays folded until it is
  // needed, or until a filter inside it is already set.
  const [manual, setManual] = useState<boolean | null>(null);
  const active = filterCount(p.filters);
  const filtersOpen = manual ?? active > 0;
  const [more, setMore] = useState<boolean | null>(null);
  const moreOpen = more ?? hasSecondaryFilters(p.filters);

  const lists = useRef<HTMLDivElement>(null);
  const currentRow = p.selection
    ? `${p.selection.kind}:${p.selection.slug}`
    : null;

  const counts = {
    pass: p.passRows.length,
    tour: p.tourRows.length,
    town: p.townRows.length,
  };

  // Keep the selected row visible, e.g. after a click on a map marker. A
  // selection also starts a camera flight, and on a phone the sheet drops to
  // its peek row in the same moment – where a smooth scroll would animate a
  // list nobody can see, against the two animations that can be seen. Peeking,
  // the row is put in place at once instead; by the time the sheet is pulled
  // up again it is where it should be.
  useEffect(() => {
    if (!currentRow) return;
    lists.current?.querySelector(`[data-row="${currentRow}"]`)?.scrollIntoView({
      behavior: p.peek ? "instant" : "smooth",
      block: "nearest",
    });
    // Intentional: the row is the trigger; `peek` only says how to get there.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [currentRow, p.tab]);

  /**
   * Each kind's "auf der Karte" switch. It rides in the list's own toolbar
   * (`ListToolbar`), not beside the tab row: a control next to three tabs
   * reads as acting on all three.
   */
  const passSwitch = (
    <Switch
      size="sm"
      checked={p.showPasses}
      onCheckedChange={p.setShowPasses}
      aria-label="Pässe und Straßen auf der Karte anzeigen"
    />
  );
  const townSwitch = (
    <Switch
      size="sm"
      checked={p.showTowns}
      onCheckedChange={p.setShowTowns}
      aria-label="Orte auf der Karte anzeigen"
    />
  );
  const tourSwitch = (
    <span className="flex items-center gap-1.5">
      {visibleTourCount > 0 && visibleTourCount < allTourSlugs.length && (
        <span className="tabular-nums">
          {visibleTourCount}/{allTourSlugs.length}
        </span>
      )}
      <Switch
        size="sm"
        checked={p.hiddenTours.length === 0}
        onCheckedChange={(on) =>
          p.setHiddenTours(() => (on ? [] : allTourSlugs))
        }
        aria-label="Touren auf der Karte anzeigen"
      />
    </span>
  );

  const emptyProps = {
    countWith: p.countWith,
    filters: p.filters,
    onReset: resetFilters,
    setFilters: p.setFilters,
  };

  return (
    <div className="text-card-foreground flex h-full min-h-0 flex-col">
      {p.variant === "aside" ? (
        <div className="border-border flex h-11 shrink-0 items-center gap-2 border-b px-3">
          <span className="bg-accent h-5 w-1 rounded-full" aria-hidden />
          <h1 className="font-heading text-sm font-bold tracking-wide uppercase">
            Alpenpässe
          </h1>
          <span className="text-muted-foreground truncate text-xs">
            Rennradkarte
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto"
            onClick={p.onCollapse}
            aria-label="Seitenleiste ausblenden"
          >
            <PanelLeftClose />
          </Button>
        </div>
      ) : (
        <h1 className="sr-only">Alpenpässe – Rennradkarte</h1>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-border relative flex shrink-0 flex-col gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2">
            {
              /*
               * On the peek row the search is a **button that looks like a
               * button**, and it says what it opens.
               *
               * Two reasons, and they are different. The first is mechanical:
               * a live input here would bring the software keyboard up in the
               * same moment as the sheet moves, and the two animations fight
               * over where the field ends up – so the field a thumb reaches is
               * always in a sheet that already stands still. The second is
               * that the old control lied about it. It was a full-width
               * outlined box with a magnifier and grey placeholder text, which
               * is a search field in every app a visitor has ever used; tapping
               * it and getting a sheet instead of a caret is a small
               * betrayal every single time. It now reads "Suche" and carries
               * the counts beside it, so the row also answers the question the
               * phone's first screen never answered: what is in here at all.
               */
              p.peek ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={p.onOpenSearch}
                    className={cn("shrink-0", TOUCH_CONTROL)}
                  >
                    <Search data-icon="inline-start" />
                    {p.filters.query ? `„${p.filters.query}“` : "Suche"}
                  </Button>
                  <p className="text-muted-foreground text-2xs min-w-0 flex-1 truncate">
                    {ALL_KINDS.map(
                      (kind) => `${fmt(counts[kind])} ${KIND_LABEL[kind]}`,
                    ).join(" · ")}
                  </p>
                  {active > 0 && (
                    <Badge variant="secondary" className="shrink-0">
                      {active} Filter
                    </Badge>
                  )}
                </>
              ) : (
                <InputGroup className={cn("flex-1", TOUCH_CONTROL)}>
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="search"
                    name="q"
                    autoComplete="off"
                    enterKeyHint="search"
                    spellCheck={false}
                    value={p.filters.query}
                    onChange={(e) => set("query", e.target.value)}
                    placeholder="Pass, Tour oder Ort …"
                    aria-label="Suchen"
                    className="h-full [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
                  />
                  {p.filters.query && (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        onClick={() => set("query", "")}
                        aria-label="Suche leeren"
                      >
                        <X />
                      </InputGroupButton>
                    </InputGroupAddon>
                  )}
                </InputGroup>
              )
            }
            {!p.peek && (
              <FilterTrigger
                filters={p.filters}
                open={filtersOpen}
                onOpenChange={setManual}
              />
            )}
          </div>
          {/* What is filtered away stays readable while the panel is shut –
              and on the sheet's peek row, where the panel cannot be opened at
              all, it is the only place that says so. */}
          {!p.peek && (
            <AppliedFilters
              filters={p.filters}
              setFilters={p.setFilters}
              onReset={resetFilters}
            />
          )}
          {/* The three lists, one at a time. In the fixed header rather than
              in the scroll container, so the counts stay on screen while a
              list of 201 rows is scrolled – which a section header inside the
              container could not do without an opaque background it has no way
              to get (see `KindTabs`). */}
          {!p.peek && (
            <KindTabs
              active={p.tab}
              onChange={p.setTab}
              counts={counts}
              totals={p.totals}
            />
          )}
        </div>

        <div
          ref={lists}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {filtersOpen && !p.peek && (
            <div className="border-border border-b">
              <FilterBody
                filters={p.filters}
                setFilters={p.setFilters}
                counts={counts}
                totals={p.totals}
                countWith={p.countWith}
                onReset={resetFilters}
                more={moreOpen}
                onMoreChange={setMore}
              />
            </div>
          )}
          {p.tab === "pass" && (
            <PassList
              rows={p.passRows}
              currentRow={currentRow}
              hovered={p.hovered}
              onHover={p.onHover}
              filters={p.filters}
              setFilters={p.setFilters}
              empty={emptyProps}
              mapControl={passSwitch}
              onSelect={(slug) => p.onSelect({ kind: "pass", slug })}
              onToggleFavorite={(slug) => p.onToggleFavorite("pass", slug)}
            />
          )}
          {p.tab === "tour" && (
            <TourList
              rows={p.tourRows}
              currentRow={currentRow}
              hovered={p.hovered}
              onHover={p.onHover}
              period={p.filters.period}
              hiddenTours={p.hiddenTours}
              empty={emptyProps}
              mapControl={tourSwitch}
              onToggleTour={(slug, on) =>
                p.setHiddenTours((h) =>
                  on ? h.filter((s) => s !== slug) : [...new Set([...h, slug])],
                )
              }
              onSelect={(slug) => p.onSelect({ kind: "tour", slug })}
              onToggleFavorite={(slug) => p.onToggleFavorite("tour", slug)}
            />
          )}
          {p.tab === "town" && (
            <TownList
              rows={p.townRows}
              currentRow={currentRow}
              hovered={p.hovered}
              onHover={p.onHover}
              empty={emptyProps}
              mapControl={townSwitch}
              onSelect={(slug) => p.onSelect({ kind: "town", slug })}
              onToggleFavorite={(slug) => p.onToggleFavorite("town", slug)}
            />
          )}
        </div>

        <div
          className={cn("border-border shrink-0 border-t", p.peek && "hidden")}
        >
          <p className="text-muted-foreground text-2xs flex h-8 items-center gap-1 truncate px-3">
            <span className="truncate">
              Status ist eine Heuristik, Skalen sind redaktionell.
            </span>
            <Button
              variant="link"
              size="sm"
              className="h-auto shrink-0 p-0"
              onClick={p.onOpenScales}
            >
              Skalen &amp; Quellen
            </Button>
          </p>
          <p className="text-muted-foreground text-2xs flex items-center gap-3 px-3 pb-2">
            <Link
              href="/impressum"
              className="hover:text-foreground hover:underline"
            >
              Impressum
            </Link>
            <Link
              href="/datenschutz"
              className="hover:text-foreground hover:underline"
            >
              Datenschutz
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
