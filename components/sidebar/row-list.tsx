"use client";

import { rowBlocks } from "@/lib/rows";

/**
 * One list of rows, in blocks of ten.
 *
 * The blocks are there for one measurement. On a phone the lists sit inside
 * the bottom sheet, and the sheet's popup gets a custom property written to it
 * on every frame of a drag (`--drawer-swipe-movement-y`, and the snap offset
 * whenever it resizes). A custom property is inherited, and Chrome answers a
 * changed one by recalculating the style of the **whole** subtree – measured
 * here: an unrelated `--zzz` written to the popup costs exactly as much as the
 * drawer's own property, and redeclaring the property further down does not
 * stop the walk. So the cost of dragging the sheet is the number of elements
 * under it, and with the 201 roads that was 7.5 ms per frame against 3.3 ms
 * for the 9 tours – which is precisely the difference between the list that
 * stutters and the two that do not.
 *
 * A row already keeps its own layout, style and paint to itself
 * (`content-visibility` in `EntityRow`), but the row element itself is still
 * visited: 200 of them are two thirds of the bill. Inside a block that is off
 * screen they are not visited at all, because the skipped subtree is the
 * block. Twenty-one blocks replace two hundred rows in that walk, which halves
 * the frame – 7.5 ms → 3.7 ms for the roads, 5.0 ms → 2.7 ms for the towns,
 * measured on the built page at 390 × 844 – and leaves the roads where the
 * tours already were. Windowing the list down to the rows on screen, with
 * `@tanstack/react-virtual` or by hand, measured the same floor and no better:
 * it would buy a dependency and rows that exist only while they are looked at.
 * Every row staying in the DOM is what keeps `useRoving`'s arrows,
 * `scrollIntoView` on the selected row and the browser's own find-in-page
 * working on all 201 of them.
 *
 * `contain-intrinsic-size` is the block's remembered height, so the scrollbar
 * does not jump; `auto` lets a block that has been rendered once keep what it
 * measured, and the estimate for one that never has is its rows at the height
 * of a plain one.
 *
 * The list is `role="list"` on a `<div>` rather than a `<ul>`: a block is an
 * element between the list and its rows, and `<ul>` may hold nothing but
 * `<li>`. The roles say what the markup no longer does on its own, and the
 * block itself is presentational, so a screen reader sees one list of 201.
 */
export const RowList = <T,>({
  items,
  keyOf,
  children,
  ref,
}: {
  items: T[];
  /** Stable key for the block – the first row's slug. */
  keyOf: (item: T) => string;
  children: (item: T) => React.ReactNode;
  /** The roving tab stop of this list (`lib/use-roving.ts`). */
  ref?: React.Ref<HTMLDivElement>;
}) => (
  <div ref={ref} role="list">
    {rowBlocks(items).map((block) => (
      <div
        key={keyOf(block[0]!)}
        role="presentation"
        style={{ "--rows": block.length } as React.CSSProperties}
        className="[contain-intrinsic-size:auto_calc(var(--rows)*--spacing(12))] [content-visibility:auto]"
      >
        {block.map((item) => children(item))}
      </div>
    ))}
  </div>
);
