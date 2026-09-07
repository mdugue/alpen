"use client";

import { PanelLeftClose, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { KIND_GLYPH, Section } from "@/components/sidebar/section";
import { PassList } from "@/components/sidebar/pass-list";
import { TourList } from "@/components/sidebar/tour-list";
import { TownList } from "@/components/sidebar/town-list";
import { StatusDot } from "@/components/status-badge";
import {
  ALL_STATUS,
  DEFAULT_FILTERS,
  hasActiveFilters,
  type EntityKind,
  type Filters,
  type Selection,
} from "@/lib/app-state";
import { STATUS_LABEL } from "@/lib/status";
import type { PassRow, TourRow, TownRow } from "@/lib/rows";
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
  /** Rendered instead of the lists while an entity is selected; the lists stay mounted (scroll position, open sections). */
  detail: React.ReactNode;
  onCollapse?: () => void;
  onOpenScales: () => void;
  onSearchFocus?: () => void;
}

export function Sidebar(p: SidebarProps) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    p.setFilters((f) => ({ ...f, [key]: value }));
  const resetFilters = () => p.setFilters((f) => ({ ...DEFAULT_FILTERS, period: f.period }));
  const toggleSection = (kind: EntityKind) => (open: boolean) =>
    p.setSections((s) => (open ? [...new Set([...s, kind])] : s.filter((k) => k !== kind)));
  const allTourSlugs = p.tours.map((t) => t.slug);
  const visibleTourCount = allTourSlugs.filter((s) => !p.hiddenTours.includes(s)).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-card text-card-foreground">
      {p.variant === "aside" ? (
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
          <span className="h-5 w-1 rounded-full bg-accent" aria-hidden />
          <h1 className="font-heading text-sm font-bold tracking-wide uppercase">Alpenpässe</h1>
          <span className="truncate text-xs text-muted-foreground">Rennradkarte</span>
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
        <div className="relative flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2">
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
              />
              {p.filters.query && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs" onClick={() => set("query", "")} aria-label="Suche leeren">
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
              {p.favoriteCount > 0 && <span className="tabular-nums">{p.favoriteCount}</span>}
            </Toggle>
          </div>
          <ToggleGroup
            multiple
            variant="outline"
            size="sm"
            spacing={0}
            value={p.filters.status}
            onValueChange={(v) => {
              if (v.length) set("status", ALL_STATUS.filter((s) => v.includes(s)));
            }}
            aria-label="Status filtern"
            className="w-full"
          >
            {ALL_STATUS.map((s: Status) => (
              <ToggleGroupItem key={s} value={s} className="flex-1 gap-1.5 not-aria-pressed:opacity-45">
                <StatusDot status={s} />
                {STATUS_LABEL[s]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {hasActiveFilters(p.filters) && (
            <Button variant="link" size="xs" className="h-auto self-end p-0" onClick={resetFilters}>
              Filter zurücksetzen
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
              filters={p.filters}
              setFilters={p.setFilters}
              onSelect={(slug) => p.onSelect({ kind: "pass", slug })}
              onToggleFavorite={(slug) => p.onToggleFavorite("pass", slug)}
              onResetFilters={resetFilters}
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
                {visibleTourCount > 0 && visibleTourCount < allTourSlugs.length && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {visibleTourCount} von {allTourSlugs.length}
                  </span>
                )}
                <Switch
                  size="sm"
                  checked={visibleTourCount > 0}
                  onCheckedChange={(on) => p.setHiddenTours(() => (on ? [] : allTourSlugs))}
                  aria-label="Touren auf der Karte anzeigen"
                />
              </div>
            }
          >
            <TourList
              rows={p.tourRows}
              hiddenTours={p.hiddenTours}
              onToggleTour={(slug, on) =>
                p.setHiddenTours((h) => (on ? h.filter((s) => s !== slug) : [...new Set([...h, slug])]))
              }
              onSelect={(slug) => p.onSelect({ kind: "tour", slug })}
              onToggleFavorite={(slug) => p.onToggleFavorite("tour", slug)}
              onResetFilters={resetFilters}
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
              onSelect={(slug) => p.onSelect({ kind: "town", slug })}
              onToggleFavorite={(slug) => p.onToggleFavorite("town", slug)}
              onResetFilters={resetFilters}
            />
          </Section>
        </div>

        <p className="flex h-8 shrink-0 items-center gap-1 truncate border-t border-border px-3 text-[11px] text-muted-foreground">
          <span className="truncate">Status ist eine Heuristik, Skalen sind redaktionell.</span>
          <Button variant="link" size="xs" className="h-auto shrink-0 p-0 text-[11px]" onClick={p.onOpenScales}>
            Skalen &amp; Quellen
          </Button>
        </p>
      </div>
    </div>
  );
}
