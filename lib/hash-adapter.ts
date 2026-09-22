"use client";
import { useEffect, useLayoutEffect, useState } from "react";

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
import type { CameraIntent } from "@/lib/map-camera";
import { readStoredState } from "@/lib/use-stored";

export const readHash = (): HashState =>
  typeof window === "undefined" ? EMPTY_HASH : parseHash(window.location.hash);

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
  selection: Selection | null,
  view: MapView,
) => {
  history.replaceState(null, "", `#${serializeHash(filters, selection, view)}`);
};

/**
 * The hash as an adapter of the reducer: on the way in it becomes the `load`
 * action, on the way out the state becomes the hash.
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
): CameraIntent | null => {
  // The opening camera, and only that: a link pasted later reaches the map as
  // a `requestedView` or as a selection, both of which say what to do with the
  // camera that is already there.
  const [intent, setIntent] = useState<CameraIntent | null>(null);
  useLayoutEffect(() => {
    const apply = () => {
      const hash = readHash();
      setIntent((first) => first ?? cameraIntent(hash));
      dispatch({ hash, stored: readStoredState(), type: "load" });
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [dispatch]);

  const { filters, loaded, selection, view } = state;
  useEffect(() => {
    if (loaded) writeHash(filters, selection, view);
  }, [loaded, filters, selection, view]);
  return intent;
};
