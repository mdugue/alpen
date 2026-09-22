"use client";
import { useState } from "react";

import type { DetailAsset, DetailData } from "@/lib/detail-assets";
import type { Photo, ProfileWithCoords } from "@/lib/types";
import useFetch from "@/lib/use-fetch";

/** The ascent profiles of one entity, keyed as `routes.json` (`ascentKey`). */
export type Profiles = Record<string, ProfileWithCoords>;

/**
 * Where the selected entity's detail file has got to.
 *
 * The panel renders before the file arrives – the name, the status, the season
 * strip and the ratings are all in the page – so the blocks that wait for it
 * have to say which of four things is true, and there is exactly one value
 * that says it. Three booleans said it before: the profile skeleton read
 * `loading`, the photo skeleton read "the photos array is empty", and the head
 * read the count the page already knew. A 404 after a stale deploy satisfied
 * the second forever, which left an `aria-busy` skeleton on screen with
 * nothing on its way and nothing able to test it (docs/plans/31-panel-model.md).
 *
 * `absent` is not a failure: an entity with neither photos nor profiles has no
 * file, and nothing is requested for it.
 */
export type DetailState =
  | { phase: "absent" }
  /** On its way; `photos` is the count the page already knows (`DetailAsset`). */
  | { phase: "pending"; photos: number }
  | {
      phase: "ready";
      photos: Photo[];
      profiles: Profiles;
      /** The photo URLs the browser could not load; see `useDetailState`. */
      broken: ReadonlySet<string>;
    }
  | { phase: "failed" };

/** What the fetch says about the file, in `lib/use-fetch.ts`'s shape. */
export interface Fetched<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

const NOTHING_BROKEN: ReadonlySet<string> = new Set();

/**
 * The transition, without React: an asset, what the fetch says about it and
 * which of its photos failed. Pure, so the four phases are a table test rather
 * than a rendered panel.
 */
export const detailState = (
  asset: DetailAsset | undefined,
  fetched: Fetched<DetailData>,
  broken: ReadonlySet<string> = NOTHING_BROKEN,
): DetailState => {
  if (!asset) return { phase: "absent" };
  if (fetched.loading) return { phase: "pending", photos: asset.photos };
  // A file that answered with anything but its contents is a failure, however
  // it failed: the panel says so and stops reserving room for what is not
  // coming.
  if (fetched.error || !fetched.data) return { phase: "failed" };
  return {
    broken,
    phase: "ready",
    photos: fetched.data.photos,
    profiles: fetched.data.profiles ?? {},
  };
};

/** The slides still worth showing: everything the browser has not failed on. */
export const shownPhotos = (state: DetailState): Photo[] =>
  state.phase === "ready"
    ? state.photos.filter((p) => !state.broken.has(p.src))
    : [];

export const profilesOf = (state: DetailState): Profiles =>
  state.phase === "ready" ? state.profiles : {};

/**
 * Whether the panel opens on a photograph – the one decision the head makes.
 *
 * The shape is known from the page's own `DetailAsset` before the file
 * arrives, so the head has it from the first frame and nothing below it jumps.
 * It gives way when there is no picture left for white letters to lie on:
 * every slide failed, the file did not arrive, or there was never one.
 */
export const heroShape = (state: DetailState): "hero" | "plain" =>
  (state.phase === "pending" && state.photos > 0) ||
  (state.phase === "ready" && shownPhotos(state).length > 0)
    ? "hero"
    : "plain";

/**
 * How tall the floating control row is – what the head has to have scrolled
 * past before the row takes on a surface and the name.
 */
export const BAR_PX = 44;

/** What the panel measured of its head; an `HTMLElement` has both. */
export interface HeadBox {
  offsetTop: number;
  offsetHeight: number;
}

/**
 * Whether the panel head has scrolled out from under the control row – the
 * decision behind the bar's two shapes, so the component is left with the
 * measuring alone.
 *
 * The head goes under the row rather than off the top of it, so the threshold
 * is the head's own foot minus the row's height. A head shorter than the row
 * has no threshold at all: the clamp is what keeps a negative limit from
 * making the bar solid at a scroll position of zero, which is the panel
 * opening already scrolled.
 *
 * There is no hysteresis and none is wanted: the change is a fade of two
 * colours over 200 ms, not a layout, and a band around the threshold would
 * only make the fade start at two different places depending on the
 * direction.
 *
 * @param scrollTop where the panel's scroller stands
 * @param head the first child of the scroller – the hero or the plain title
 *   block – or `null` before there is one
 */
export const pastHead = (scrollTop: number, head: HeadBox | null): boolean =>
  scrollTop >
  Math.max(0, (head?.offsetTop ?? 0) + (head?.offsetHeight ?? 0) - BAR_PX);

/**
 * The state of one entity's detail file, and the way back for the carousel.
 *
 * Which borrowed files failed belongs here rather than in the carousel that
 * discovers it, because it decides the shape of the whole panel head. The set
 * is keyed by URL, so a photo left over from another entity cannot mark the
 * wrong slide broken – which is why it needs no resetting when the selection
 * changes.
 *
 * The hook is the thin half: everything it decides is `detailState`, which a
 * test drives with a `Fetched` value of its own – no network, no DOM.
 */
export const useDetailState = (
  asset: DetailAsset | undefined,
): { state: DetailState; markBroken: (src: string) => void } => {
  const [broken, setBroken] = useState<ReadonlySet<string>>(NOTHING_BROKEN);
  const fetched = useFetch<DetailData>(asset?.url ?? null);
  return {
    markBroken: (src: string) =>
      setBroken((seen) => (seen.has(src) ? seen : new Set(seen).add(src))),
    state: detailState(asset, fetched, broken),
  };
};
