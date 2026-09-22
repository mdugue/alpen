"use client";

import { Coffee, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useT } from "@/components/i18n";
import { useSheet } from "@/components/mobile-sheet";
import { CompareSheet } from "@/components/sidebar/compare-sheet";
import { DestinationList } from "@/components/sidebar/destination-list";
import {
  AppliedFilters,
  FilterBody,
  FilterTrigger,
} from "@/components/sidebar/filter-panel";
import { KindTabs } from "@/components/sidebar/kind-tabs";
import { PassList } from "@/components/sidebar/pass-list";
import { TourList } from "@/components/sidebar/tour-list";
import { TownList } from "@/components/sidebar/town-list";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { isShown, shownTourCount } from "@/lib/app-state";
import type {
  Action,
  EntityKind,
  Filters,
  Selection,
  Shown,
} from "@/lib/app-state";
import { SUPPORT_URL } from "@/lib/brand";
import {
  filterCount,
  hasSecondaryFilters,
  resetFilters,
} from "@/lib/filter-summary";
import type { RangeName } from "@/lib/regions";
import { entityKey } from "@/lib/route-key";
import type { Rows } from "@/lib/rows";
import { cn, TOUCH_CONTROL } from "@/lib/utils";

export interface SidebarProps {
  /** Only says how a selected row is scrolled into view; the brand lives in the header. */
  variant: "aside" | "sheet";
  filters: Filters;
  /** The four filtered lists; one is on screen at a time. */
  rows: Rows;
  /** The destinations picked for the compare sheet (`AppState.compare`). */
  compare: readonly string[];
  totals: Record<EntityKind, number>;
  /** How many roads a filter change would leave – the number on every chip. */
  countWith: (patch: Partial<Filters>) => number;
  /** The ranges the data holds a road for; the "Gebirge" group shows with two or more. */
  ranges: readonly RangeName[];
  /** A range chip pressed: the filter and, with it, the frame (`range` in `reduce`). */
  onRange: (range: RangeName) => void;
  /** The "auf der Karte" switches. */
  shown: Shown;
  /** Which of the three lists is on screen. */
  tab: EntityKind;
  /** Highlighted in the lists and scrolled into view. */
  selection: Selection | null;
  /** What the pointer is over, on the map or in the list; the two share one highlight. */
  hovered: Selection | null;
  /** Everything the sidebar decides goes through `reduce` (`lib/app-state.ts`). */
  dispatch: (action: Action) => void;
  onToggleFavorite: (kind: EntityKind, slug: string) => void;
  onOpenScales: () => void;
  /**
   * Whether the filter panel is unfolded, `null` while nobody has said –
   * state of the sheet rather than of this component because the phone's
   * "Filter" button in the season bar opens the list *and* the panel in one
   * press (`explorer.tsx`).
   */
  filtersOpen: boolean | null;
}

export const Sidebar = (p: SidebarProps) => {
  const { t } = useT();
  const setFilters = (update: (f: Filters) => Filters) =>
    p.dispatch({ type: "filters", update });
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const reset = () => setFilters(resetFilters);
  const onSelect = (kind: EntityKind) => (slug: string) =>
    p.dispatch({ selection: { kind, slug }, type: "select" });
  const onHover = (sel: Selection | null) =>
    p.dispatch({ selection: sel, type: "hover" });
  const tourCount = p.totals.tour;
  const visibleTourCount = shownTourCount(p.shown, tourCount);
  // The panel opens by itself when a link carries filters; the visitor's own
  // toggling wins from then on. The second half stays folded until it is
  // needed, or until a filter inside it is already set.
  const filtersOpen = p.filtersOpen ?? filterCount(p.filters) > 0;
  const [more, setMore] = useState<boolean | null>(null);
  const moreOpen = more ?? hasSecondaryFilters(p.filters);
  const [compareOpen, setCompareOpen] = useState(false);
  // The sheet's columns, in the order they were picked; a slug the rows do not
  // hold – filtered away, or from a link naming an area this build has not
  // got – draws no column.
  const compared = p.compare
    .map((slug) => p.rows.destination.find((r) => r.destination.slug === slug))
    .filter((r) => r !== undefined);

  const lists = useRef<HTMLDivElement>(null);
  const { expanded } = useSheet();
  const currentRow = p.selection ? entityKey(p.selection) : null;

  const counts = {
    destination: p.rows.destination.length,
    pass: p.rows.pass.length,
    tour: p.rows.tour.length,
    town: p.rows.town.length,
  };

  // Keep the selected row visible, e.g. after a click on a map marker.
  //
  // `block: "nearest"` is the standard spelling of `scrollIntoViewIfNeeded`:
  // a row already in view is left alone, so no scroll is started for nothing.
  // In the sheet layout the behaviour is pinned to the browser's own instant
  // jump – deliberately no `"smooth"`, which is a scroll animation on the main
  // thread competing with the two animations that can be seen, the camera's
  // flight and the detail drawer sliding in over this very list. The list
  // stays where it is put, so by the time the detail is dismissed the row is
  // where it should be.
  useEffect(() => {
    if (!currentRow) return;
    lists.current?.querySelector(`[data-row="${currentRow}"]`)?.scrollIntoView({
      behavior: p.variant === "sheet" ? "instant" : "smooth",
      block: "nearest",
    });
    // Intentional: the row is the trigger; the variant only says how to get there.
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
      checked={p.shown.passes}
      onCheckedChange={(on) =>
        p.dispatch({ kind: "pass", on, type: "toggleKind" })
      }
      aria-label="Pässe und Straßen auf der Karte anzeigen"
    />
  );
  const townSwitch = (
    <Switch
      size="sm"
      checked={p.shown.towns}
      onCheckedChange={(on) =>
        p.dispatch({ kind: "town", on, type: "toggleKind" })
      }
      aria-label="Orte auf der Karte anzeigen"
    />
  );
  const tourSwitch = (
    <span className="flex items-center gap-1.5">
      {visibleTourCount > 0 && visibleTourCount < tourCount && (
        <span className="tabular-nums">
          {visibleTourCount}/{tourCount}
        </span>
      )}
      <Switch
        size="sm"
        checked={visibleTourCount === tourCount}
        onCheckedChange={(on) => p.dispatch({ on, type: "toggleTours" })}
        aria-label="Touren auf der Karte anzeigen"
      />
    </span>
  );

  const emptyProps = {
    countWith: p.countWith,
    filters: p.filters,
    onReset: reset,
    setFilters,
  };

  return (
    <div className="text-card-foreground flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-border relative flex shrink-0 flex-col gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2">
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
                placeholder={t.sidebar.searchPlaceholder}
                aria-label={t.sidebar.search}
                className="h-full [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
              />
              {p.filters.query && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    onClick={() => set("query", "")}
                    aria-label={t.sidebar.clearSearch}
                  >
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
            <FilterTrigger
              filters={p.filters}
              open={filtersOpen}
              onOpenChange={(open) => p.dispatch({ open, type: "filtersOpen" })}
            />
          </div>
          {/* What is filtered away stays readable while the panel is shut. */}
          <AppliedFilters
            filters={p.filters}
            setFilters={setFilters}
            onReset={reset}
          />
          {/* The four lists, one at a time. In the fixed header rather than
              in the scroll container, so the counts stay on screen while a
              list of 201 rows is scrolled – which a section header inside the
              container could not do without an opaque background it has no way
              to get (see `KindTabs`). */}
          <KindTabs
            active={p.tab}
            onChange={(tab) => p.dispatch({ tab, type: "tab" })}
            counts={counts}
            totals={p.totals}
          />
        </div>

        <div
          ref={lists}
          data-scroller
          className={cn(
            "min-h-0 flex-1 overscroll-contain",
            // Below the sheet's top snap point the drag belongs to the sheet,
            // not to 201 rows (`useSheet`).
            expanded ? "overflow-y-auto" : "overflow-hidden",
          )}
        >
          {filtersOpen && (
            <div className="border-border border-b">
              <FilterBody
                filters={p.filters}
                setFilters={setFilters}
                counts={counts}
                totals={p.totals}
                countWith={p.countWith}
                ranges={p.ranges}
                onRange={p.onRange}
                onReset={reset}
                more={moreOpen}
                onMoreChange={setMore}
              />
            </div>
          )}
          {p.tab === "destination" && (
            <DestinationList
              rows={p.rows.destination}
              currentRow={currentRow}
              hovered={p.hovered}
              onHover={onHover}
              period={p.filters.period}
              empty={emptyProps}
              showRange={p.ranges.length > 1}
              compare={p.compare}
              onCompare={(slug, on) =>
                p.dispatch({ on, slug, type: "compare" })
              }
              onOpenCompare={() => setCompareOpen(true)}
              onSelect={onSelect("destination")}
              onToggleFavorite={(slug) =>
                p.onToggleFavorite("destination", slug)
              }
            />
          )}
          {p.tab === "pass" && (
            <PassList
              rows={p.rows.pass}
              currentRow={currentRow}
              hovered={p.hovered}
              onHover={onHover}
              filters={p.filters}
              setFilters={setFilters}
              empty={emptyProps}
              mapControl={passSwitch}
              onSelect={onSelect("pass")}
              onToggleFavorite={(slug) => p.onToggleFavorite("pass", slug)}
            />
          )}
          {p.tab === "tour" && (
            <TourList
              rows={p.rows.tour}
              currentRow={currentRow}
              hovered={p.hovered}
              onHover={onHover}
              period={p.filters.period}
              isShown={(slug) => isShown(p.shown, "tour", slug)}
              empty={emptyProps}
              mapControl={tourSwitch}
              showRange={p.ranges.length > 1}
              onToggleTour={(slug, on) =>
                p.dispatch({ on, slug, type: "toggleTour" })
              }
              onSelect={onSelect("tour")}
              onToggleFavorite={(slug) => p.onToggleFavorite("tour", slug)}
            />
          )}
          {p.tab === "town" && (
            <TownList
              rows={p.rows.town}
              currentRow={currentRow}
              hovered={p.hovered}
              onHover={onHover}
              empty={emptyProps}
              mapControl={townSwitch}
              showRange={p.ranges.length > 1}
              onSelect={onSelect("town")}
              onToggleFavorite={(slug) => p.onToggleFavorite("town", slug)}
            />
          )}
        </div>

        <CompareSheet
          open={compareOpen}
          onOpenChange={setCompareOpen}
          rows={compared}
          period={p.filters.period}
          onRemove={(slug) => p.dispatch({ on: false, slug, type: "compare" })}
          onSelect={(slug) => {
            setCompareOpen(false);
            onSelect("destination")(slug);
          }}
        />

        <div className="border-border shrink-0 border-t">
          <p className="text-muted-foreground text-2xs flex h-8 items-center gap-1 truncate px-3">
            <span className="truncate">{t.sidebar.footerNote}</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto shrink-0 p-0"
              onClick={p.onOpenScales}
            >
              {t.header.scales}
            </Button>
          </p>
          <div className="text-muted-foreground text-2xs flex items-center gap-3 px-3 pb-2">
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
            {/* The one call to action in the footer, so it is a button, in
                the outline the detail panel gives its external links – not a
                third muted word in the legal row. It is a plain link to
                Ko-fi, not its widget: nothing loads from there until it is
                clicked, which is what the privacy page says about it. */}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              render={
                <a
                  href={SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Auf Ko-fi unterstützen"
                />
              }
              nativeButton={false}
            >
              <Coffee data-icon="inline-start" aria-hidden />
              {t.sidebar.support}
              <span className="sr-only"> – auf Ko-fi, öffnet in neuem Tab</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
