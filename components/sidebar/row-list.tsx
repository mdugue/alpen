"use client";

import { Fragment } from "react";

import { rowBlocks } from "@/lib/rows";
import { rovingList } from "@/lib/use-roving";

/**
 * One list of rows, in blocks of ten.
 *
 * A row already keeps its own layout, style and paint to itself
 * (`content-visibility` in `EntityRow`), but the row element itself is still
 * visited whenever the list is restyled. Inside a block that is off screen it
 * is not, because the skipped subtree is the block: twenty-one blocks stand in
 * for two hundred rows.
 *
 * They were introduced against a restyle of the whole list on every frame of
 * a sheet drag, and halved it (7.5 ms → 3.7 ms per frame for the roads, in
 * Chromium). The cause of that restyle was the drawer preset's inherited
 * custom properties, which `app/globals.css` now registers as non-inheriting;
 * with it gone the blocks measure next to nothing during a drag, and
 * `docs/ui-conventions.md` says what is left of the case for them.
 *
 * Windowing the list down to the rows on screen, with
 * `@tanstack/react-virtual` or by hand, measured no better than the blocks: it
 * would buy a dependency and rows that exist only while they are looked at.
 * Every row staying in the DOM is what keeps the list's arrows (`rovingList`),
 * `scrollIntoView` on the selected row and the browser's own find-in-page
 * working on every one of them.
 *
 * `contain-intrinsic-size` is the block's remembered height, so the scrollbar
 * does not jump; `auto` lets a block that has been rendered once keep what it
 * measured, and the estimate for one that never has is its rows at the height
 * of a plain one.
 *
 * The list is `role="list"` on a `<div>` rather than a `<ul>`: a block is an
 * element between the list and its rows, and `<ul>` may hold nothing but
 * `<li>`. The roles say what the markup no longer does on its own, and the
 * block itself is presentational, so a screen reader sees one list of rows.
 */
export const RowList = <T,>({
  items,
  keyOf,
  children,
}: {
  items: readonly T[];
  /** Stable key of a row; a block is keyed by its first row's. */
  keyOf: (item: T) => string;
  children: (item: T) => React.ReactNode;
}) => (
  // One tab stop per list, arrows inside it (`lib/use-roving.ts`).
  <div ref={rovingList} role="list">
    {rowBlocks(items).map((block) => (
      <div
        key={keyOf(block[0]!)}
        role="presentation"
        style={{ "--rows": block.length } as React.CSSProperties}
        className="[contain-intrinsic-size:auto_calc(var(--rows)*--spacing(12.5))] [content-visibility:auto]"
      >
        {block.map((item) => (
          <Fragment key={keyOf(item)}>{children(item)}</Fragment>
        ))}
      </div>
    ))}
  </div>
);
