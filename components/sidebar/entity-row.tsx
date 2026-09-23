"use client";

import { Star } from "lucide-react";

import { useT } from "@/components/i18n";
import { Toggle } from "@/components/ui/toggle";
import type { Selection } from "@/lib/app-state";
import { fill } from "@/lib/i18n";
import { entityKey, isHovered } from "@/lib/route-key";
import { cn, ICON_TOGGLE, TOUCH_ICON } from "@/lib/utils";

/**
 * What every row of every list does with the entity it shows, as one value
 * the sidebar builds once: which row is open, what the pointer is over, and
 * the three things a row can be asked to do. A row derives the rest from its
 * entity, so no list spells out the wiring again.
 */
export interface RowContext {
  /** The open entity's key (`entityKey`), or null. */
  currentRow: string | null;
  hovered: Selection | null;
  onHover: (entity: Selection | null) => void;
  onSelect: (entity: Selection) => void;
  onToggleFavorite: (entity: Selection) => void;
}

/**
 * One list row: favourite toggle, the selectable body and a right-aligned
 * column. No interactive element is nested inside another – the body is its
 * own button, so Enter/Space and focus come for free.
 *
 * A row is a containment boundary (`content-visibility`). The lists are long
 * – 262 roads alone, ~40 elements per row – and contained, a row keeps its
 * own layout, style and paint to itself, and off screen it is skipped
 * altogether: whatever restyles the list (a filter chip, a state change of
 * the sheet around it) pays for the rows on screen, not for nine thousand
 * elements. The rows come in blocks of ten on top of that (`RowList`), each
 * block a skipped subtree of its own, so that the row elements of an
 * off-screen block are not visited either.
 *
 * Both were introduced against a restyle of the whole list on every frame of
 * a sheet drag. Its cause was elsewhere – inherited custom properties in the
 * drawer preset, registered as non-inheriting in `app/globals.css` since –
 * and `docs/ui-conventions.md` has what the containment still measures
 * without it.
 *
 * `auto` in the intrinsic size lets a row remember what it measured, so the
 * scrollbar does not jump; the step is the height of a row that has never
 * been rendered, and it has to be the height a row actually has (50 px). A
 * list scrolled to a selected row it has not rendered yet adds the error up
 * row by row: at 48 px, a row sixty rows down landed out of view. The flip side of the paint containment is that a ring around
 * the body button would be clipped at the row's edge – hence the inset focus
 * ring.
 *
 * Two things the row carries for the list around it:
 *
 *  - `data-roving` marks the body as a stop of the composite widget, so the
 *    list is **one** tab stop with arrow keys inside it rather than one stop
 *    per row (`lib/use-roving.ts` has the measurement). The row carries
 *    `role="listitem"` because a block sits between it and the list, which
 *    is also why it is a `<div>` and not an `<li>` (`RowList`).
 *  - `name` is what the bookmark toggle is called. Its label used to be the
 *    bare word "Merken", which is fine once and useless two hundred times:
 *    a screen reader's list of buttons was two hundred identical entries
 *    with nothing to tell them apart.
 */
export const EntityRow = ({
  entity,
  name,
  subtitle,
  aside,
  trailing,
  favorite,
  className,
  leading,
  row,
}: {
  /** What the row shows; its key is the row's id (`data-row`), which focus returns to after the detail view closes. */
  entity: Selection;
  /** The title, and the plain name for the labels no sighted user reads. */
  name: string;
  subtitle: React.ReactNode;
  /** Right column, e.g. elevation and status. */
  aside?: React.ReactNode;
  /** Extra cell after the aside, e.g. a map-visibility switch. */
  trailing?: React.ReactNode;
  /** Small glyph in front of the title, e.g. a tour colour bar. */
  leading?: React.ReactNode;
  favorite: boolean;
  className?: string;
  row: RowContext;
}) => {
  const { t } = useT();
  const rowId = entityKey(entity);
  const current = row.currentRow === rowId;
  // The pointer is over this entity – here or on the map; one highlight for both.
  const hovered = isHovered(row.hovered, entity.kind, entity.slug);
  const onHover = (over: boolean) => row.onHover(over ? entity : null);
  return (
    <div
      role="listitem"
      data-current={current ? true : undefined}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      className={cn(
        "border-border grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1 border-b",
        "[contain-intrinsic-size:auto_--spacing(12.5)] [content-visibility:auto]",
        // The hover tint is the same surface the selected row carries, at half
        // the weight and without the accent bar: the map and the list answer
        // the pointer in one another's half of the screen, and the two states
        // have to be told apart at a glance – "this is what you are pointing
        // at" against "this is what is open".
        hovered && !current && "bg-accent/8",
        current && "bg-accent/15 shadow-[inset_2px_0_0_var(--color-accent)]",
        className,
      )}
    >
      <Toggle
        pressed={favorite}
        onPressedChange={() => row.onToggleFavorite(entity)}
        aria-label={
          favorite
            ? fill(t.favorite.unsave, { name })
            : fill(t.favorite.save, { name })
        }
        tabIndex={-1}
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
        data-roving
        tabIndex={-1}
        aria-current={current ? "true" : undefined}
        onClick={() => row.onSelect(entity)}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        className="focus-visible:inset-ring-ring/50 min-w-0 rounded-sm py-2 pr-1 text-left outline-none focus-visible:inset-ring-2"
      >
        <span className="flex items-center gap-1.5 text-xs leading-tight font-medium">
          {leading}
          <span className="truncate">{name}</span>
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
          {subtitle}
        </span>
      </button>
      <div className="flex items-center gap-2 pr-3 text-right">
        {aside !== undefined && (
          <div className="flex flex-col items-end gap-0.5 text-xs">{aside}</div>
        )}
        {trailing}
      </div>
    </div>
  );
};
