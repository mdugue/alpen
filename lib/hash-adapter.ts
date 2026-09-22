"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { DEFAULT_VIEW, defined, EMPTY_HASH } from "@/lib/app-state";
import type {
  Action,
  AppState,
  Filters,
  HashState,
  MapView,
  Selection,
} from "@/lib/app-state";
import { parseHash, serializeHash } from "@/lib/hash";
import type { Lang } from "@/lib/i18n";
import type { CameraIntent } from "@/lib/map-camera";
import { entityKey } from "@/lib/route-key";
import {
  homeHref,
  hrefFor,
  selectionOf,
  withoutLegacySelection,
} from "@/lib/routes";
import { readStoredState, useStored } from "@/lib/use-stored";

/**
 * What the address bar says: the selection from the path (`lib/routes.ts`),
 * everything else from the hash. A link from before plan 02 carries its
 * selection in the hash instead, and that is honoured too – the adapter
 * moves such a link over to the path once it has read it.
 */
export const readHash = (): HashState => {
  if (typeof window === "undefined") return EMPTY_HASH;
  const hash = parseHash(window.location.hash);
  return {
    ...hash,
    selection: selectionOf(window.location.pathname) ?? hash.selection,
  };
};

/**
 * What a link asks the opening camera for. A camera in it is what the map is
 * built with and wins; a selection is flown to, so framing everything first
 * would only be a camera move the visitor never asked for; with neither, the
 * map opens on what it draws (`lib/map-camera.ts`, `camera`).
 *
 * Read here rather than in the map, which used to reach for the hash itself
 * because it is built before the state is loaded: the camera intent is one
 * value, and the hash is this module's business.
 */
export const cameraIntent = (hash: HashState): CameraIntent => ({
  kind:
    hash.view.lat !== undefined || hash.view.zoom !== undefined
      ? "view"
      : hash.selection
        ? "selection"
        : "fit",
  view: { ...DEFAULT_VIEW, ...defined(hash.view) },
});

const writeHash = (
  filters: Filters,
  view: MapView,
  compare: readonly string[],
) => {
  // A hash-only `replaceState` keeps the path and never fetches anything;
  // Next's router reads it and stays in step.
  history.replaceState(null, "", `#${serializeHash(filters, view, compare)}`);
};

/** Whether two selections name the same entity, `null` included. */
const sameSelection = (a: Selection | null, b: Selection | null) =>
  a === b || (a !== null && b !== null && entityKey(a) === entityKey(b));

/**
 * The address bar as an adapter of the reducer: on the way in it becomes the
 * `load` action, on the way out the state becomes the path and the hash.
 *
 * Two halves since plan 02. The **selection is the path**: `/pass/x` is a
 * prerendered route with its own title and share image, so selecting
 * something is a `router.push` – the browser's back button closes the panel,
 * forward reopens it – and a path that changes under the app (that back
 * button) is dispatched as `select` or `back`. Everything else – the camera,
 * the half-month, the filters, the comparison – **stays in the hash**,
 * written with `replaceState` as before: a camera move is not a history
 * entry anybody wants to step back through. Both halves feed the one
 * reducer, and the rule that keeps them from fighting over the selection is
 * that each only acts where the other's half differs: the state pushes only
 * a path it is not already on, the path dispatches only a selection the
 * state does not already hold.
 *
 * The reading is a layout effect rather than the state's initialiser, and the
 * reason is hydration: there is no hash and no storage during the server
 * render, so the client's first render has to start from the same empty
 * inputs or React would find markup it did not expect. A layout effect runs
 * after that render has committed and re-renders synchronously before the
 * browser paints it, so the first paint the hydrated page makes already
 * carries the shared link's selection and the visitor's own half-month – the
 * static HTML shows today's until the script arrives, as a static page must,
 * but nothing flips *after* hydration and the rows are built once for the
 * resolved period. Storage is read here for the same action, because the
 * period's precedence (link, then the visitor's choice, then today) needs both
 * at once.
 *
 * The same listener applies a hash pasted into the address bar of an already
 * open page: a same-document navigation, which never remounts, and the hash
 * is authoritative then. Nothing is written back before `load` has run – the
 * first commit holds the defaults, and writing those would overwrite the
 * shared link with them.
 */
export const useHashAdapter = (
  state: AppState,
  dispatch: (action: Action) => void,
  /** The page's language: the prefix every pushed path carries. */
  lang: Lang,
): CameraIntent | null => {
  const router = useRouter();
  const pathname = usePathname();
  // The opening camera, and only that: a link pasted later reaches the map as
  // a `requestedView` or as a selection, both of which say what to do with the
  // camera that is already there.
  const [intent, setIntent] = useState<CameraIntent | null>(null);
  /**
   * How many entries this adapter pushed that are still ahead of the page it
   * opened on: closing the panel pops one of them rather than pushing a
   * third, so back and the close control leave the same history behind. A
   * session slot rather than a ref, so a reload on a pushed route keeps the
   * count. Every `popstate` – the visitor's own back or forward – takes one
   * off; a forward counted as a back only costs a push instead of a pop,
   * never a wrong page.
   */
  const [pushed, setPushed] = useStored("pushed");
  /** Whether the link the page opened on carried its selection in the hash. */
  const legacy = useRef(false);
  /** The path of the entry pushed last, for the popstate listener to compare against. */
  const lastPushed = useRef<string | null>(null);
  /** The path the state last agreed with, for the two effects that compare against it. */
  const seenPath = useRef<string | null>(null);
  useLayoutEffect(() => {
    const apply = () => {
      const hash = readHash();
      setIntent((first) => first ?? cameraIntent(hash));
      dispatch({ hash, stored: readStoredState(), type: "load" });
      // A link from before the routes: the selection it carries is applied
      // above; the effect below brings the address bar up to date, as a
      // replace rather than a push – the visitor arrived on this link, they
      // did not navigate to it.
      // Only the link the page opened on: a hash pasted later into an open
      // page is a navigation like any other and is pushed.
      legacy.current =
        seenPath.current === null &&
        hash.selection !== null &&
        !selectionOf(window.location.pathname);
    };
    apply();
    // Only a traversal away from the entry this adapter pushed last is one
    // of the counted entries popped; a hash-only step (a manual edit of the
    // hash, the browser restoring a different camera) leaves the count
    // alone. Compared against the pushed path rather than the current one:
    // React renders a popstate synchronously, so by the time this listener
    // runs the path effect below has already caught up.
    const onPop = () => {
      if (window.location.pathname === lastPushed.current) return;
      lastPushed.current = window.location.pathname;
      setPushed((n) => Math.max(0, n - 1));
    };
    window.addEventListener("hashchange", apply);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("hashchange", apply);
      window.removeEventListener("popstate", onPop);
    };
  }, [dispatch, setPushed]);

  const { compare, filters, loaded, selection, view } = state;
  const pathSelection = selectionOf(pathname);
  const pathKey = pathSelection && entityKey(pathSelection);
  const selectionKey = selection && entityKey(selection);
  // Not while a push is in flight: Next's router treats a `replaceState` from
  // outside as "the address bar changed under me" and restores its tree to
  // that URL – which is the old path, so the navigation would be thrown away
  // by the very first camera frame of the selection's flight. The path
  // arriving is in the dependencies, so the hash is written once it has.
  useEffect(() => {
    if (!loaded || !sameSelection(pathSelection, selection)) return;
    writeHash(filters, view, compare);
    // Intentional: the two keys stand for the selections they are made of.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [loaded, filters, view, compare, pathKey, selectionKey]);

  // The path changed under the app – the back button, a link – so the
  // selection follows it. Only a path that *changed* counts: on the first
  // sight after `load`, and on a link from before the routes, the state is
  // ahead of the path and it is the effect below that brings the path up;
  // dispatching `back` for that mismatch would close what the link opened.
  useEffect(() => {
    if (!loaded) return;
    const was = seenPath.current;
    seenPath.current = pathname;
    if (was === null || was === pathname) return;
    if (sameSelection(pathSelection, selection)) return;
    if (pathSelection) dispatch({ selection: pathSelection, type: "select" });
    else dispatch({ type: "back" });
    // Intentional: the path is the trigger. The selection is compared, not
    // followed – following it is the effect below.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [loaded, pathname, dispatch]);

  // The selection changed in the app – a row, a marker, the close control –
  // so the path follows it, with the hash carried along: a push without it
  // would drop the camera and the half-month. One navigation per change:
  // the effect re-runs when the count of pushed entries changes, and while
  // the push it just made is still on its way the path has not caught up
  // yet – without the guard that re-run pushed the same route again, and
  // again (the CI run of the review fixes hung on exactly that).
  const inFlight = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (sameSelection(selectionOf(window.location.pathname), selection)) {
      inFlight.current = null;
      return;
    }
    const target = selectionKey ?? "/";
    if (inFlight.current === target) return;
    inFlight.current = target;
    if (selection && legacy.current) {
      legacy.current = false;
      // oxlint-disable-next-line react-doctor/nextjs-no-client-side-redirect
      router.replace(
        hrefFor(selection, lang) + withoutLegacySelection(window.location.hash),
        { scroll: false },
      );
    } else if (selection) {
      lastPushed.current = hrefFor(selection, lang);
      setPushed((n) => n + 1);
      // oxlint-disable-next-line react-doctor/nextjs-no-client-side-redirect
      router.push(hrefFor(selection, lang) + window.location.hash, {
        scroll: false,
      });
    } else if (pushed > 0) {
      // Every entry this adapter pushed, in one step: `back()` after two
      // selections would land on the first one and reopen it.
      setPushed(0);
      window.history.go(-pushed);
    } else {
      // oxlint-disable-next-line react-doctor/nextjs-no-client-side-redirect
      router.push(homeHref(lang) + window.location.hash, { scroll: false });
    }
    // Intentional: the selection is the trigger; the path is read where it
    // is compared, in the same tick.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [loaded, selectionKey, router, pushed, setPushed, lang]);

  return intent;
};

/**
 * The same view in the other language: the selection's path under the other
 * prefix with the state's hash behind it, so the camera, the half-month and
 * the selection survive the switch (plan 08). A value of the state rather
 * than a read of the address bar, so the server and the client render the
 * same href.
 */
export const switchLangHref = (state: AppState, to: Lang): string =>
  `${state.selection ? hrefFor(state.selection, to) : homeHref(to)}#${serializeHash(state.filters, state.view, state.compare)}`;
