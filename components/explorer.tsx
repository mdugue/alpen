"use client";

import { PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PassMap } from "@/components/map/pass-map";
import type { MapPass } from "@/components/map/pass-map";
import { PeriodScrubber } from "@/components/map/period-scrubber";
import { DetailPanel } from "@/components/panel/detail-panel";
import { ScalesDialog } from "@/components/scales-dialog";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerSwipeHandle,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ALL_KINDS,
  DEFAULT_FILTERS,
  DEFAULT_VIEW,
  defined,
  NO_SLUGS,
  readHash,
  readStoredPeriod,
  resolvePeriod,
  useFavorites,
  useStored,
  useStoredPeriod,
  writeHash,
} from "@/lib/app-state";
import type { EntityKind, Filters, MapView, Selection } from "@/lib/app-state";
import {
  buildPassRows,
  buildTourRows,
  buildTownRows,
  statusHistogram,
} from "@/lib/rows";
import { indexBySlug } from "@/lib/status";
import type {
  ClimateYear,
  ElevationProfile,
  Pass,
  Period,
  RouteGeometry,
  Tour,
  Town,
} from "@/lib/types";
import { MOBILE_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn, MAP_CONTROL, PANEL } from "@/lib/utils";

interface Props {
  passes: Pass[];
  tours: Tour[];
  towns: Town[];
  routes: Record<string, RouteGeometry>;
  profiles: Record<string, ElevationProfile>;
  climate: Record<string, ClimateYear>;
  /** Today's half-month, computed on the server in Europe/Berlin. */
  defaultPeriod: Period;
}

/** Floating panel geometry on desktop (px); keep in sync with the Tailwind widths below. */
const GAP = 12;
const SIDEBAR_W = { lg: 384, xl: 416 };
/** The detail panel grows with the viewport; the map keeps the larger half. */
const DETAIL_W = { lg: 352, xl: 400 };
/** Bottom sheet positions on phones: a peek row, half, and almost full. */
const SNAP_PEEK = "4.5rem";
const SNAP_POINTS = [SNAP_PEEK, 0.5, 0.82] as const;
type Snap = (typeof SNAP_POINTS)[number];

export function Explorer({
  passes,
  tours,
  towns,
  routes,
  profiles,
  climate,
  defaultPeriod,
}: Props) {
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    period: defaultPeriod,
  });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [view, setView] = useState<MapView>(DEFAULT_VIEW);
  const [showTowns, setShowTowns] = useStored("alpenpaesse:showTowns", true);
  const [hiddenTours, setHiddenTours] = useStored<string[]>(
    "alpenpaesse:hiddenTours",
    NO_SLUGS,
  );
  const [sections, setSections] = useStored<EntityKind[]>(
    "alpenpaesse:sections",
    ALL_KINDS,
  );
  const [sidebarOpen, setSidebarOpen] = useStored("alpenpaesse:sidebar", true);
  const [snap, setSnap] = useState<Snap>(SNAP_PEEK);
  const [scalesOpen, setScalesOpen] = useState(false);
  const {
    isFavorite,
    toggle: toggleFavorite,
    count: favoriteCount,
  } = useFavorites();
  const [, setStoredPeriod] = useStoredPeriod();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isXl = useMediaQuery("(width >= 80rem)");
  // Nothing is written to the hash before it has been read once; otherwise the
  // first commit would overwrite a shared link with the defaults.
  const [hashApplied, setHashApplied] = useState(false);
  // Camera from a hash pasted into an open page; the map applies it once.
  const [requestedView, setRequestedView] = useState<MapView | null>(null);
  const sidebarRoot = useRef<HTMLDivElement>(null);

  // Initial state from the URL hash (shareable view). Deliberately in an effect:
  // there is no hash during the server render, and reading it in the first
  // render would cause a hydration mismatch. The same listener applies a hash
  // pasted into the address bar of an already open page (a same-document
  // navigation, which never remounts); the hash is authoritative then.
  useEffect(() => {
    const apply = () => {
      const h = readHash();
      const hashView = { ...DEFAULT_VIEW, ...defined(h.view) };
      // Precedence: a shared link wins, then the visitor's own last choice,
      // then today's half-month from the server.
      const period = resolvePeriod(
        h.filters.period,
        readStoredPeriod(),
        defaultPeriod,
      );
      setFilters({ ...DEFAULT_FILTERS, ...defined(h.filters), period });
      setView(hashView);
      if (h.view.lat !== undefined || h.view.zoom !== undefined)
        setRequestedView(hashView);
      setSelection(h.selection);
      if (h.selection) {
        setSnap(0.5);
        if (h.selection.kind === "tour")
          setHiddenTours((t) => t.filter((s) => s !== h.selection!.slug));
        if (h.selection.kind === "town") setShowTowns(true);
      }
      setHashApplied(true);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
    // Intentional: the stored-state setters are stable.
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hashApplied) writeHash(filters, selection, view);
  }, [hashApplied, filters, selection, view]);

  const passIndex = indexBySlug(passes);
  const passRows = buildPassRows(passes, filters, isFavorite, climate);
  const tourRows = buildTourRows(
    tours,
    passIndex,
    filters,
    isFavorite,
    climate,
  );
  const townRows = buildTownRows(towns, filters, isFavorite);
  const histogram = statusHistogram(passes, filters, isFavorite, climate);

  const mapPasses: MapPass[] = passRows.map(({ pass, status, favorite }) => ({
    ...pass,
    status,
    favorite,
  }));
  // What the list shows for a kind is what the map shows for that kind; the
  // visibility switches only add a layer toggle on top.
  const mapTours = tourRows.map(({ tour: t, status }) => ({
    ...t,
    status,
    visible: !hiddenTours.includes(t.slug),
    geometry:
      routes[`tour:${t.slug}`] ??
      t.waypoints.map((w) => [w.lat, w.lon] as [number, number]),
  }));
  const mapTowns = townRows.map(({ town, favorite }) => ({
    ...town,
    favorite,
  }));

  /** Selecting something also makes it visible and brings the panel up. */
  const select = (sel: Selection) => {
    setSelection(sel);
    if (sel.kind === "tour")
      setHiddenTours((h) => h.filter((s) => s !== sel.slug));
    if (sel.kind === "town") setShowTowns(true);
    if (isMobile) setSnap(0.5);
  };

  /** Back to the list; focus returns to the row the detail came from. */
  const back = () => {
    const sel = selection;
    setSelection(null);
    requestAnimationFrame(() => {
      const root = sidebarRoot.current;
      const row =
        sel &&
        root?.querySelector<HTMLElement>(
          `[data-row="${sel.kind}:${sel.slug}"]`,
        );
      (row ?? root?.querySelector<HTMLElement>("input[type=search]"))?.focus({
        preventScroll: !row,
      });
    });
  };

  const detail = selection ? (
    <DetailPanel
      dismiss={isMobile ? "back" : "close"}
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
      onBack={back}
      onOpenScales={() => setScalesOpen(true)}
    />
  ) : null;

  const sidebar = (variant: "aside" | "sheet") => (
    <Sidebar
      variant={variant}
      peek={variant === "sheet" && snap === SNAP_PEEK}
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
      selection={selection}
      detail={variant === "sheet" ? detail : null}
      onCollapse={() => setSidebarOpen(false)}
      onOpenScales={() => setScalesOpen(true)}
      onSearchFocus={
        variant === "sheet" ? () => setSnap(SNAP_POINTS[2]) : undefined
      }
    />
  );

  // Height of the visible sheet part, so its own scroll container ends at the fold.
  const sheetHeight = typeof snap === "number" ? `${snap * 100}dvh` : snap;
  const insetBottom = !isMobile
    ? 0
    : typeof snap === "number"
      ? Math.round(window.innerHeight * 0.5)
      : 72;

  // Desktop: the panels float over the map; the map is padded by their width
  // so camera targets land in the visible part.
  const sidebarW = isXl ? SIDEBAR_W.xl : SIDEBAR_W.lg;
  const detailW = isXl ? DETAIL_W.xl : DETAIL_W.lg;
  const desktopPanels = isMobile
    ? []
    : [sidebarOpen ? sidebarW : 0, selection ? detailW : 0].filter(Boolean);
  const insetLeft = desktopPanels.reduce(
    (x, w) => x + w + GAP,
    desktopPanels.length ? GAP : 0,
  );
  const detailLeft = GAP + (!isMobile && sidebarOpen ? sidebarW + GAP : 0);

  return (
    <TooltipProvider delay={400}>
      <div className="relative h-dvh overflow-hidden">
        <div className="absolute inset-0">
          <PassMap
            passes={mapPasses}
            tours={mapTours}
            towns={mapTowns}
            routes={routes}
            showTowns={showTowns}
            selection={selection}
            onSelect={select}
            onViewChange={setView}
            requestedView={requestedView}
            insetLeft={insetLeft}
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
            <PeriodScrubber
              value={filters.period}
              today={defaultPeriod}
              histogram={histogram}
              onChange={(p) => {
                setFilters((f) => ({ ...f, period: p }));
                // Only the control writes the preference; applying a hash never does.
                setStoredPeriod(p);
              }}
            />
          </PassMap>
        </div>

        {!isMobile && sidebarOpen && (
          <aside
            ref={sidebarRoot}
            className={cn(
              "absolute top-3 bottom-3 left-3 z-20 flex w-96 flex-col overflow-hidden max-lg:hidden xl:w-104",
              PANEL,
            )}
          >
            {sidebar("aside")}
          </aside>
        )}

        {!isMobile && detail && (
          <section
            key={`${selection!.kind}:${selection!.slug}`}
            aria-label="Details"
            style={{ left: detailLeft }}
            className={cn(
              "absolute top-3 bottom-3 z-20 flex w-88 flex-col overflow-hidden max-lg:hidden xl:w-100",
              "animate-in fade-in-0 slide-in-from-left-4 duration-200 motion-reduce:animate-none",
              PANEL,
            )}
          >
            {detail}
          </section>
        )}

        {isMobile && (
          <Drawer
            open
            modal={false}
            disablePointerDismissal
            snapPoints={[...SNAP_POINTS]}
            snapPoint={snap}
            onSnapPointChange={(s, details) => {
              // A fast flick below the lowest snap point would dismiss the
              // sheet; keep it and settle on the peek row instead.
              if (s === null) {
                details.cancel();
                setSnap(SNAP_PEEK);
              } else {
                setSnap(s as Snap);
              }
            }}
            onOpenChange={() => {}}
          >
            <DrawerContent className="rounded-b-none border-b-0 [--drawer-inset:0px] data-[swipe-axis=y]:[--drawer-content-max-height:100dvh]">
              <DrawerTitle className="sr-only">Liste und Filter</DrawerTitle>
              {/* Tap target for users who do not swipe: peek → half → peek. */}
              <button
                type="button"
                onClick={() => setSnap(snap === SNAP_PEEK ? 0.5 : SNAP_PEEK)}
                aria-label={
                  snap === SNAP_PEEK ? "Liste ausklappen" : "Liste einklappen"
                }
                className="w-full shrink-0"
              >
                <DrawerSwipeHandle className="h-6" />
              </button>
              <div
                ref={sidebarRoot}
                style={{ height: `calc(${sheetHeight} - 1.5rem)` }}
                className="min-h-0"
              >
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
