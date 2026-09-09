"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

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
  /**
   * Left out for a sheet that never leaves the screen: a swipe past the lowest
   * snap point then settles on it instead of dismissing the sheet.
   */
  onClose?: () => void;
  /** Lowest first, at least two; a tap on the handle toggles between the first two. */
  snapPoints: readonly [number, number, ...number[]];
  snap: number;
  onSnapChange: (snap: number) => void;
  children: React.ReactNode;
}

/**
 * The bottom sheet of the mobile layout: one per panel, so the list and the
 * detail slide over each other the way the two floating panels sit next to each
 * other on desktop. The sheet is non-modal – the map stays visible above it and
 * keeps its taps, which is why an outside press must not dismiss it.
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
      onSnapPointChange={(next, details) => {
        if (next !== null) {
          onSnapChange(next as number);
          return;
        }
        // `null` is the drawer on its way out after a fast flick downwards.
        if (onClose) return;
        details.cancel();
        onSnapChange(collapsed);
      }}
      onOpenChange={(next) => {
        if (!next) onClose?.();
      }}
    >
      {/*
       * The sheet holds the search field, and a software keyboard opening under
       * a fixed, transformed element is where browsers start scrolling the page
       * on their own – which used to carry the whole sheet, field included, off
       * the top of the screen. Base UI's provider takes that over and keeps the
       * focused field visible; it is not re-exported by `components/ui/drawer.tsx`,
       * so it comes from the primitive directly.
       */}
      <DrawerPrimitive.VirtualKeyboardProvider>
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
            "[padding-bottom:max(0px,calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)))]",
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
          {/*
           * The body ends above the home indicator, and above the software
           * keyboard while one is open (the provider above measures it; the
           * `0px` fallback is required, the variable only exists while the
           * keyboard is aligned).
           */}
          <div className="flex min-h-0 flex-1 flex-col pb-[max(env(safe-area-inset-bottom,0px),var(--drawer-keyboard-inset,0px))]">
            {children}
          </div>
        </DrawerContent>
      </DrawerPrimitive.VirtualKeyboardProvider>
    </Drawer>
  );
};
