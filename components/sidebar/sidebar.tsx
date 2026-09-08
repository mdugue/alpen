"use client";

import { PanelLeftClose, Search, Star, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { PassList } from "@/components/sidebar/pass-list";
import { KIND_GLYPH, Section } from "@/components/sidebar/section";
import { TourList } from "@/components/sidebar/tour-list";
import { TownList } from "@/components/sidebar/town-list";
import { StatusDot } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ALL_STATUS, DEFAULT_FILTERS, hasActiveFilters } from "@/lib/app-state";
import type { EntityKind, Filters, Selection } from "@/lib/app-state";
import type { PassRow, TourRow, TownRow } from "@/lib/rows";
import { STATUS_LABEL } from "@/lib/status";
import type { Status, Tour } from "@/lib/types";
import { cn, PRESSED } from "@/lib/utils";

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
  showTowns: boolean;
  setShowTowns: (v: boolean) => void;
  sections: EntityKind[];
  setSections: (update: (s: EntityKind[]) => EntityKind[]) => void;
  onToggleFavorite: (kind: EntityKind, slug: string) => void;
  onSelect: (sel: Selection) => void;
  /** Highlighted in the lists and scrolled into view. */
  selection: Selection | null;
  /** Rendered instead of the lists while an entity is selected; the lists stay mounted (scroll position, open sections). */
  detail: React.ReactNode;
  onCollapse?: () => void;
  onOpenScales: () => void;
  onSearchFocus?: () => void;
  /** Bottom sheet at its peek height: only the search row is visible. */
  peek?: boolean;
}

export function Sidebar(p: SidebarProps) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    p.setFilters((f) => ({ ...f, [key]: value }));
  const resetFilters = () =>
    p.setFilters((f) => ({ ...DEFAULT_FILTERS, period: f.period }));
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
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
            size="icon-sm"
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

      {p.detail ? (
        <div className="flex min-h-0 flex-1 flex-col">{p.detail}</div>
      ) : null}

      <div className={cn("flex min-h-0 flex-1 flex-col", p.detail && "hidden")}>
        <div className="border-border relative flex shrink-0 flex-col gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <InputGroup className="flex-1">
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
                onFocus={p.onSearchFocus}
                placeholder="Pass, Tour oder Ort …"
                aria-label="Suchen"
                className="[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
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
            <Toggle
              variant="outline"
              pressed={p.filters.favoritesOnly}
              onPressedChange={(on) => set("favoritesOnly", on)}
              aria-label="Nur Gemerkte anzeigen"
              className={PRESSED}
            >
              <Star className={cn(p.filters.favoritesOnly && "fill-current")} />
              {p.favoriteCount > 0 && (
                <span className="tabular-nums">{p.favoriteCount}</span>
              )}
            </Toggle>
          </div>
          <ToggleGroup
            multiple
            variant="outline"
            size="sm"
            spacing={0}
            value={p.filters.status}
            onValueChange={(v) =>
              set(
                "status",
                ALL_STATUS.filter((s) => v.includes(s)),
              )
            }
            aria-label="Status filtern"
            className={cn("w-full", p.peek && "hidden")}
          >
            {ALL_STATUS.map((s: Status) => {
              const active = p.filters.status.includes(s);
              return (
                <ToggleGroupItem
                  key={s}
                  value={s}
                  className={cn(
                    "flex-1 gap-1.5",
                    !active && "text-muted-foreground",
                  )}
                >
                  <StatusDot status={s} hollow={!active} />
                  {STATUS_LABEL[s]}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          {hasActiveFilters(p.filters) && !p.peek && (
            <Button
              variant="link"
              size="xs"
              className="h-auto self-end p-0"
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
            label="Pässe"
            count={p.passRows.length}
            total={p.totals.pass}
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
                    <span className="text-muted-foreground text-[11px] tabular-nums">
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
          <p className="text-muted-foreground flex h-8 items-center gap-1 truncate px-3 text-[11px]">
            <span className="truncate">
              Status ist eine Heuristik, Skalen sind redaktionell.
            </span>
            <Button
              variant="link"
              size="xs"
              className="h-auto shrink-0 p-0"
              onClick={p.onOpenScales}
            >
              Skalen &amp; Quellen
            </Button>
          </p>
          <p className="text-muted-foreground flex items-center gap-3 px-3 pb-2 text-[11px]">
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
}
