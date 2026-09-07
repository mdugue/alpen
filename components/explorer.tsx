"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { PassMap, type MapPass } from "@/components/map/pass-map";
import { DetailPanel } from "@/components/panel/detail-panel";
import { EntityTable, buildRows } from "@/components/entity-table";
import { Toolbar } from "@/components/toolbar";
import { ScalesDialog } from "@/components/scales-dialog";
import { Button } from "@/components/ui/button";
import { passStatus, tourStatus } from "@/lib/status";
import {
  DEFAULT_FILTERS,
  DEFAULT_VIEW,
  readHash,
  useFavorites,
  useStored,
  writeHash,
  type Filters,
  type MapView,
  type Selection,
} from "@/lib/app-state";
import type { ClimateYear, ElevationProfile, Pass, RouteGeometry, Tour, Town } from "@/lib/types";

interface Props {
  passes: Pass[];
  tours: Tour[];
  towns: Town[];
  routes: Record<string, RouteGeometry>;
  profiles: Record<string, ElevationProfile>;
  climate: Record<string, ClimateYear>;
}

const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export function Explorer({ passes, tours, towns, routes, profiles, climate }: Props) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [view, setView] = useState<MapView>(DEFAULT_VIEW);
  const [showTowns, setShowTowns] = useStored("alpenpaesse:showTowns", true);
  const [hiddenTours, setHiddenTours] = useStored<string[]>("alpenpaesse:hiddenTours", []);
  const [scalesOpen, setScalesOpen] = useState(false);
  const { isFavorite, toggle: toggleFavorite, count: favoriteCount } = useFavorites();

  // Startzustand aus dem URL-Hash (teilbare Ansicht). Bewusst im Effekt: beim
  // Server-Render gibt es keinen Hash, ein Lesen im ersten Render würde zu
  // einer Hydration-Abweichung führen.
  useEffect(() => {
    const h = readHash();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalige Initialisierung nach dem Mount
    setFilters((f) => ({ ...f, ...defined(h.filters) }));
    setView((v) => ({ ...v, ...defined(h.view) }));
    if (h.selection) setSelection(h.selection);
  }, []);

  useEffect(() => {
    writeHash(filters, selection, view);
  }, [filters, selection, view]);

  const visibleTours = useMemo(
    () => tours.filter((t) => !hiddenTours.includes(t.slug)).map((t) => t.slug),
    [tours, hiddenTours],
  );

  const rows = useMemo(
    () => buildRows(passes, tours, towns, filters, isFavorite, visibleTours),
    [passes, tours, towns, filters, isFavorite, visibleTours],
  );

  const visiblePassSlugs = useMemo(
    () => new Set(rows.filter((r) => r.kind === "pass").map((r) => r.slug)),
    [rows],
  );

  const mapPasses: MapPass[] = useMemo(
    () =>
      passes
        .filter((p) => visiblePassSlugs.has(p.slug))
        .map((p) => ({
          ...p,
          status: passStatus(p, filters.period),
          favorite: isFavorite("pass", p.slug),
        })),
    [passes, visiblePassSlugs, filters.period, isFavorite],
  );

  const mapTours = useMemo(
    () =>
      tours.map((t) => ({
        ...t,
        status: tourStatus(t, passes, filters.period),
        visible: visibleTours.includes(t.slug),
        geometry: routes[`tour:${t.slug}`] ?? t.waypoints.map((w) => [w.lat, w.lon] as [number, number]),
      })),
    [tours, passes, filters.period, visibleTours, routes],
  );

  const mapTowns = useMemo(
    () => towns.map((t) => ({ ...t, favorite: isFavorite("town", t.slug) })),
    [towns, isFavorite],
  );

  const toggleTour = useCallback(
    (slug: string, on: boolean) =>
      setHiddenTours((h) => (on ? h.filter((s) => s !== slug) : [...new Set([...h, slug])])),
    [setHiddenTours],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar
        filters={filters}
        onFilters={setFilters}
        showTowns={showTowns}
        onShowTowns={setShowTowns}
        allToursVisible={hiddenTours.length === 0}
        onAllTours={(on) => setHiddenTours(on ? [] : tours.map((t) => t.slug))}
        rowCount={rows.length}
        passCount={mapPasses.length}
        favoriteCount={favoriteCount}
        onOpenScales={() => setScalesOpen(true)}
      />

      <div className="grid min-h-0 flex-1 gap-3 px-3 pb-3 lg:grid-cols-[minmax(0,1fr)_29rem] xl:grid-cols-[minmax(0,1fr)_34rem]">
        <div className="relative h-[58vh] min-h-80 lg:h-[calc(100vh-11rem)]">
          <PassMap
            passes={mapPasses}
            tours={mapTours}
            towns={mapTowns}
            routes={routes}
            showTowns={showTowns}
            selection={selection}
            onSelect={setSelection}
            initialView={view}
            onViewChange={setView}
          />
          <DetailPanel
            selection={selection}
            period={filters.period}
            passes={passes}
            tours={tours}
            towns={towns}
            routes={routes}
            profiles={profiles}
            climate={climate}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            onSelect={setSelection}
            onClose={() => setSelection(null)}
            onOpenScales={() => setScalesOpen(true)}
          />
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card lg:h-[calc(100vh-11rem)]">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Button
              size="xs"
              variant={filters.favoritesOnly ? "accent" : "outline"}
              onClick={() => setFilters((f) => ({ ...f, favoritesOnly: !f.favoritesOnly }))}
            >
              <Star className={filters.favoritesOnly ? "fill-current" : ""} /> Gemerkt
              {favoriteCount > 0 && ` (${favoriteCount})`}
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {rows.length} Einträge · {mapPasses.length} Pässe
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <EntityTable
              rows={rows}
              period={filters.period}
              selection={selection}
              onSelect={setSelection}
              onToggleFavorite={toggleFavorite}
              onToggleTour={toggleTour}
            />
          </div>
        </div>
      </div>

      <ScalesDialog open={scalesOpen} onOpenChange={setScalesOpen} />
    </div>
  );
}
