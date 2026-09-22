"use client";

import { useEffect, useRef } from "react";

/**
 * Turns a long list into one tab stop.
 *
 * The sidebar holds 201 roads, 9 tours and 48 towns, and every row used to be
 * two tab stops of its own – the bookmark toggle and the row itself. Measured
 * on the built page that was **562 focusable elements**, so reaching the map,
 * the footer or anything past the first list meant holding Tab down for
 * several hundred presses. A screen reader's element rotor had the same
 * problem in the other direction: two hundred entries whose whole accessible
 * name was the word "Merken".
 *
 * This is the composite-widget pattern the platform expects for a list of
 * peers: the list is one stop, arrows move inside it, Home and End jump to
 * the ends, PageUp/PageDown move by ten. Only one row carries `tabIndex=0` at
 * a time – whichever was last focused, so tabbing back into the list returns
 * to where it was left rather than to the top.
 *
 * It works off the DOM rather than off an index in React state on purpose:
 * which rows exist changes with every keystroke in the search field, and a
 * remembered index would point at a different pass a moment later. The
 * element itself is remembered instead, and when it is filtered away the list
 * falls back to its first row.
 *
 * The listeners are attached in the effect rather than handed back as JSX
 * props: the list is a plain `<div role="list">`, and a list carrying key and
 * pointer handlers is exactly what `jsx-a11y/no-noninteractive-element-interactions`
 * is there to catch. Here the element genuinely is the composite widget and
 * the rows inside it are the interactive parts, which is the shape the DOM
 * listener expresses and the JSX prop does not.
 */
const ROW = "[data-roving]";

const STEP: Record<string, number> = {
  ArrowDown: 1,
  ArrowUp: -1,
  PageDown: 10,
  PageUp: -10,
};

/**
 * Which row a key moves the focus to, or `null` when the key is none of the
 * list's business and belongs to the platform – Enter opening the row, Tab
 * leaving the widget, a letter reaching the search field.
 *
 * `from` is the row the key was pressed on, or -1 when the focus is not on a
 * row at all; the ends do not wrap, because a list of 201 roads read by a
 * screen reader is a place to walk, not a carousel.
 */
export const rovingTarget = (
  key: string,
  from: number,
  count: number,
): number | null => {
  if (count === 0) return null;
  const last = count - 1;
  const step = STEP[key];
  if (step === undefined) return { End: last, Home: 0 }[key] ?? null;
  return Math.min(last, Math.max(0, from + step));
};

export const useRoving = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    /** The row that owns the tab stop; re-read from the DOM, never from an index. */
    let current: HTMLElement | null = null;
    const rows = () => [...root.querySelectorAll<HTMLElement>(ROW)];

    /** Exactly one row is tabbable; everything else is reached by arrow. */
    const sync = () => {
      const all = rows();
      if (all.length === 0) return;
      const active = current && all.includes(current) ? current : all[0]!;
      current = active;
      for (const el of all) el.tabIndex = el === active ? 0 : -1;
    };

    const onFocusIn = (e: FocusEvent) => {
      const row = (e.target as HTMLElement | null)?.closest<HTMLElement>(ROW);
      if (!row) return;
      current = row;
      sync();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const all = rows();
      const from = (e.target as HTMLElement | null)?.closest<HTMLElement>(ROW);
      const to = rovingTarget(e.key, from ? all.indexOf(from) : -1, all.length);
      if (to === null) return;
      const next = all[to];
      e.preventDefault();
      next?.focus();
      next?.scrollIntoView({ block: "nearest" });
    };

    sync();
    // The rows change on every keystroke in the search field and on every tab
    // switch, so the tab stop is re-established whenever the subtree does.
    const mo = new MutationObserver(sync);
    mo.observe(root, { childList: true, subtree: true });
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("keydown", onKeyDown);
    return () => {
      mo.disconnect();
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return ref;
};
