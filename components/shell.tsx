"use client";

import type { ReactNode, RefObject } from "react";

import { useT } from "@/components/i18n";
import { MobileSheet, useSheetInset } from "@/components/mobile-sheet";
import { DETAIL_SNAPS, LIST_SNAPS } from "@/lib/app-state";
import type { Action, Selection, SheetState } from "@/lib/app-state";
import type { Inset } from "@/lib/map-camera";
import { entityKey } from "@/lib/route-key";
import { shellGeometry } from "@/lib/shell-geometry";
import { useHeight } from "@/lib/use-height";
import { useMediaQuery, useViewportHeight } from "@/lib/use-media-query";
import { cn, PANEL, SHELL_BAR } from "@/lib/utils";

interface Props {
  /**
   * Which layout is on screen. It comes from the map's own environment, so the
   * shell and the map can never disagree about it.
   */
  mobile: boolean;
  /** Whether the desktop sidebar is unfolded. */
  sidebarOpen: boolean;
  /** What is selected: the second floating panel, and the detail drawer. */
  selection: Selection | null;
  /** What the drawer keeps showing while it slides away. */
  last: Selection | null;
  /** Where the two drawers stand and how far up each one is. */
  sheet: SheetState;
  dispatch: (action: Action) => void;
  /** Back to the list: the drawer's dismissal and the panel's close. */
  onBack: () => void;
  /** The list, so the detail can hand focus back to the row it came from. */
  listRef: RefObject<HTMLDivElement | null>;
  /** The map, told what the shell covers of it. */
  map: (inset: Inset) => ReactNode;
  header: ReactNode;
  /** The season band and, on a phone, the two ways into the drawers. */
  band: ReactNode;
  /** The list, once per place it stands: the desktop panel and the drawer. */
  sidebar: (variant: "aside" | "sheet") => ReactNode;
  detail: (selection: Selection) => ReactNode;
}

/**
 * The shell: a header along the top and, on a phone, the season bar along the
 * bottom, both of them translucent and both of them *over* the map, which
 * fills the viewport behind everything. Between them the floating panels, in a
 * position context of their own, so they start below the header and end above
 * the bar without either being told a number. On desktop the bar is a card in
 * that same box, beside the panels, and the panels run the full height
 * (docs/ui-conventions.md, "The map is the page, and the shell is over it").
 *
 * What it draws it also measures: the two bars are translucent, so the map
 * runs on underneath them and a camera target behind one is simply unreadable.
 * `shellGeometry` (lib/shell-geometry.ts) turns the measurements into one
 * value – the padding the map is handed and the custom properties the classes
 * below read – so no width is spelled twice and no camera target lands behind
 * a panel.
 *
 * Everything in it arrives as a slot. The shell knows where a panel stands and
 * how much of the map it takes; what a panel says is the explorer's business,
 * which is what keeps this file a layout and that one a composition.
 */
export const Shell = ({
  band,
  detail,
  dispatch,
  header,
  last,
  listRef,
  map,
  mobile,
  onBack,
  selection,
  sheet,
  sidebar,
  sidebarOpen,
}: Props) => {
  const { t } = useT();
  const isXl = useMediaQuery("(width >= 80rem)");
  const viewportHeight = useViewportHeight();
  const sheetInset = useSheetInset();
  const [headerRef, headerHeight] = useHeight();
  const [barRef, barHeight] = useHeight();

  // The detail sheet's share is claimed in the same commit as the selection,
  // one flight ahead of the camera – which is precisely what keeps the picture
  // still: a padding the map has not applied yet cannot move it, and the
  // flight that follows carries it.
  const shell = shellGeometry({
    bars: { header: headerHeight, season: barHeight },
    panels: { detail: selection !== null, sidebar: sidebarOpen },
    sheet: {
      inset: sheetInset,
      snap: mobile
        ? selection
          ? sheet.detail.snap
          : sheet.list.open
            ? sheet.list.snap
            : 0
        : 0,
    },
    viewport: { height: viewportHeight, mobile, wide: isXl },
  });

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
      label={t.header.details}
      open={selection !== null}
      onClose={onBack}
      snapPoints={DETAIL_SNAPS}
      over={sheet.detail.nested}
      snap={sheet.detail.snap}
      onSnapChange={(snap) => dispatch({ sheet: "detail", snap, type: "snap" })}
    >
      {/* `last` is what the drawer keeps showing while it slides away, once
          there is nothing to show any more. */}
      {(selection ?? last) && detail((selection ?? last)!)}
    </MobileSheet>
  );

  return (
    <div
      className="relative flex h-dvh flex-col overflow-hidden"
      style={shell.vars}
    >
      <div id="map" tabIndex={-1} className="absolute inset-0">
        {map(shell.inset)}
      </div>

      <div ref={headerRef} className="relative z-20 shrink-0">
        {header}
      </div>

      {/* The map's own middle: a box below the header that the floating
          panels fill on desktop and that the season bar ends on a phone. */}
      <div className="pointer-events-none relative flex min-h-0 flex-1 flex-col justify-end">
        {!mobile && sidebarOpen && (
          <aside
            ref={listRef}
            className={cn(
              "pointer-events-auto absolute top-3 bottom-3 left-3 z-20 flex w-(--shell-sidebar) flex-col overflow-hidden max-lg:hidden",
              PANEL,
            )}
          >
            {sidebar("aside")}
          </aside>
        )}

        {!mobile && selection && (
          <section
            key={entityKey(selection)}
            aria-label={t.header.details}
            className={cn(
              "pointer-events-auto absolute top-3 bottom-3 left-(--shell-detail-left) z-20 flex w-(--shell-detail) flex-col overflow-hidden max-lg:hidden",
              "animate-in fade-in-0 slide-in-from-left-4 duration-200 motion-reduce:animate-none",
              PANEL,
            )}
          >
            {detail(selection)}
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
         * bottom-right corner, where the scale bar and the attribution sit
         * in a row (`--shell-right`). What its three shapes mean is one
         * popover away, and in the scales dialog.
         */}
        <div
          ref={barRef}
          className={cn(
            "pointer-events-auto z-20 flex shrink-0 flex-col gap-2 px-3 py-2",
            "max-lg:relative max-lg:border-t",
            "lg:absolute lg:right-(--shell-right) lg:bottom-3 lg:left-(--shell-left) lg:max-w-xl lg:rounded-xl lg:border lg:px-4 lg:py-3 lg:shadow-xl",
            SHELL_BAR,
          )}
        >
          {band}
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
      {mobile && (
        <>
          <MobileSheet
            label={t.header.list}
            open={sheet.list.open}
            onClose={() => dispatch({ open: false, type: "list" })}
            snapPoints={LIST_SNAPS}
            snap={sheet.list.snap}
            onSnapChange={(snap) =>
              dispatch({ sheet: "list", snap, type: "snap" })
            }
          >
            <div ref={listRef} className="flex min-h-0 flex-1 flex-col">
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
  );
};
