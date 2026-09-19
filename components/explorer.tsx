"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { PassMap } from "@/components/map/pass-map";
import type { MapPass } from "@/components/map/pass-map";
import { MobileSheet, sheetCover } from "@/components/mobile-sheet";
import { DetailPanel } from "@/components/panel/detail-panel";
import { ScalesDialog } from "@/components/scales-dialog";
import { SeasonBand, SeasonBandLegend } from "@/components/season-band";
import { filterCount } from "@/components/sidebar/filter-panel";
import { KIND_LABEL } from "@/components/sidebar/kind-tabs";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
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
  seasonBand,
} from "@/lib/rows";
import { indexBySlug, periodIndex } from "@/lib/status";
import type { Signals, Years } from "@/lib/status";
import type {
  ClimateYear,
  LatLon,
  Pass,
  Period,
  Tour,
  Town,
} from "@/lib/types";
import { useHeight } from "@/lib/use-height";
import {
  MOBILE_QUERY,
  useMediaQuery,
  useViewportHeight,
} from "@/lib/use-media-query";
import { cn, fmt, PANEL, SHELL_BAR } from "@/lib/utils";

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
 * The two bottom sheets on phones, and where each rests.
 *
 * Two drawers again, but not the two it started with. The first version kept
 * the list drawer on screen *always*, resting on a peek row – so a detail
 * always had a second, useless drawer behind it, and the map was never free of
 * furniture. Collapsing both into one sheet fixed the overlap and lost the
 * separation. This keeps both: neither drawer exists until it is asked for.
 *
 * No drawer covers the map at rest. The season bar's "Liste" button opens the
 * list; the list is dismissed by a swipe and is gone again. A selection opens
 * the detail drawer over whatever is there – over the list when the tap came
 * from a row, over the bare map when it came from the map itself – and
 * dismissing it uncovers exactly what was underneath. That is the model the
 * two drawers were always trying to express, and it only works because the
 * one behind is there by choice.
 *
 * A detail opens at least as high as the list it covers, so the list's swipe
 * handle never peeks out above it and leaves two of them on screen.
 */
const LIST_SNAPS = [0.5, 0.92] as const;
const DETAIL_SNAPS = [0.55, 0.92] as const;
const [LIST_HALF, LIST_FULL] = LIST_SNAPS;
const [DETAIL_HALF, DETAIL_FULL] = DETAIL_SNAPS;

/**
 * What is selected, and what the detail panel keeps showing while it leaves –
 * two values that only ever change together, so they change in one move.
 *
 * The panel opens with the tap, not with the camera's arrival. Selecting
 * something is an answer about that thing, and the map's flight is the slower,
 * secondary half of it: the panel, the map's layers and feature state, the
 * highlighted row and the URL hash all follow `at` in the same frame, and the
 * camera sets off once the panel is on screen (`SELECT_DELAY` in
 * `pass-map.tsx`). That order is what keeps the two out of each other's
 * frames – drawing the panel *into* a flight cost that flight about a third of
 * its frame rate on a phone-sized viewport – and it is the honest one: the
 * expensive thing is what was asked for, the flight is not.
 */
interface SelectionState {
  at: Selection | null;
  /**
   * What the sheet keeps showing while it slides away; without it the sheet
   * would empty out the moment the selection is cleared.
   */
  last: Selection | null;
}

const NO_SELECTION: SelectionState = { at: null, last: null };

/** The action *is* the next selection; `null` closes. */
const selectionState = (
  s: SelectionState,
  sel: Selection | null,
): SelectionState => ({ at: sel, last: sel ?? s.last });

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
  // Which of the three lists is on screen. A preference like the sidebar's
  // own fold, so coming back lands where the last visit left off.
  const [tab, setTab] = useStored<EntityKind>("alpenpaesse:tab", "pass");
  const [sidebarOpen, setSidebarOpen] = useStored("alpenpaesse:sidebar", true);
  // The list drawer exists only while it is wanted; the detail drawer only
  // while something is selected. At rest the map carries nothing but the
  // floating controls.
  const [listOpen, setListOpen] = useState(false);
  // Whether the filter panel inside the list is unfolded. It lives here rather
  // than in the sidebar because the phone's "Filter" button opens the list and
  // the panel in one press.
  const [filtersOpen, setFiltersOpen] = useState<boolean | null>(null);
  const [listSnap, setListSnap] = useState<number>(LIST_HALF);
  /**
   * Whether the detail drawer belongs *inside* the list drawer – which is how
   * Base UI is told to stack the two, the list scaling back and peeking above
   * the detail in front of it.
   *
   * It is decided when the selection is made and then left alone: what is
   * underneath a detail is where it was opened from, and that does not change
   * while it is open. Moving a mounted drawer from one tree to the other would
   * remount it anyway.
   */
  const [detailNested, setDetailNested] = useState(false);
  const [detailSnap, setDetailSnap] = useState<number>(DETAIL_HALF);
  const [scalesOpen, setScalesOpen] = useState(false);
  // Where the elevation-profile cursor sits on the road, and a fly-to asked
  // for by a click on it. Both live here because the map draws them and the
  // detail panel produces them.
  const [profileCursor, setProfileCursor] = useState<LatLon | null>(null);
  const [profileZoom, setProfileZoom] = useState<LatLon | null>(null);
  /**
   * What the pointer is over – wherever the pointer happens to be. The list
   * and the map are two halves of one screen showing the same 258 entities,
   * and until now neither knew what the other was pointing at: a row did
   * nothing to the map and a mark did nothing to the list. One piece of state
   * shared by both is the whole fix; it deliberately lives *next to* the
   * selection rather than inside it, because hovering must never move the
   * camera, write the hash or open a panel.
   *
   * It is not persisted and not in the hash: it describes a pointer, and a
   * pointer is not part of a shared link.
   */
  const [hovered, setHovered] = useState<Selection | null>(null);
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const [, setStoredPeriod] = useStoredPeriod();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isXl = useMediaQuery("(width >= 80rem)");
  const viewportHeight = useViewportHeight();
  const [headerRef, headerHeight] = useHeight();
  const [barRef, barHeight] = useHeight();
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
      dispatch(h.selection);
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
  /**
   * The 24 bars the season bar draws, and the headline's counts: the same
   * arithmetic over the same passes, so the sentence at the top and the ribbon
   * at the bottom can never disagree.
   */
  const band = seasonBand(passes, years, filters, isFavorite, signals);
  const currentBar = band.bars[periodIndex(filters.period)]!;

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
   * Selecting something makes it visible, brings its detail up in the same
   * frame and hands the map a target the camera sets off for once the panel
   * has drawn (`selectionState` above).
   */
  const select = (sel: Selection) => {
    dispatch(sel);
    setProfileCursor(null);
    setHovered(null);
    // The lists are one at a time now, so selecting from the map has to bring
    // the right one forward – otherwise the highlighted row is behind a tab.
    setTab(sel.kind);
    if (sel.kind === "pass") setShowPasses(true);
    if (sel.kind === "tour")
      setHiddenTours((h) => h.filter((s) => s !== sel.slug));
    if (sel.kind === "town") setShowTowns(true);
    // The detail drawer comes up over whatever is there. It has to cover the
    // list drawer rather than sit inside it, or both swipe handles show at
    // once and the screen grows a stack of edges that mean nothing.
    if (isMobile) {
      setDetailSnap(
        listOpen && listSnap >= LIST_FULL ? DETAIL_FULL : DETAIL_HALF,
      );
      setDetailNested(listOpen);
    }
  };

  /** Back to the list; focus returns to the row the detail came from. */
  const back = () => {
    const closed = selection;
    dispatch(null);
    setProfileCursor(null);
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
      hovered={hovered}
      onHover={setHovered}
      onProfileCursor={setProfileCursor}
      onProfileZoom={setProfileZoom}
      onSelect={select}
      onBack={back}
      backToList={isMobile && listOpen}
    />
  );

  /**
   * The detail drawer, in one of two places in the tree.
   *
   * Base UI takes a drawer rendered inside another drawer as a drawer *on* it:
   * the one behind scales back, dims and peeks above the one in front, and a
   * swipe down on the front one uncovers it. That is exactly what opening a
   * detail from a row means – and what a detail opened from the map must not
   * claim, because there is nothing behind it to go back to. So which parent
   * it is rendered under is the whole difference, and `detailNested` is the
   * answer decided at the tap.
   */
  const detailSheet = (
    <MobileSheet
      label="Details"
      open={selection !== null}
      onClose={back}
      snapPoints={DETAIL_SNAPS}
      snap={detailSnap}
      onSnapChange={setDetailSnap}
    >
      {/* `last` is what the drawer keeps showing while it slides away, once
          there is nothing to show any more. */}
      {(selection ?? current.last) && detailFor((selection ?? current.last)!)}
    </MobileSheet>
  );

  const sidebar = (variant: "aside" | "sheet") => (
    <Sidebar
      variant={variant}
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
      tab={tab}
      setTab={setTab}
      onToggleFavorite={toggleFavorite}
      onSelect={select}
      selection={selection}
      hovered={hovered}
      onHover={setHovered}
      onOpenScales={() => setScalesOpen(true)}
      filtersOpen={filtersOpen}
      setFiltersOpen={setFiltersOpen}
    />
  );

  // What the shell covers of the map, measured rather than promised: both bars
  // are translucent, so the map runs on underneath them and a camera target
  // behind one is simply unreadable.
  //
  // On a phone whichever drawer is in front covers more than the season bar
  // does, and that is what counts then. The detail sheet's share is claimed in
  // the same commit as the selection, one flight ahead of the camera – which is
  // precisely what keeps the picture still: a padding the map has not applied
  // yet cannot move it, and the flight that follows carries it
  // (`pass-map.tsx`, "Reserve space").
  const sheetPx = isMobile
    ? sheetCover(
        selection ? detailSnap : listOpen ? listSnap : 0,
        viewportHeight,
      )
    : 0;
  const insetBottom = Math.max(sheetPx, barHeight);
  const insetTop = headerHeight;

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

  const setPeriod = (p: Period) => {
    setFilters((f) => ({ ...f, period: p }));
    // Only the control writes the preference; applying a hash never does.
    setStoredPeriod(p);
  };

  const listCount = { pass: passRows, tour: tourRows, town: townRows }[tab]
    .length;
  const activeFilters = filterCount(filters);

  /*
   * The shell: a header along the top and the season bar along the bottom,
   * both of them translucent and both of them *over* the map, which fills the
   * viewport behind everything. Between them the floating panels, in a
   * position context of their own, so they start below the header and end
   * above the bar without either being told a number.
   */
  return (
    <TooltipProvider delay={400}>
      <div
        className="relative flex h-dvh flex-col overflow-hidden"
        style={{ "--shell-bottom": `${barHeight}px` } as React.CSSProperties}
      >
        <div id="map" tabIndex={-1} className="absolute inset-0">
          <PassMap
            passes={mapPasses}
            tours={mapTours}
            towns={mapTowns}
            townReach={townReach}
            assets={assets}
            showPasses={showPasses}
            showTowns={showTowns}
            selection={selection}
            hovered={hovered}
            onHover={setHovered}
            onSelect={select}
            onViewChange={setView}
            profileCursor={profileCursor}
            profileZoom={profileZoom}
            requestedView={requestedView}
            insetLeft={insetLeft}
            insetBottom={insetBottom}
            insetTop={insetTop}
          />
        </div>

        <div ref={headerRef} className="relative z-20 shrink-0">
          <AppHeader
            bar={currentBar}
            sidebarOpen={isMobile ? undefined : sidebarOpen}
            onToggleSidebar={
              isMobile ? undefined : () => setSidebarOpen(!sidebarOpen)
            }
            onOpenScales={() => setScalesOpen(true)}
          />
        </div>

        {/* The map's own middle: nothing is drawn here, it only gives the two
            floating panels a box that already excludes the two bars. */}
        <div className="pointer-events-none relative min-h-0 flex-1">
          {!isMobile && sidebarOpen && (
            <aside
              ref={sidebarRoot}
              className={cn(
                "pointer-events-auto absolute top-3 bottom-3 left-3 z-20 flex w-96 flex-col overflow-hidden max-lg:hidden xl:w-104",
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
                "pointer-events-auto absolute top-3 bottom-3 z-20 flex w-88 flex-col overflow-hidden max-lg:hidden xl:w-100",
                "animate-in fade-in-0 slide-in-from-left-4 duration-200 motion-reduce:animate-none",
                PANEL,
              )}
            >
              {detailFor(selection)}
            </section>
          )}
        </div>

        {/*
         * The season bar. The band is the app's one domain control, so it gets
         * the width of the screen rather than a corner of the map: the shape of
         * the year is the thing a visitor is here to read. Beside it, where
         * there is room, what its three shapes mean; on a phone, where there is
         * not, the two ways on – into the list and into the filters.
         */}
        <div
          ref={barRef}
          className={cn(
            "relative z-20 flex shrink-0 flex-col gap-2 border-t px-3 py-2 lg:flex-row lg:items-start lg:gap-6 lg:px-4",
            SHELL_BAR,
          )}
        >
          <SeasonBand
            band={band}
            value={filters.period}
            today={defaultPeriod}
            onChange={setPeriod}
            className="flex-1"
          />
          <SeasonBandLegend className="w-56 shrink-0 max-lg:hidden" />
          <div className="flex gap-2 lg:hidden">
            <Button
              className="flex-1"
              onClick={() => {
                setFiltersOpen(false);
                setListOpen(true);
              }}
            >
              {KIND_LABEL[tab]} ({fmt(listCount)})
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setFiltersOpen(true);
                setListOpen(true);
              }}
            >
              Filter
              {activeFilters > 0 && (
                <Badge variant="secondary">{activeFilters}</Badge>
              )}
            </Button>
          </div>
        </div>

        {/*
         * Two drawers, neither of them on screen until it is wanted. The list
         * is opened from the season bar and dismissed by a swipe; the
         * detail comes up over whatever is underneath – the bare map when a
         * road was tapped, the list when a row was – and uncovers it again.
         *
         * They used to be one sheet holding either content, which is what made
         * "back to the list" a thing the app had to reconstruct: a detail
         * reached from the map had no list behind it, and one reached from a
         * row had to keep it mounted under a `hidden` so its scroll position
         * and its tab survived. As two drawers the stack is simply the truth,
         * and the list keeps its state by never having been unmounted.
         */}
        {isMobile && (
          <>
            <MobileSheet
              label="Liste"
              open={listOpen}
              onClose={() => setListOpen(false)}
              snapPoints={LIST_SNAPS}
              snap={listSnap}
              onSnapChange={setListSnap}
            >
              <div ref={sidebarRoot} className="flex min-h-0 flex-1 flex-col">
                {sidebar("sheet")}
              </div>
              {/* Opened from a row, the detail is a drawer *of* this one. */}
              {detailNested && detailSheet}
            </MobileSheet>
            {/* Opened from the map, it stands on its own over the bare map. */}
            {!detailNested && detailSheet}
          </>
        )}
      </div>

      <ScalesDialog open={scalesOpen} onOpenChange={setScalesOpen} />
    </TooltipProvider>
  );
};
