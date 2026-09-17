"use client";

import {
  Drawer,
  DrawerContent,
  DrawerSwipeHandle,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * Base UI reads snap points above 1 as pixels and below it as a fraction of
 * the viewport; the map needs the visible sheet height in pixels to pad its
 * camera, so it converts them back here.
 */
export const snapPx = (snap: number, viewportHeight: number) =>
  snap <= 1 ? Math.round(snap * viewportHeight) : snap;

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
 * bare map behind it and closes; one opened from a row has the list behind it
 * and goes back to it, by the detail drawer closing and uncovering what never
 * moved.
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
  const [collapsed, expanded] = snapPoints;
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
          "rounded-b-none border-b-0 [--drawer-inset:0px]",
          "data-[swipe-axis=y]:[--drawer-content-max-height:100dvh]",
          // With snap points the popup is a full 100dvh tall and translated
          // down by the offset of the current one. Padding the same amount off
          // its bottom leaves a content box that ends at the fold, so every
          // scroll container inside does too – during the drag as well, which
          // is why the swipe movement counts (it goes negative above the
          // topmost snap point, hence the `max`).
          "[--sheet-fold:max(0px,calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)))]",
          "pb-(--sheet-fold)",
        )}
      >
        <DrawerTitle className="sr-only">{label}</DrawerTitle>
        {/* Tap target for everyone who does not swipe: collapsed ↔ expanded. */}
        <button
          type="button"
          onClick={() => onSnapChange(isCollapsed ? expanded : collapsed)}
          aria-label={`${label} ${isCollapsed ? "ausklappen" : "einklappen"}`}
          className="w-full shrink-0"
        >
          <DrawerSwipeHandle className="h-6" />
        </button>
        <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom,0px)]">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
