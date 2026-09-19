"use client";

import { createContext, use } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerSwipeHandle,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * What the drawer keeps free of the viewport edge – the preset's own
 * `--drawer-inset`, in pixels, because the camera padding is arithmetic and
 * cannot read a custom property.
 *
 * The sheet used to be pinned flush to the three edges, which is the one
 * shape a drawer on a map should not have: full-bleed reads as a new page,
 * and this one is a card lying on a map that stays visible beside it. The
 * preset's inset (and with it the rounded corners on all four sides) says
 * that much before anything in the sheet is read.
 */
export const SHEET_INSET_PX = 8;

/**
 * What an open sheet covers of the map, in pixels – its snap point plus the
 * margin it keeps to the screen edge. `0` for no sheet at all.
 *
 * Base UI reads snap points above 1 as pixels and below it as a fraction of
 * the viewport; the camera padding is arithmetic and can read neither those
 * nor the `--drawer-inset` the margin comes from, so both are converted here,
 * where the sheet's own geometry lives.
 */
export const sheetCover = (snap: number, viewportHeight: number) =>
  snap
    ? (snap <= 1 ? Math.round(snap * viewportHeight) : snap) + SHEET_INSET_PX
    : 0;

/**
 * Whether the sheet a subtree is in has been pulled all the way up – `true`
 * outside a sheet, where nothing is in the way of a scroll.
 *
 * **The content does not scroll until the sheet is at its topmost snap point.**
 * That is the one rule that makes a sheet over a map draggable at all, and it
 * is what Apple Maps, Komoot and Strava all do. The drag and the scroll are
 * the same gesture, so something has to arbitrate, and Base UI arbitrates the
 * way the platform does: a touch that starts inside a scroll container may
 * swipe the sheet *down* from the scroll top, but a drag *up* always goes to
 * the scroller. On a detail sheet whose top half is a photo that means the
 * sheet could only be enlarged by the 20 px grabber – every other pixel of it
 * scrolled the text instead.
 *
 * Locking the scroll removes the ambiguity rather than dividing the screen up
 * into regions that behave differently: below the top snap point there is no
 * scroll container at all, so the whole sheet is a drag handle, and the
 * gesture that enlarges it is the same one everywhere on it. Once it is up,
 * the content scrolls and a swipe down from its top edge puts it back.
 *
 * It is `overflow: hidden` rather than a handler, because the arbitration
 * happens in the browser's own gesture routing: what is not scrollable is not
 * offered the gesture in the first place.
 */
const SheetExpanded = createContext(true);

export const useSheetExpanded = () => use(SheetExpanded);

interface Props {
  /** Names the sheet for screen readers and its swipe handle ("… ausklappen"). */
  label: string;
  open: boolean;
  /** A swipe down past the lowest snap point, or Escape: the sheet goes away. */
  onClose: () => void;
  /** Lowest first, at least two; a tap on the handle toggles between the first two. */
  snapPoints: readonly [number, number, ...number[]];
  snap: number;
  onSnapChange: (snap: number) => void;
  children: React.ReactNode;
}

/**
 * The bottom sheet of the mobile layout. Non-modal – the map stays visible
 * above it and keeps its taps, which is why an outside press must not dismiss
 * it – with snap points, so the same sheet is half a screen or nearly the
 * whole one.
 *
 * There are two of them (`explorer.tsx`), the list and the detail, and neither
 * is mounted until it is asked for: the map is the page on a phone as much as
 * on a desktop, so nothing covers it at rest. A detail opened from the map has
 * bare map behind it and closes; one opened from a row is rendered *inside*
 * the list's drawer, so Base UI stacks the two – the list scales back and
 * peeks above the detail – and dismissing the front one uncovers a list that
 * never moved.
 */
export const MobileSheet = ({
  label,
  open,
  onClose,
  snapPoints,
  snap,
  onSnapChange,
  children,
}: Props) => {
  const [collapsed, ...rest] = snapPoints;
  const top = rest.at(-1) ?? collapsed;
  const isCollapsed = snap === collapsed;

  return (
    <Drawer
      open={open}
      modal={false}
      disablePointerDismissal
      snapPoints={[...snapPoints]}
      snapPoint={snap}
      onSnapPointChange={(next) => {
        // `null` is the drawer on its way out after a fast flick downwards;
        // `onOpenChange` handles that one.
        if (next !== null) onSnapChange(next as number);
      }}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DrawerContent
        className={cn(
          "data-[swipe-axis=y]:[--drawer-content-max-height:100dvh]",
          // With snap points the popup is a full 100dvh tall and translated
          // down by the offset of the current one. Padding the same amount off
          // its bottom leaves a content box that ends at the fold, so every
          // scroll container inside does too – during the drag as well, which
          // is why the swipe movement counts (it goes negative above the
          // topmost snap point, hence the `max`). The inset comes off again:
          // the popup is lifted by its own bottom margin, so that much of it
          // is already below the fold.
          "[padding-bottom:max(0px,calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)-var(--drawer-inset,0px)))]",
        )}
      >
        <DrawerTitle className="sr-only">{label}</DrawerTitle>
        {/* Tap target for everyone who does not swipe: collapsed ↔ expanded. */}
        <button
          type="button"
          onClick={() => onSnapChange(isCollapsed ? top : collapsed)}
          aria-label={`${label} ${isCollapsed ? "ausklappen" : "einklappen"}`}
          className="w-full shrink-0"
        >
          <DrawerSwipeHandle className="h-5" />
        </button>
        <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom,0px)]">
          <SheetExpanded value={snap >= top}>{children}</SheetExpanded>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
