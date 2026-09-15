"use client";

import { PanelLeftOpen } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";

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
import type { DetailAssets } from "@/lib/detail-assets";
import type { MapAssets } from "@/lib/map-assets";
import type { NearbyTours, TownReach } from "@/lib/nearby";
import {
  buildPassRows,
  buildTourRows,
  buildTownRows,
  facetCount,
  statusHistogram,
} from "@/lib/rows";
import { indexBySlug } from "@/lib/status";
import type { Signals, Years } from "@/lib/status";
import type {
  ClimateYear,
  LatLon,
  Pass,
  Period,
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
  /** The area each town reaches, drawn on hover; see `lib/nearby.ts`. */
  townReach: TownReach;
  /**
   * Where the detail panel loads the selected entity's profiles and photos
   * from, one file per entity; see `lib/detail-assets.ts`.
   */
  detail: DetailAssets;
  climate: Record<string, ClimateYear>;
  /** Lowest ascent start per pass, for the derived valley heat (`lib/status.ts`). */
  valleys: Record<string, number>;
  /**
   * The 24 graded half-months of every pass and tour, computed once on the
   * server (`getYears`, lib/data.ts). Nothing here grades a pass itself.
   */
  years: Years;
  /** Today's half-month, computed on the server in Europe/Berlin. */
  defaultPeriod: Period;
}

/** Floating panel geometry on desktop (px); keep in sync with the Tailwind widths below. */
const GAP = 12;
const SIDEBAR_W = { lg: 384, xl: 416 };
/** The detail panel grows with the viewport; the map keeps the larger half. */
const DETAIL_W = { lg: 352, xl: 400 };
/**
 * Bottom sheet positions on phones. The list opens on a peek row that carries
 * the search button (keep `--sheet-peek` in app/globals.css in step, the
 * MapLibre controls sit above it), then half and almost full; the detail sheet
 * leaves the map visible above it or takes nearly the whole screen.
 */
const LIST_SNAPS = [80, 0.5, 0.85] as const;
const DETAIL_SNAPS = [0.55, 0.92] as const;
const [LIST_PEEK, LIST_HALF, LIST_FULL] = LIST_SNAPS;

/**
 * What is selected, and what the detail panel shows – four values that only
 * ever change together, so they change in one move.
 *
 * They are not the same thing: `at` is where the camera is *going*, and
 * everything that answers the tap at once follows it – the map's layers and
 * feature state, the highlighted row, the URL hash. `shown` is where the
 * camera *is*, and that is what the panel renders. A panel that opened with
 * the flight filled in as it went – the file arrived, then the photo, and a
 * block appearing under the one being read pushed it down. One arrival is
 * calmer than three, and it also keeps the most expensive thing the app draws
 * out of the animation's frames: measured on a phone-sized viewport, drawing
 * the panel into a flight cost that flight about a third of its frame rate.
 */
interface SelectionState {
  at: Selection | null;
  shown: Selection | null;
  /**
   * What the sheet keeps showing while it slides away; without it the sheet
   * would empty out the moment the selection is cleared.
   */
  last: Selection | null;
  flying: boolean;
}

type SelectionAction =
  | { kind: "select"; sel: Selection }
  /** A shared link: its selection is part of the first paint, nothing to wait for. */
  | { kind: "restore"; sel: Selection | null }
  | { kind: "arrive" }
  | { kind: "close" };

const NO_SELECTION: SelectionState = {
  at: null,
  flying: false,
  last: null,
  shown: null,
};

const selectionState = (
  s: SelectionState,
  a: SelectionAction,
): SelectionState => {
  switch (a.kind) {
    case "select": {
      // `shown` stays: whatever the panel has is what it keeps until the
      // camera lands – nothing at all, when no detail was open.
      return { at: a.sel, flying: true, last: a.sel, shown: s.shown };
    }
    case "restore": {
      return { at: a.sel, flying: false, last: a.sel ?? s.last, shown: a.sel };
    }
    case "arrive": {
      // The map reports this on every `idle` as well as on `moveend`, so a
      // state that is not waiting is returned unchanged rather than replaced –
      // an equal object would re-render the whole page a few times a second.
      return s.flying ? { ...s, flying: false, shown: s.at } : s;
    }
    default: {
      return { ...s, at: null, flying: false, shown: null };
    }
  }
};

export const Explorer = ({
  passes,
  tours,
  towns,
  assets,
  nearbyTours,
  townReach,
  detail,
  climate,
  valleys,
  years,
  defaultPeriod,
}: Props) => {
  const signals: Signals = { climate, valleys };
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    period: defaultPeriod,
  });
  const [current, dispatch] = useReducer(selectionState, NO_SELECTION);
  const selection = current.at;
  const [view, setView] = useState<MapView>(DEFAULT_VIEW);
  const [showPasses, setShowPasses] = useStored("alpenpaesse:showPasses", true);
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
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
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
      dispatch({ kind: "restore", sel: h.selection });
      if (h.selection) {
        if (h.selection.kind === "pass") setShowPasses(true);
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
  const passRows = buildPassRows(passes, years, filters, isFavorite, signals);
  const tourRows = buildTourRows(
    tours,
    passIndex,
    years,
    filters,
    isFavorite,
    signals,
  );
  const townRows = buildTownRows(towns, filters, isFavorite);
  /**
   * The number on every filter chip. The patch both applies the option and
   * lifts its own group's filter, which is what makes the count answer "what
   * happens if I press this" instead of "what is left of my current choice";
   * `facetCount` explains why that is the only honest arithmetic here.
   */
  const countWith = (patch: Partial<Filters>) =>
    facetCount(passes, years, filters, isFavorite, patch, signals);
  const histogram = statusHistogram(
    passes,
    years,
    filters,
    isFavorite,
    signals,
  );

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

  /**
   * Selecting something also makes it visible and brings the detail up – which
   * the camera's arrival does, one flight later (`selectionState` above).
   */
  const select = (sel: Selection) => {
    dispatch({ kind: "select", sel });
    setProfileCursor(null);
    if (sel.kind === "pass") setShowPasses(true);
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
    const closed = selection;
    dispatch({ kind: "close" });
    setProfileCursor(null);
    if (isMobile) setListSnap(LIST_HALF);
    requestAnimationFrame(() => {
      const root = sidebarRoot.current;
      const row =
        closed &&
        root?.querySelector<HTMLElement>(
          `[data-row="${closed.kind}:${closed.slug}"]`,
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
      detail={detail}
      climate={climate}
      valleys={valleys}
      years={years}
      isFavorite={isFavorite}
      onToggleFavorite={toggleFavorite}
      onProfileCursor={setProfileCursor}
      onProfileZoom={setProfileZoom}
      onSelect={select}
      onBack={back}
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
      countWith={countWith}
      tours={tours}
      hiddenTours={hiddenTours}
      setHiddenTours={setHiddenTours}
      showPasses={showPasses}
      setShowPasses={setShowPasses}
      showTowns={showTowns}
      setShowTowns={setShowTowns}
      sections={sections}
      setSections={setSections}
      onToggleFavorite={toggleFavorite}
      onSelect={select}
      selection={selection}
      onCollapse={() => setSidebarOpen(false)}
      onOpenScales={() => setScalesOpen(true)}
      onOpenSearch={
        // The peek row's search button opens the sheet as far as it goes and
        // stops there: the field it reveals is the real one, and by the time a
        // thumb reaches it the sheet stands still, so the software keyboard has
        // nothing to fight with.
        variant === "sheet" ? () => setListSnap(LIST_FULL) : undefined
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
            townReach={townReach}
            assets={assets}
            showPasses={showPasses}
            showTowns={showTowns}
            selection={selection}
            onSelect={select}
            onViewChange={setView}
            onCameraSettled={() => dispatch({ kind: "arrive" })}
            profileCursor={profileCursor}
            profileZoom={profileZoom}
            requestedView={requestedView}
            insetLeft={insetLeft}
            insetBottom={insetBottom}
            scrubber={
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
            }
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

        {!isMobile && current.shown && (
          <section
            key={`${current.shown.kind}:${current.shown.slug}`}
            aria-label="Details"
            style={{ left: detailLeft }}
            className={cn(
              "absolute top-3 bottom-3 z-20 flex w-88 flex-col overflow-hidden max-lg:hidden xl:w-100",
              "animate-in fade-in-0 slide-in-from-left-4 duration-200 motion-reduce:animate-none",
              PANEL,
            )}
          >
            {detailFor(current.shown)}
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
              open={current.shown !== null}
              onClose={back}
              snapPoints={DETAIL_SNAPS}
              snap={detailSnap}
              onSnapChange={setDetailSnap}
            >
              {/* `last` is what the sheet keeps showing while it slides away,
                  once there is nothing to show any more. */}
              {(current.shown ?? current.last) &&
                detailFor((current.shown ?? current.last)!)}
            </MobileSheet>
          </>
        )}
      </div>

      <ScalesDialog open={scalesOpen} onOpenChange={setScalesOpen} />
    </TooltipProvider>
  );
};
