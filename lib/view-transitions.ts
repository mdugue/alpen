import { addTransitionType, startTransition } from "react";
import type { ComponentProps, ViewTransition } from "react";

import type { EntityKind } from "@/lib/app-state";

/**
 * The app's view-transition vocabulary, in one place because a view transition
 * is a contract between three files: the handler that opens the transition,
 * the `<ViewTransition>` that names what moves, and the CSS at the end of
 * app/globals.css that says how. Split across the tree those three drift apart
 * silently – a mistyped class or a missing transition type produces no error,
 * only an animation that never plays.
 *
 * Two facts shape everything below.
 *
 * A view transition only runs for an update inside `startTransition`,
 * `useDeferredValue` or a Suspense reveal; a plain `setState` never animates.
 * This app is a single route (`app/page.tsx` renders `Explorer` and the whole
 * state lives in the hash), so nothing arrives through a navigation: every
 * transition here is opened by hand with `animate` below, and Next's
 * `transitionTypes` on `<Link>` has nothing to do.
 *
 * And a transition is document-wide: the browser freezes the page under a
 * snapshot overlay for its duration. With a full-viewport WebGL map that is
 * the whole cost model, which is why every boundary here is `default: "none"`
 * and opts back in per transition type, and why the durations are short.
 */

/**
 * What the current update means. A boundary asks for the type rather than for
 * "something changed", because several kinds of change reach the same
 * boundary: the lists re-order when a filter moves _and_ re-render when a pass
 * is selected, and only the first of the two should make 92 rows move.
 */
export type TransitionType =
  /** The lists were rebuilt: a filter, the sort or the search query changed. */
  | "filter"
  /** A block of the sidebar opened or closed and moved what sits below it. */
  | "panel";

/**
 * Open a view transition around `change`. `type` is what the boundaries match
 * on; `null` opens an untyped transition, which is what the selection uses –
 * there the enter, exit and share of the detail panel already say what
 * happened, and the rows must hold still.
 */
export const animate = (type: TransitionType | null, change: () => void) =>
  startTransition(() => {
    if (type) addTransitionType(type);
    change();
  });

type Boundary = Omit<ComponentProps<typeof ViewTransition>, "children">;

/**
 * The season strip of one entity, shared between its list row and the detail
 * panel. The strip is the one thing that is literally the same picture in both
 * places – 24 cells for the same slug – so it is what carries "this is the
 * pass you pointed at" across the gap. Only one element may hold a given name
 * at a time, so the row drops it while it is the selected one and the panel
 * takes it over.
 */
export const stripName = (kind: EntityKind, slug: string) =>
  `strip-${kind}-${slug}`;

/** Row and panel strip: morph on select and on close, hold still otherwise. */
export const MORPH: Boundary = { default: "none", share: "morph" };

/**
 * A list row. Enter and exit only on a `filter` transition, because a row also
 * mounts when a section is unfolded and re-renders on every selection, and
 * neither is the list changing. `update` is what makes the rows that stay
 * glide to their new place instead of teleporting, which is the whole point:
 * it shows what a filter did rather than only what it left.
 */
export const ROW: Boundary = {
  default: "none",
  enter: { default: "none", filter: "row-in" },
  exit: { default: "none", filter: "row-out" },
  update: { default: "none", filter: "auto" },
};

/**
 * Content displaced by something growing or shrinking above it – the three
 * lists under the filter panel. Only content inside an activated boundary
 * animates its position; everything else jumps to its new layout spot.
 */
export const GLIDE: Boundary = {
  default: "none",
  update: { default: "none", filter: "auto", panel: "auto" },
};

/**
 * The detail slide-over. Three different moments, three different answers:
 * it enters from the sidebar's edge, leaves the same way, and crossfades in
 * place when another entity is selected while it is open – "same place,
 * different content", which a slide would misreport as a new panel. The
 * crossfade needs a `name` and a `key` at the call site: the key change is
 * what makes React pair the old and the new content instead of updating in
 * place. `update` lets it glide when the sidebar folds away under it.
 */
export const DETAIL: Boundary = {
  default: "none",
  enter: "panel-in",
  exit: "panel-out",
  share: "panel-swap",
  update: { default: "none", panel: "auto" },
};

/** The sidebar itself, folded away and back by the map's own toggle. */
export const SIDEBAR: Boundary = {
  default: "none",
  enter: { default: "none", panel: "panel-in" },
  exit: { default: "none", panel: "panel-out" },
};

/** A block that opens and closes inside the sidebar, e.g. the filter panel. */
export const BLOCK: Boundary = {
  default: "none",
  enter: { default: "none", panel: "reveal-in" },
  exit: { default: "none", panel: "reveal-out" },
};

/**
 * The two halves of a load: the placeholder yields, the answer arrives. Used
 * on the one thing in the app that is actually fetched at runtime, the weather
 * forecast. Plain strings rather than a type map – the update that resolves a
 * fetch carries no transition type.
 */
export const LOADING: Boundary = { default: "none", exit: "reveal-out" };
export const LOADED: Boundary = { default: "none", enter: "reveal-in" };
