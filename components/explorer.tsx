"use client";

import { useReducer, useRef, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { PassMap } from "@/components/map/pass-map";
import { MobileSheet, sheetCover } from "@/components/mobile-sheet";
import { DetailPanel } from "@/components/panel/detail-panel";
import { ScalesDialog } from "@/components/scales-dialog";
import { SeasonBand } from "@/components/season-band";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DETAIL_SNAPS,
  initialState,
  KIND_LABEL,
  LIST_SNAPS,
  reduce,
} from "@/lib/app-state";
import type {
  Action,
  AppState,
  Env,
  Filters,
  Selection,
} from "@/lib/app-state";
import { filterCount } from "@/lib/filter-summary";
import { useHashAdapter } from "@/lib/hash-adapter";
import { shellEdge } from "@/lib/map-camera";
import type { PageData } from "@/lib/page-data";
import { entityKey } from "@/lib/route-key";
import {
  buildPassRows,
  buildTourRows,
  buildTownRows,
  currentBar,
  facetCount,
  seasonBand,
} from "@/lib/rows";
import { indexBySlug } from "@/lib/status";
import type { Signals } from "@/lib/status";
import type { LatLon, Period } from "@/lib/types";
import { useHeight } from "@/lib/use-height";
import {
  MOBILE_QUERY,
  useMediaQuery,
  useViewportHeight,
} from "@/lib/use-media-query";
import { useFavorites, useStorageAdapter, useStored } from "@/lib/use-stored";
import { cn, fmt, PANEL, SHELL_BAR } from "@/lib/utils";

interface Props {
  /** Everything the page loaded, as one value (`getPageData`, lib/data.ts). */
  data: PageData;
  /** Today's half-month, computed on the server in Europe/Berlin. */
  defaultPeriod: Period;
}

/** Floating panel geometry on desktop (px); keep in sync with the Tailwind widths below. */
const GAP = 12;
const SIDEBAR_W = { lg: 384, xl: 416 };
/** The detail panel grows with the viewport; the map keeps the larger half. */
const DETAIL_W = { lg: 352, xl: 400 };

/**
 * The composition: everything the explorer decides is `reduce` in
 * `lib/app-state.ts`, fed by the hash and the storage adapters; what is left
 * here is the layout, the rows and the wiring of `dispatch` into the panels.
 */
export const Explorer = ({ data, defaultPeriod }: Props) => {
  const { assets, climate, passes, tours, townReach, towns, valleys, years } =
    data;
  const signals: Signals = { climate, valleys };
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const env: Env = {
    mobile: isMobile,
    today: defaultPeriod,
    tours: tours.map((t) => t.slug),
  };
  const [state, dispatch] = useReducer(
    (s: AppState, a: Action) => reduce(s, a, env),
    defaultPeriod,
    initialState,
  );
  const intent = useHashAdapter(state, dispatch);
  useStorageAdapter(state);
  const {
    filters,
    hovered,
    last,
    profileCursor,
    requestedView,
    selection,
    sheet,
    shown,
    tab,
  } = state;

  const [sidebarOpen, setSidebarOpen] = useStored("alpenpaesse:sidebar");
  const [scalesOpen, setScalesOpen] = useState(false);
  // A fly-to asked for by a click on the elevation profile: the panel produces
  // it, the map consumes it, and it is not state anybody else reads.
  const [profileZoom, setProfileZoom] = useState<LatLon | null>(null);
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const isXl = useMediaQuery("(width >= 80rem)");
  const viewportHeight = useViewportHeight();
  const [headerRef, headerHeight] = useHeight();
  const [barRef, barHeight] = useHeight();
  const sidebarRoot = useRef<HTMLDivElement>(null);

  const passIndex = indexBySlug(passes);
  const rows = {
    pass: buildPassRows(passes, years, filters, isFavorite, signals),
    tour: buildTourRows(tours, passIndex, years, filters, isFavorite, signals),
    town: buildTownRows(towns, filters, isFavorite),
  };
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
  const bar = currentBar(band, filters.period);

  const select = (sel: Selection) =>
    dispatch({ selection: sel, type: "select" });
  const hover = (sel: Selection | null) =>
    dispatch({ selection: sel, type: "hover" });

  /** Back to the list; focus returns to the row the detail came from. */
  const back = () => {
    const closed = selection;
    dispatch({ type: "back" });
    requestAnimationFrame(() => {
      const root = sidebarRoot.current;
      const row =
        closed &&
        root?.querySelector<HTMLElement>(`[data-row="${entityKey(closed)}"]`);
      (row ?? root?.querySelector<HTMLElement>("input[type=search]"))?.focus({
        preventScroll: !row,
      });
    });
  };

  const detailFor = (sel: Selection) => (
    <DetailPanel
      selection={sel}
      data={{ ...data, passIndex }}
      period={filters.period}
      hovered={hovered}
      favorite={isFavorite(sel.kind, sel.slug)}
      actions={{
        onBack: back,
        onHover: hover,
        onProfileCursor: (at) => dispatch({ at, type: "profileCursor" }),
        onProfileZoom: setProfileZoom,
        onSelect: select,
        onToggleFavorite: () => toggleFavorite(sel.kind, sel.slug),
      }}
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
   * it is rendered under is the whole difference, and `sheet.detail.nested`
   * is the answer decided at the tap.
   */
  const detailSheet = (
    <MobileSheet
      label="Details"
      open={selection !== null}
      onClose={back}
      snapPoints={DETAIL_SNAPS}
      over={sheet.detail.nested}
      snap={sheet.detail.snap}
      onSnapChange={(snap) => dispatch({ sheet: "detail", snap, type: "snap" })}
    >
      {/* `last` is what the drawer keeps showing while it slides away, once
          there is nothing to show any more. */}
      {(selection ?? last) && detailFor((selection ?? last)!)}
    </MobileSheet>
  );

  const sidebar = (variant: "aside" | "sheet") => (
    <Sidebar
      variant={variant}
      filters={filters}
      rows={rows}
      totals={{ pass: passes.length, tour: tours.length, town: towns.length }}
      countWith={countWith}
      shown={shown}
      tab={tab}
      selection={selection}
      hovered={hovered}
      dispatch={dispatch}
      onToggleFavorite={toggleFavorite}
      onOpenScales={() => setScalesOpen(true)}
      filtersOpen={sheet.filters}
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
        selection ? sheet.detail.snap : sheet.list.open ? sheet.list.snap : 0,
        viewportHeight,
      )
    : 0;
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
  // On desktop the season card covers its height plus the gap it keeps from
  // the edge; the corner controls sit at the edge, in the corner it leaves.
  // The card stands right beside the panels, at their gap from the edge.
  const shell = shellEdge(isMobile, barHeight, insetLeft, GAP);
  const insetBottom = Math.max(sheetPx, shell.cover);

  const activeFilters = filterCount(filters);

  /*
   * The shell: a header along the top and, on a phone, the season bar along
   * the bottom, both of them translucent and both of them *over* the map,
   * which fills the viewport behind everything. Between them the floating
   * panels, in a position context of their own, so they start below the
   * header and end above the bar without either being told a number. On
   * desktop the bar is a card in that same box, beside the panels, and the
   * panels run the full height.
   *
   * `--shell-bottom` lifts MapLibre's corner controls (scale bar and
   * attribution) above the bar on a phone; on desktop they sit in the
   * bottom-right corner, which the card leaves free, and `--shell-left` is
   * where the card starts.
   */
  return (
    <TooltipProvider delay={400}>
      <div
        className="relative flex h-dvh flex-col overflow-hidden"
        style={
          {
            "--shell-bottom": `${shell.controls}px`,
            "--shell-left": `${shell.left}px`,
          } as React.CSSProperties
        }
      >
        <div id="map" tabIndex={-1} className="absolute inset-0">
          {/* What the list shows for a kind is what the map shows for that
              kind; the visibility switches only add a layer toggle on top,
              and `buildScene` (lib/map-scene.ts) reads both. */}
          <PassMap
            rows={rows}
            shown={shown}
            townReach={townReach}
            assets={assets}
            selection={selection}
            hovered={hovered}
            onHover={hover}
            onSelect={select}
            onViewChange={(view) => dispatch({ type: "view", view })}
            intent={intent}
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
            bar={bar}
            sidebarOpen={isMobile ? undefined : sidebarOpen}
            onToggleSidebar={
              isMobile ? undefined : () => setSidebarOpen(!sidebarOpen)
            }
            onOpenScales={() => setScalesOpen(true)}
          />
        </div>

        {/* The map's own middle: a box below the header that the floating
            panels fill on desktop and that the season bar ends on a phone. */}
        <div className="pointer-events-none relative flex min-h-0 flex-1 flex-col justify-end">
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
              key={entityKey(selection)}
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

          {/*
           * The season bar. The band is the app's one domain control. On a
           * phone it runs along the bottom of the screen, with the two ways
           * on – into the list and into the filters – under it. On desktop
           * it is a card of the same material as the panels, standing beside
           * them at the foot of the map and capped in width: 24 columns read
           * better at the width of a chart than stretched across a screen,
           * and the list keeps the full height. It stops short of the
           * bottom-right corner (`lg:right-40`), where the scale bar and the
           * attribution sit in a row. What its three shapes mean is one
           * popover away, and in the scales dialog.
           */}
          <div
            ref={barRef}
            className={cn(
              "pointer-events-auto z-20 flex shrink-0 flex-col gap-2 px-3 py-2",
              "max-lg:relative max-lg:border-t",
              "lg:absolute lg:right-40 lg:bottom-3 lg:left-(--shell-left) lg:max-w-xl lg:rounded-xl lg:border lg:px-4 lg:py-3 lg:shadow-xl",
              SHELL_BAR,
            )}
          >
            <SeasonBand
              band={band}
              bar={bar}
              today={defaultPeriod}
              onChange={(period) => dispatch({ period, type: "period" })}
              legend={!isMobile}
            />
            <div className="flex gap-2 lg:hidden">
              <Button
                className="flex-1"
                onClick={() =>
                  dispatch({ filters: false, open: true, type: "list" })
                }
              >
                {KIND_LABEL[tab]} ({fmt(rows[tab].length)})
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  dispatch({ filters: true, open: true, type: "list" })
                }
              >
                Filter
                {activeFilters > 0 && (
                  <Badge variant="secondary">{activeFilters}</Badge>
                )}
              </Button>
            </div>
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
              open={sheet.list.open}
              onClose={() => dispatch({ open: false, type: "list" })}
              snapPoints={LIST_SNAPS}
              snap={sheet.list.snap}
              onSnapChange={(snap) =>
                dispatch({ sheet: "list", snap, type: "snap" })
              }
            >
              <div ref={sidebarRoot} className="flex min-h-0 flex-1 flex-col">
                {sidebar("sheet")}
              </div>
              {/* Opened from a row, the detail is a drawer *of* this one. */}
              {sheet.detail.nested && detailSheet}
            </MobileSheet>
            {/* Opened from the map, it stands on its own over the bare map. */}
            {!sheet.detail.nested && detailSheet}
          </>
        )}
      </div>

      <ScalesDialog open={scalesOpen} onOpenChange={setScalesOpen} />
    </TooltipProvider>
  );
};
