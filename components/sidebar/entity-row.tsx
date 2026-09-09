"use client";

import { Star } from "lucide-react";

import { Toggle } from "@/components/ui/toggle";
import { cn, ICON_TOGGLE, TOUCH_ICON } from "@/lib/utils";

/**
 * One list row: favourite toggle, the selectable body and a right-aligned
 * column. No interactive element is nested inside another – the body is its
 * own button, so Enter/Space and focus come for free.
 *
 * A row is a containment boundary (`content-visibility`), and that is what
 * keeps the phone usable. The lists are long – 92 passes alone, ~40 elements
 * per row – and on a phone they sit inside the bottom sheet, whose popup gets
 * a custom property written to it on every single touchmove of a drag
 * (`--drawer-swipe-movement-y`, and the snap offset whenever the sheet
 * resizes). Custom properties are inherited and Tailwind resolves one in
 * nearly every utility, so such a write invalidates the style of the whole
 * subtree: with the passes unfolded that was one ~300 ms recalculation per
 * touchmove, which is what made dragging the sheet, scrolling and the filter
 * panel crawl. Contained, a row keeps its own layout, style and paint to
 * itself, and off screen it is skipped altogether; measured on a throttled
 * phone profile the recalculation drops to about a third.
 *
 * `auto` in the intrinsic size lets a row remember what it measured, so the
 * scrollbar does not jump; the step is the height of a row that has never
 * been rendered. The flip side of the paint containment is that a ring around
 * the body button would be clipped at the row's edge – hence the inset focus
 * ring.
 */
export const EntityRow = ({
  title,
  subtitle,
  aside,
  trailing,
  favorite,
  onToggleFavorite,
  onSelect,
  className,
  leading,
  rowId,
  current,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  /** Right column, e.g. elevation and status. */
  aside?: React.ReactNode;
  /** Extra cell after the aside, e.g. a map-visibility switch. */
  trailing?: React.ReactNode;
  /** Small glyph in front of the title, e.g. a tour colour bar. */
  leading?: React.ReactNode;
  favorite: boolean;
  onToggleFavorite: () => void;
  onSelect: () => void;
  className?: string;
  /** `kind:slug`, used to return focus to the row after the detail view closes. */
  rowId: string;
  current?: boolean;
}) => (
  <li
    data-current={current || undefined}
    className={cn(
      "border-border grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1 border-b",
      "[contain-intrinsic-size:auto_--spacing(12)] [content-visibility:auto]",
      current && "bg-accent/15 shadow-[inset_2px_0_0_var(--color-accent)]",
      className,
    )}
  >
    <Toggle
      pressed={favorite}
      onPressedChange={onToggleFavorite}
      aria-label={favorite ? "Nicht mehr merken" : "Merken"}
      className={cn(ICON_TOGGLE, TOUCH_ICON, "ml-1.5")}
    >
      <Star
        className={cn(
          favorite ? "fill-accent text-accent" : "text-muted-foreground/60",
        )}
      />
    </Toggle>
    <button
      type="button"
      data-row={rowId}
      aria-current={current ? "true" : undefined}
      onClick={onSelect}
      className="focus-visible:inset-ring-ring/50 min-w-0 rounded-sm py-2 pr-1 text-left outline-none focus-visible:inset-ring-2"
    >
      <span className="flex items-center gap-1.5 text-xs leading-tight font-medium">
        {leading}
        <span className="truncate">{title}</span>
      </span>
      <span className="text-muted-foreground mt-0.5 block truncate text-xs">
        {subtitle}
      </span>
    </button>
    <div className="flex items-center gap-2 pr-3 text-right">
      {aside && (
        <div className="flex flex-col items-end gap-0.5 text-xs">{aside}</div>
      )}
      {trailing}
    </div>
  </li>
);
