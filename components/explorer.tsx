"use client";

import { useReducer, useRef, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { PassMap } from "@/components/map/pass-map";
import { DetailPanel } from "@/components/panel/detail-panel";
import { ScalesDialog } from "@/components/scales-dialog";
import { SeasonBand } from "@/components/season-band";
import { Shell } from "@/components/shell";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ALL_RANGES, initialState, KIND_LABEL, reduce } from "@/lib/app-state";
import type {
  Action,
  AppState,
  Env,
  Filters,
  Selection,
} from "@/lib/app-state";
import { destinationsOfTown } from "@/lib/destination";
import { filterCount, rangeWord } from "@/lib/filter-summary";
import { useHashAdapter } from "@/lib/hash-adapter";
import type { PageData } from "@/lib/page-data";
import { entityKey } from "@/lib/route-key";
import {
  buildDestinationRows,
  buildPassRows,
  buildTourRows,
  buildTownRows,
  currentBar,
  facetCount,
  seasonBand,
} from "@/lib/rows";
import { indexBySlug } from "@/lib/status";
import type { Signals } from "@/lib/status";
import type { Period } from "@/lib/types";
import { useMapEnvironment } from "@/lib/use-media-query";
import { useFavorites, useStorageAdapter, useStored } from "@/lib/use-stored";
import { fmt } from "@/lib/utils";

interface Props {
  /** Everything the page loaded, as one value (`getPageData`, lib/data.ts). */
  data: PageData;
  /** Today's half-month, computed on the server in Europe/Berlin. */
  defaultPeriod: Period;
}

/**
 * The composition: everything the explorer decides is `reduce` in
 * `lib/app-state.ts`, fed by the hash and the storage adapters; where the
 * parts stand and what they cover of the map is `Shell`
 * (components/shell.tsx). What is left here is the rows, the sentences they
 * are counted into, and the wiring of `dispatch` into each part.
 */
export const Explorer = ({ data, defaultPeriod }: Props) => {
  const {
    assets,
    climate,
    destinationMembers,
    destinations,
    passes,
    tours,
    townRanges,
    townReach,
    towns,
    valleys,
    years,
  } = data;
  const signals: Signals = { climate, valleys };
  // Everything the map draws differently for, in one value; the shell reads
  // the same `mobile` the map does, so the two can never disagree about which
  // layout is on screen.
  const mapEnv = useMapEnvironment();
  const isMobile = mapEnv.mobile;
  const env: Env = {
    mobile: isMobile,
    rangeBounds: assets.rangeBounds,
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
    compare,
    filters,
    hovered,
    last,
    profileCursor,
    profileZoom,
    requestedFit,
    requestedView,
    selection,
    sheet,
    shown,
    tab,
  } = state;

  const [sidebarOpen, setSidebarOpen] = useStored("sidebar");
  const [scalesOpen, setScalesOpen] = useState(false);
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const sidebarRoot = useRef<HTMLDivElement>(null);

  const passIndex = indexBySlug(passes);
  const townIndex = indexBySlug(towns);
  /** The area each town lies in, by name – the one naming it as a base first. */
  const townAreas = Object.fromEntries(
    towns.map((t) => [
      t.slug,
      destinationsOfTown(t.slug, destinations, destinationMembers)[0]?.name,
    ]),
  );
  const rows = {
    destination: buildDestinationRows(
      destinations,
      destinationMembers,
      passIndex,
      townIndex,
      years,
      filters,
      isFavorite,
    ),
    pass: buildPassRows(passes, years, filters, isFavorite, signals),
    tour: buildTourRows(tours, passIndex, years, filters, isFavorite, signals),
    town: buildTownRows(towns, townRanges, filters, isFavorite, townAreas),
  };
  /** What selecting an area frames: the box around its members (`membersOf`). */
  const destinationBounds = Object.fromEntries(
    Object.entries(destinationMembers).map(([slug, m]) => [slug, m.bounds]),
  );
  /** The ranges the data holds a road for – the chips the "Gebirge" group shows. */
  const ranges = ALL_RANGES.filter((r) => assets.rangeBounds[r] !== undefined);
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
  const activeFilters = filterCount(filters);

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

  return (
    <TooltipProvider delay={400}>
      <Shell
        mobile={isMobile}
        sidebarOpen={sidebarOpen}
        selection={selection}
        last={last}
        sheet={sheet}
        dispatch={dispatch}
        onBack={back}
        listRef={sidebarRoot}
        map={(inset) => (
          /* What the list shows for a kind is what the map shows for that
             kind; the visibility switches only add a layer toggle on top,
             and `buildScene` (lib/map-scene.ts) reads both. */
          <PassMap
            rows={rows}
            shown={shown}
            townReach={townReach}
            assets={assets}
            destinationBounds={destinationBounds}
            selection={selection}
            hovered={hovered}
            onHover={hover}
            onSelect={select}
            onViewChange={(view) => dispatch({ type: "view", view })}
            intent={intent}
            profileCursor={profileCursor}
            profileZoom={profileZoom}
            requestedFit={requestedFit}
            requestedView={requestedView}
            inset={inset}
            env={mapEnv}
          />
        )}
        header={
          <AppHeader
            bar={bar}
            where={rangeWord(filters)}
            sidebarOpen={isMobile ? undefined : sidebarOpen}
            onToggleSidebar={
              isMobile ? undefined : () => setSidebarOpen(!sidebarOpen)
            }
            onOpenScales={() => setScalesOpen(true)}
          />
        }
        band={
          <>
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
          </>
        }
        sidebar={(variant) => (
          <Sidebar
            variant={variant}
            filters={filters}
            rows={rows}
            compare={compare}
            totals={{
              destination: destinations.length,
              pass: passes.length,
              tour: tours.length,
              town: towns.length,
            }}
            countWith={countWith}
            ranges={ranges}
            onRange={(range) => dispatch({ range, type: "range" })}
            shown={shown}
            tab={tab}
            selection={selection}
            hovered={hovered}
            dispatch={dispatch}
            onToggleFavorite={toggleFavorite}
            onOpenScales={() => setScalesOpen(true)}
            filtersOpen={sheet.filters}
          />
        )}
        detail={(sel) => (
          <DetailPanel
            selection={sel}
            data={{ ...data, passIndex, townIndex }}
            period={filters.period}
            hovered={hovered}
            favorite={isFavorite(sel.kind, sel.slug)}
            actions={{
              onBack: back,
              onHover: hover,
              onProfileCursor: (at) => dispatch({ at, type: "profileCursor" }),
              onProfileZoom: (at) => dispatch({ at, type: "profileZoom" }),
              onSelect: select,
              onToggleFavorite: () => toggleFavorite(sel.kind, sel.slug),
            }}
          />
        )}
      />

      <ScalesDialog
        open={scalesOpen}
        onOpenChange={setScalesOpen}
        ranges={ranges}
      />
    </TooltipProvider>
  );
};
