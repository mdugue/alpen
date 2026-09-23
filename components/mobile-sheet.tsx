"use client";

import { createContext, use, useSyncExternalStore } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerSwipeHandle,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * What a drawer keeps free of the viewport edge, in pixels.
 *
 * The camera padding is arithmetic and cannot read a custom property, and the
 * sheet in front of the map is the largest thing that padding is made of – so
 * the number has to exist in JavaScript. It is *measured* off a mounted popup
 * rather than written down twice: the token is the preset's own
 * `--drawer-inset` in `components/ui/drawer.tsx`, a generated file that
 * `bun run ui:init` rewrites, and a copy of it here would have gone quietly
 * stale the first time the preset changed its spacing.
 *
 * What is measured is the popup's own bottom margin, which is what
 * `--drawer-inset` is spent on and the one form of it the browser resolves to
 * pixels. It is read once, the first time a sheet is on screen, and the shell
 * is told through `useSheetInset`.
 *
 * The sheet used to be pinned flush to the three edges, which is the one shape
 * a drawer on a map should not have: full-bleed reads as a new page, and this
 * one is a card lying on a map that stays visible beside it. The preset's inset
 * (and with it the rounded corners on all four sides) says that much before
 * anything in the sheet is read.
 */
let sheetInset = 0;
const watchers = new Set<() => void>();

const measureInset = (el: HTMLElement | null) => {
  const popup = el?.closest("[data-slot=drawer-popup]");
  if (!popup || sheetInset) return;
  // A used value, so it is always "<n>px" – the one form of the token the
  // browser resolves for us.
  const px = Number(getComputedStyle(popup).marginBottom.replace(/px$/u, ""));
  if (!Number.isFinite(px) || px === 0) return;
  sheetInset = px;
  for (const notify of watchers) notify();
};

/** The measured inset; `0` until a sheet has been on screen once. */
export const useSheetInset = (): number =>
  useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
      };
    },
    () => sheetInset,
    () => 0,
  );

/** What the sheet a subtree is in knows about itself. */
export interface EnclosingSheet {
  /**
   * Whether the sheet has been pulled all the way up – `true` outside a
   * sheet, where nothing is in the way of a scroll.
   *
   * **The content does not scroll until the sheet is at its topmost snap
   * point.** That is the one rule that makes a sheet over a map draggable at
   * all, and it is what Apple Maps, Komoot and Strava all do. The drag and
   * the scroll are the same gesture, so something has to arbitrate, and Base
   * UI arbitrates the way the platform does: a touch that starts inside a
   * scroll container may swipe the sheet *down* from the scroll top, but a
   * drag *up* always goes to the scroller. On a detail sheet whose top half
   * is a photo that means the sheet could only be enlarged by the 20 px
   * grabber – every other pixel of it scrolled the text instead.
   *
   * Locking the scroll removes the ambiguity rather than dividing the screen
   * up into regions that behave differently: below the top snap point there
   * is no scroll container at all, so the whole sheet is a drag handle, and
   * the gesture that enlarges it is the same one everywhere on it. Once it is
   * up, the content scrolls and a swipe down from its top edge puts it back.
   *
   * It is `overflow: hidden` rather than a handler, because the arbitration
   * happens in the browser's own gesture routing: what is not scrollable is
   * not offered the gesture in the first place.
   */
  expanded: boolean;
  /**
   * This sheet lies on another one, which comes back when it goes away. The
   * detail panel reads it for the one word on its leftmost control: rendered
   * inside the list drawer, leaving means going back to the list; over the
   * bare map it simply closes, and says that instead. Naming the wrong
   * destination is worse than naming none – and the panel now learns both
   * facts from the sheet it is in, rather than one from a context and one
   * from a prop threaded down through the explorer.
   */
  over: boolean;
}

/**
 * Two contexts rather than one carrying an object: a provider value that is
 * built in the render is a new object every frame, and a sheet re-renders on
 * every drag frame. Both facts are booleans, so they travel as booleans and
 * are put back together on the reading side.
 */
const Expanded = createContext(true);
const Over = createContext(false);

export const useSheet = (): EnclosingSheet => ({
  expanded: use(Expanded),
  over: use(Over),
});

interface Props {
  /** Names the sheet for screen readers. */
  label: string;
  /** What the tap target on the swipe handle says, collapsed and expanded ("Liste ausklappen"). */
  handle: { expand: string; collapse: string };
  /** Rendered inside another sheet, which it stacks on; see `EnclosingSheet`. */
  over?: boolean;
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
  handle,
  over = false,
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
          // scroll container inside does too (the sum goes negative above the
          // topmost snap point, hence the `max`). The inset comes off again:
          // the popup is lifted by its own bottom margin, so that much of it
          // is already below the fold.
          "[padding-bottom:max(0px,calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)-var(--drawer-inset,0px)))]",
          // …except while the finger is down. The swipe movement is written to
          // the popup on every frame of a drag, so a padding that reads it
          // re-lays-out the whole sheet – on a phone, a list of two hundred
          // rows – once per frame (measured: 162 layouts per drag against 19
          // without it), and it is a layout nobody sees: a content box that
          // reaches past the fold is clipped by the viewport either way. Zero
          // is the one value that is always safe while dragging, because the
          // box is then the full height of the popup and can never end short
          // of the fold, however far the sheet is pulled. The true padding is
          // back when the sheet settles, and the box only ever shrinks by it,
          // so nothing that is on screen moves – below the top snap point,
          // where the content is locked at `scrollTop` 0. At the top it may be
          // scrolled to its end, and a box that grows there clamps the scroll
          // and drops the content by the padding (60 px, measured). So there
          // the padding keeps its resting value instead: it reads nothing that
          // changes per frame either, and from the top a drag only goes down.
          snap === top
            ? "data-swiping:[padding-bottom:max(0px,calc(var(--drawer-snap-point-offset,0px)-var(--drawer-inset,0px)))]"
            : "data-swiping:pb-0",
        )}
      >
        <DrawerTitle className="sr-only">{label}</DrawerTitle>
        {/* Tap target for everyone who does not swipe: collapsed ↔ expanded. */}
        <button
          type="button"
          onClick={() => onSnapChange(isCollapsed ? top : collapsed)}
          aria-label={isCollapsed ? handle.expand : handle.collapse}
          className="w-full shrink-0"
        >
          <DrawerSwipeHandle className="h-5" />
        </button>
        {/* Inside the popup, which is what carries the inset the shell needs. */}
        <div
          ref={measureInset}
          className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom,0px)]"
        >
          <Expanded value={snap >= top}>
            <Over value={over}>{children}</Over>
          </Expanded>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
