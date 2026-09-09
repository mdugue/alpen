"use client";

import { PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PassMap } from "@/components/map/pass-map";
import type { MapPass } from "@/components/map/pass-map";
import { PeriodScrubber } from "@/components/map/period-scrubber";
import { MobileSheet, snapPx } from "@/components/mobile-sheet";
import { DetailPanel } from "@/components/panel/detail-panel";
import { ScalesDialog } from "@/components/scales-dialog";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Button } from "@/components/ui/button";
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
import type { MapAssets } from "@/lib/map-assets";
import type { NearbyTours } from "@/lib/nearby";
import {
  buildPassRows,
  buildTourRows,
  buildTownRows,
  statusHistogram,
} from "@/lib/rows";
import { indexBySlug } from "@/lib/status";
import type {
  ClimateYear,
  LatLon,
  Pass,
  Period,
  ProfileWithCoords,
  Tour,
  Town,
} from "@/lib/types";
import {
  MOBILE_QUERY,
  useMediaQuery,
  useViewportHeight,
} from "@/lib/use-media-query";
import { cn, MAP_CONTROL, PANEL } from "@/lib/utils";

interface Props {
  passes: Pass[];
  tours: Tour[];
  towns: Town[];
  /** Where MapLibre loads the ascent and tour lines from, see `lib/map-assets.ts`. */
  assets: MapAssets;
  nearbyTours: NearbyTours;
  profiles: Record<string, ProfileWithCoords>;
  climate: Record<string, ClimateYear>;
  /** Today's half-month, computed on the server in Europe/Berlin. */
  defaultPeriod: Period;
}

/** Floating panel geometry on desktop (px); keep in sync with the Tailwind widths below. */
const GAP = 12;
const SIDEBAR_W = { lg: 384, xl: 416 };
/** The detail panel grows with the viewport; the map keeps the larger half. */
const DETAIL_W = { lg: 352, xl: 400 };
/**
 * Bottom sheet positions on phones. The list opens on a peek row that shows
 * only the search field (keep `--sheet-peek` in app/globals.css in step, the
 * MapLibre controls sit above it), then half and almost full; the detail sheet
 * leaves the map visible above it or takes nearly the whole screen.
 */
const LIST_SNAPS = [80, 0.5, 0.85] as const;
const DETAIL_SNAPS = [0.55, 0.92] as const;
const [LIST_PEEK, LIST_HALF, LIST_FULL] = LIST_SNAPS;

export const Explorer = ({
  passes,
  tours,
  towns,
  assets,
  nearbyTours,
  profiles,
  climate,
  defaultPeriod,
}: Props) => {
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    period: defaultPeriod,
  });
  const [selection, setSelection] = useState<Selection | null>(null);
  // What the detail sheet keeps showing while it slides away; without it the
  // sheet would empty out the moment the selection is cleared.
  const [lastSelection, setLastSelection] = useState<Selection | null>(null);
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
  const [listSnap, setListSnap] = useState<number>(LIST_PEEK);
  const [detailSnap, setDetailSnap] = useState<number>(DETAIL_SNAPS[0]);
  const [scalesOpen, setScalesOpen] = useState(false);
  // Where the elevation-profile cursor sits on the road, and a fly-to asked
  // for by a click on it. Both live here because the map draws them and the
  // detail panel produces them.
  const [profileCursor, setProfileCursor] = useState<LatLon | null>(null);
  const [profileZoom, setProfileZoom] = useState<LatLon | null>(null);
  const {
    isFavorite,
    toggle: toggleFavorite,
    count: favoriteCount,
  } = useFavorites();
  const [, setStoredPeriod] = useStoredPeriod();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isXl = useMediaQuery("(width >= 80rem)");
  const viewportHeight = useViewportHeight();
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
        setLastSelection(h.selection);
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
    favorite,
    status,
  }));
  // What the list shows for a kind is what the map shows for that kind; the
  // visibility switches only add a layer toggle on top.
  const mapTours = tourRows.map(({ tour: t, status }) => ({
    ...t,
    status,
    visible: !hiddenTours.includes(t.slug),
  }));
  const mapTowns = townRows.map(({ town, favorite }) => ({
    ...town,
    favorite,
  }));

  /** Selecting something also makes it visible and brings the detail up. */
  const select = (sel: Selection) => {
    setSelection(sel);
    setLastSelection(sel);
    setProfileCursor(null);
    if (sel.kind === "tour")
      setHiddenTours((h) => h.filter((s) => s !== sel.slug));
    if (sel.kind === "town") setShowTowns(true);
    if (isMobile) {
      // The detail sheet covers the list; the list waits on its peek row so
      // nothing of it shows above the detail.
      setListSnap(LIST_PEEK);
      setDetailSnap(DETAIL_SNAPS[0]);
    }
  };

  /** Back to the list; focus returns to the row the detail came from. */
  const back = () => {
    const sel = selection;
    setSelection(null);
    setProfileCursor(null);
    if (isMobile) setListSnap(LIST_HALF);
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

  const detailFor = (sel: Selection) => (
    <DetailPanel
      selection={sel}
      period={filters.period}
      passes={passes}
      tours={tours}
      towns={towns}
      nearbyTours={nearbyTours}
      profiles={profiles}
      climate={climate}
      isFavorite={isFavorite}
      onToggleFavorite={toggleFavorite}
      onProfileCursor={setProfileCursor}
      onProfileZoom={setProfileZoom}
      onSelect={select}
      onBack={back}
      onOpenScales={() => setScalesOpen(true)}
    />
  );

  const sidebar = (variant: "aside" | "sheet") => (
    <Sidebar
      variant={variant}
      peek={variant === "sheet" && listSnap === LIST_PEEK}
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
      onCollapse={() => setSidebarOpen(false)}
      onOpenScales={() => setScalesOpen(true)}
      onSearchFocus={
        // Typing needs room: from the peek row, where the search field is all
        // there is, the sheet goes as high as it can so that as much of the
        // result list as possible stays above the software keyboard. Higher up
        // the list is already visible – and the focus `back()` returns to the
        // search field must not move the sheet at all.
        variant === "sheet"
          ? () => setListSnap((s) => (s === LIST_PEEK ? LIST_FULL : s))
          : undefined
      }
    />
  );

  // Mobile: the map is padded by the sheet in front of it, so camera targets
  // land above the fold.
  const insetBottom = isMobile
    ? snapPx(selection ? detailSnap : listSnap, viewportHeight)
    : 0;

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
            assets={assets}
            showTowns={showTowns}
            selection={selection}
            onSelect={select}
            onViewChange={setView}
            profileCursor={profileCursor}
            profileZoom={profileZoom}
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
                      className={MAP_CONTROL}
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

        {!isMobile && selection && (
          <section
            key={`${selection.kind}:${selection.slug}`}
            aria-label="Details"
            style={{ left: detailLeft }}
            className={cn(
              "absolute top-3 bottom-3 z-20 flex w-88 flex-col overflow-hidden max-lg:hidden xl:w-100",
              "animate-in fade-in-0 slide-in-from-left-4 duration-200 motion-reduce:animate-none",
              PANEL,
            )}
          >
            {detailFor(selection)}
          </section>
        )}

        {/*
         * Mobile: one sheet per panel, the same split as the two floating
         * panels on desktop. The list sheet never leaves the screen, the detail
         * sheet slides in over it and is swiped away again.
         */}
        {isMobile && (
          <>
            <MobileSheet
              label="Liste"
              open
              snapPoints={LIST_SNAPS}
              snap={listSnap}
              onSnapChange={setListSnap}
            >
              <div ref={sidebarRoot} className="flex min-h-0 flex-1 flex-col">
                {sidebar("sheet")}
              </div>
            </MobileSheet>
            <MobileSheet
              label="Details"
              open={selection !== null}
              onClose={back}
              snapPoints={DETAIL_SNAPS}
              snap={detailSnap}
              onSnapChange={setDetailSnap}
            >
              {lastSelection && detailFor(lastSelection)}
            </MobileSheet>
          </>
        )}
      </div>

      <ScalesDialog open={scalesOpen} onOpenChange={setScalesOpen} />
    </TooltipProvider>
  );
};
