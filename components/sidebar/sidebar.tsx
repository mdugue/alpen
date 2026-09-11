"use client";

import { PanelLeftClose, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { FilterPanel } from "@/components/sidebar/filter-panel";
import { PassList } from "@/components/sidebar/pass-list";
import { KIND_GLYPH, Section } from "@/components/sidebar/section";
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
import { DEFAULT_FILTERS, hasActiveFilters } from "@/lib/app-state";
import type { EntityKind, Filters, Selection } from "@/lib/app-state";
import type { PassRow, TourRow, TownRow } from "@/lib/rows";
import type { Tour } from "@/lib/types";
import { cn, TOUCH_CONTROL } from "@/lib/utils";

export interface SidebarProps {
  /** `aside` renders the brand row; the bottom sheet shows its swipe handle instead. */
  variant: "aside" | "sheet";
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  passRows: PassRow[];
  tourRows: TourRow[];
  townRows: TownRow[];
  totals: Record<EntityKind, number>;
  favoriteCount: number;
  tours: Tour[];
  hiddenTours: string[];
  setHiddenTours: (update: (h: string[]) => string[]) => void;
  showPasses: boolean;
  setShowPasses: (v: boolean) => void;
  showTowns: boolean;
  setShowTowns: (v: boolean) => void;
  sections: EntityKind[];
  setSections: (update: (s: EntityKind[]) => EntityKind[]) => void;
  onToggleFavorite: (kind: EntityKind, slug: string) => void;
  onSelect: (sel: Selection) => void;
  /** Highlighted in the lists and scrolled into view. */
  selection: Selection | null;
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
  const toggleSection = (kind: EntityKind) => (open: boolean) =>
    p.setSections((s) =>
      open ? [...new Set([...s, kind])] : s.filter((k) => k !== kind),
    );
  const allTourSlugs = p.tours.map((t) => t.slug);
  const visibleTourCount = allTourSlugs.filter(
    (s) => !p.hiddenTours.includes(s),
  ).length;
  const lists = useRef<HTMLDivElement>(null);
  const currentRow = p.selection
    ? `${p.selection.kind}:${p.selection.slug}`
    : null;

  // Keep the selected row visible, e.g. after a click on a map marker.
  useEffect(() => {
    if (!currentRow) return;
    lists.current
      ?.querySelector(`[data-row="${currentRow}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentRow]);

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
          <FilterPanel
            filters={p.filters}
            setFilters={p.setFilters}
            favoriteCount={p.favoriteCount}
            hidden={p.peek}
            search={
              // On the peek row the field is a button that only opens the
              // sheet: a live input there would have the software keyboard
              // come up in the same moment as the sheet moves, and the two
              // animations fight over where the field ends up.
              p.peek ? (
                <Button
                  variant="outline"
                  onClick={p.onOpenSearch}
                  className={cn(
                    "text-muted-foreground flex-1 justify-start font-normal",
                    TOUCH_CONTROL,
                  )}
                >
                  <Search data-icon="inline-start" />
                  <span className="truncate">
                    {p.filters.query || "Pass, Tour oder Ort …"}
                  </span>
                </Button>
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
          />
          {hasActiveFilters(p.filters) && !p.peek && (
            <Button
              variant="link"
              size="sm"
              className="self-end px-0"
              onClick={resetFilters}
            >
              {p.filters.query
                ? "Suche und Filter zurücksetzen"
                : "Filter zurücksetzen"}
            </Button>
          )}
        </div>

        <div
          ref={lists}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <Section
            open={p.sections.includes("pass")}
            onOpenChange={toggleSection("pass")}
            glyph={KIND_GLYPH.pass}
            label="Pässe & Straßen"
            count={p.passRows.length}
            total={p.totals.pass}
            control={
              <Switch
                size="sm"
                checked={p.showPasses}
                onCheckedChange={p.setShowPasses}
                aria-label="Pässe und Straßen auf der Karte anzeigen"
              />
            }
          >
            <PassList
              rows={p.passRows}
              currentRow={currentRow}
              filters={p.filters}
              setFilters={p.setFilters}
              onSelect={(slug) => p.onSelect({ kind: "pass", slug })}
              onToggleFavorite={(slug) => p.onToggleFavorite("pass", slug)}
            />
          </Section>
          <Section
            open={p.sections.includes("tour")}
            onOpenChange={toggleSection("tour")}
            glyph={KIND_GLYPH.tour}
            label="Touren"
            count={p.tourRows.length}
            total={p.totals.tour}
            control={
              <div className="flex items-center gap-2">
                {visibleTourCount > 0 &&
                  visibleTourCount < allTourSlugs.length && (
                    <span className="text-muted-foreground text-2xs tabular-nums">
                      {visibleTourCount} von {allTourSlugs.length}
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
              </div>
            }
          >
            <TourList
              rows={p.tourRows}
              currentRow={currentRow}
              period={p.filters.period}
              hiddenTours={p.hiddenTours}
              onToggleTour={(slug, on) =>
                p.setHiddenTours((h) =>
                  on ? h.filter((s) => s !== slug) : [...new Set([...h, slug])],
                )
              }
              onSelect={(slug) => p.onSelect({ kind: "tour", slug })}
              onToggleFavorite={(slug) => p.onToggleFavorite("tour", slug)}
            />
          </Section>
          <Section
            open={p.sections.includes("town")}
            onOpenChange={toggleSection("town")}
            glyph={KIND_GLYPH.town}
            label="Orte"
            count={p.townRows.length}
            total={p.totals.town}
            control={
              <Switch
                size="sm"
                checked={p.showTowns}
                onCheckedChange={p.setShowTowns}
                aria-label="Orte auf der Karte anzeigen"
              />
            }
          >
            <TownList
              rows={p.townRows}
              currentRow={currentRow}
              onSelect={(slug) => p.onSelect({ kind: "town", slug })}
              onToggleFavorite={(slug) => p.onToggleFavorite("town", slug)}
            />
          </Section>
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
