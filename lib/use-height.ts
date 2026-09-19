"use client";
import { useState } from "react";

/**
 * An element's measured height in px, kept up to date while it changes.
 *
 * The shell's two bars cover the map, and what they cover is handed to
 * MapLibre as padding so camera targets land in the visible part. A constant
 * would be wrong the moment the header's headline wraps to a second line –
 * which on a narrow phone depends on how many digits the counts have – so this
 * measures rather than promises. `0` on the server and for the first frame.
 *
 * The returned callback ref is stable thanks to the React Compiler; it
 * attaches a `ResizeObserver` and returns React 19's ref cleanup.
 */
export const useHeight = () => {
  const [height, setHeight] = useState(0);
  const ref = (el: HTMLElement | null) => {
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setHeight(el.getBoundingClientRect().height),
    );
    observer.observe(el);
    return () => observer.disconnect();
  };
  return [ref, height] as const;
};
