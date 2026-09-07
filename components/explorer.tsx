"use client";

import { useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PassMap, type MapPass } from "@/components/map/pass-map";
import { PeriodControl } from "@/components/map/period-control";
import { DetailPanel } from "@/components/panel/detail-panel";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ScalesDialog } from "@/components/scales-dialog";
import { tourStatus } from "@/lib/status";
import { buildPassRows, buildTourRows, buildTownRows } from "@/lib/rows";
import {
  DEFAULT_FILTERS,
  DEFAULT_VIEW,
  readHash,
  useFavorites,
  useStored,
  writeHash,
  type EntityKind,
  type Filters,
  type MapView,
  type Selection,
} from "@/lib/app-state";
import { MOBILE_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn, MAP_CONTROL } from "@/lib/utils";
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

/** Bottom sheet positions on phones: a peek row, half, and almost full. */
const SNAP_PEEK = "4.5rem";
const SNAP_POINTS = [SNAP_PEEK, 0.5, 0.92] as const;
type Snap = (typeof SNAP_POINTS)[number];

export function Explorer({ passes, tours, towns, routes, profiles, climate }: Props) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [view, setView] = useState<MapView>(DEFAULT_VIEW);
  const [showTowns, setShowTowns] = useStored("alpenpaesse:showTowns", true);
  const [hiddenTours, setHiddenTours] = useStored<string[]>("alpenpaesse:hiddenTours", []);
  const [sections, setSections] = useStored<EntityKind[]>("alpenpaesse:sections", ["pass", "tour", "town"]);
  const [sidebarOpen, setSidebarOpen] = useStored("alpenpaesse:sidebar", true);
  const [snap, setSnap] = useState<Snap>(SNAP_PEEK);
  const [scalesOpen, setScalesOpen] = useState(false);
  const { isFavorite, toggle: toggleFavorite, count: favoriteCount } = useFavorites();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  // Nothing is written to the hash before it has been read once; otherwise the
  // first commit would overwrite a shared link with the defaults.
  const [hashApplied, setHashApplied] = useState(false);

  // Initial state from the URL hash (shareable view). Deliberately in an effect:
  // there is no hash during the server render, and reading it in the first
  // render would cause a hydration mismatch.
  // The same listener also applies a hash pasted into the address bar of an
  // already open page (a same-document navigation, which never remounts).
  useEffect(() => {
    const apply = () => {
      const h = readHash();
      setFilters((f) => ({ ...f, ...defined(h.filters) }));
      setView((v) => ({ ...v, ...defined(h.view) }));
      if (h.selection) {
        setSelection(h.selection);
        setSnap(0.5);
      }
      setHashApplied(true);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    if (hashApplied) writeHash(filters, selection, view);
  }, [hashApplied, filters, selection, view]);

  const passRows = buildPassRows(passes, filters, isFavorite);
  const tourRows = buildTourRows(tours, passes, filters, isFavorite);
  const townRows = buildTownRows(towns, filters, isFavorite);

  const mapPasses: MapPass[] = passRows.map(({ pass, status, favorite }) => ({ ...pass, status, favorite }));
  const mapTours = tours.map((t) => ({
    ...t,
    status: tourStatus(t, passes, filters.period),
    visible: !hiddenTours.includes(t.slug),
    geometry: routes[`tour:${t.slug}`] ?? t.waypoints.map((w) => [w.lat, w.lon] as [number, number]),
  }));
  const mapTowns = towns.map((t) => ({ ...t, favorite: isFavorite("town", t.slug) }));

  /** Selecting something also makes it visible and brings the panel up. */
  const select = (sel: Selection) => {
    setSelection(sel);
    if (sel.kind === "tour") setHiddenTours((h) => h.filter((s) => s !== sel.slug));
    if (sel.kind === "town") setShowTowns(true);
    if (isMobile) setSnap(0.5);
    else setSidebarOpen(true);
  };

  const detail = selection ? (
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
      onSelect={select}
      onBack={() => setSelection(null)}
      onOpenScales={() => setScalesOpen(true)}
    />
  ) : null;

  const sidebar = (variant: "aside" | "sheet") => (
    <Sidebar
      variant={variant}
      filters={filters}
      setFilters={setFilters}
      passRows={passRows}
      tourRows={tourRows}
      townRows={townRows}
      totals={{ pass: passes.length, tour: tours.length, town: towns.length }}
      favoriteCount={favoriteCount}
      tours={tours}
      hiddenTours={hiddenTours}
      setHiddenTours={setHiddenTours}
      showTowns={showTowns}
      setShowTowns={setShowTowns}
      sections={sections}
      setSections={setSections}
      onToggleFavorite={toggleFavorite}
      onSelect={select}
      detail={detail}
      onCollapse={() => setSidebarOpen(false)}
      onOpenScales={() => setScalesOpen(true)}
      onSearchFocus={variant === "sheet" ? () => setSnap(0.92) : undefined}
    />
  );

  // Height of the visible sheet part, so its own scroll container ends at the fold.
  const sheetHeight = typeof snap === "number" ? `${snap * 100}dvh` : snap;
  const insetBottom = !isMobile
    ? 0
    : typeof snap === "number"
      ? Math.round(window.innerHeight * 0.5)
      : 72;

  return (
    <TooltipProvider delay={400}>
      <div className="flex h-dvh overflow-hidden">
        {!isMobile && sidebarOpen && (
          <aside className="flex w-104 shrink-0 flex-col border-r border-border max-lg:hidden xl:w-md">
            {sidebar("aside")}
          </aside>
        )}

        <div className="relative min-w-0 flex-1">
          <PassMap
            passes={mapPasses}
            tours={mapTours}
            towns={mapTowns}
            routes={routes}
            showTowns={showTowns}
            selection={selection}
            onSelect={select}
            onViewChange={setView}
            insetBottom={insetBottom}
          >
            {!isMobile && !sidebarOpen && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-lg"
                      variant="outline"
                      className={cn("size-8", MAP_CONTROL)}
                      onClick={() => setSidebarOpen(true)}
                      aria-label="Seitenleiste einblenden"
                    />
                  }
                >
                  <PanelLeftOpen />
                </TooltipTrigger>
                <TooltipContent>Liste und Filter</TooltipContent>
              </Tooltip>
            )}
            <PeriodControl value={filters.period} onChange={(p) => setFilters((f) => ({ ...f, period: p }))} />
          </PassMap>
        </div>

        {isMobile && (
          <Drawer
            open
            modal={false}
            disablePointerDismissal
            snapPoints={[...SNAP_POINTS]}
            snapPoint={snap}
            onSnapPointChange={(s) => {
              if (s !== null) setSnap(s as Snap);
            }}
            onOpenChange={() => {}}
          >
            <DrawerContent className="rounded-b-none border-b-0 [--drawer-inset:0px] data-[swipe-axis=y]:[--drawer-content-max-height:100dvh]">
              <DrawerTitle className="sr-only">Liste und Filter</DrawerTitle>
              {/* Tap target for users who do not swipe: peek → half → peek. */}
              <button
                type="button"
                onClick={() => setSnap(snap === SNAP_PEEK ? 0.5 : SNAP_PEEK)}
                aria-label={snap === SNAP_PEEK ? "Liste ausklappen" : "Liste einklappen"}
                className="flex h-6 w-full shrink-0 cursor-grab items-center justify-center"
              >
                <span className="h-1 w-12 rounded-full bg-muted-foreground/40" aria-hidden />
              </button>
              <div style={{ height: `calc(${sheetHeight} - 1.5rem)` }} className="min-h-0">
                {sidebar("sheet")}
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>

      <ScalesDialog open={scalesOpen} onOpenChange={setScalesOpen} />
    </TooltipProvider>
  );
}
