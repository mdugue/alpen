"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { ALL_KINDS, NO_SLUGS } from "@/lib/app-state";
import type { AppState, EntityKind, Shown, StoredState } from "@/lib/app-state";
import { isPeriod } from "@/lib/status";
import type { Period } from "@/lib/types";

/**
 * Web-storage hook with an SSR-safe initial value. The value is read via
 * useSyncExternalStore so that the first client render matches the server
 * HTML and no setState in an effect is needed.
 *
 * Two areas, because the two kinds of state have different lifetimes: what the
 * visitor decided about the app (favourites, period, which lists are open)
 * belongs in `localStorage` and outlives the tab; how they arranged one
 * sitting (which detail blocks they folded away) belongs in `sessionStorage`
 * and is forgotten with it.
 */
export type StorageArea = "local" | "session";

const listeners = new Set<() => void>();
/** Keyed by area *and* key: the two areas may hold the same name. */
const cache = new Map<string, { raw: string | null; value: unknown }>();

const storage = (where: StorageArea) =>
  where === "local" ? localStorage : sessionStorage;

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
};

const readStored = <T>(key: string, initial: T, where: StorageArea): T => {
  const id = `${where}:${key}`;
  let raw: string | null = null;
  try {
    raw = storage(where).getItem(key);
  } catch {
    // Blocked storage: still hand back one stable reference per key.
    const hit = cache.get(id);
    if (hit) return hit.value as T;
    cache.set(id, { raw: null, value: initial });
    return initial;
  }
  const hit = cache.get(id);
  // Keep referentially stable, otherwise useSyncExternalStore renders endlessly.
  if (hit && hit.raw === raw) return hit.value as T;
  let value = initial;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = initial;
    }
  }
  cache.set(id, { raw, value });
  return value;
};

/** Writes one key and tells every `useStored` of it; a blocked storage keeps the value for the tab. */
const writeStored = (key: string, value: unknown, where: StorageArea) => {
  const raw = JSON.stringify(value);
  try {
    storage(where).setItem(key, raw);
  } catch {
    /* Private mode or similar – then simply without persistence */
  }
  cache.set(`${where}:${key}`, { raw, value });
  for (const l of listeners) l();
};

export const useStored = <T>(
  key: string,
  initial: T,
  where: StorageArea = "local",
) => {
  const value = useSyncExternalStore(
    subscribe,
    () => readStored(key, initial, where),
    () => initial,
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      writeStored(
        key,
        typeof next === "function"
          ? (next as (prev: T) => T)(readStored(key, initial, where))
          : next,
        where,
      );
    },
    [key, initial, where],
  );

  return [value, setValue] as const;
};

export interface Favorites {
  pass: string[];
  tour: string[];
  town: string[];
}
export const NO_FAVORITES: Favorites = { pass: [], tour: [], town: [] };

export const useFavorites = () => {
  const [favorites, setFavorites] = useStored<Favorites>(
    "alpenpaesse:favorites",
    NO_FAVORITES,
  );
  const isFavorite = (kind: EntityKind, slug: string) =>
    favorites[kind].includes(slug);
  const toggle = (kind: EntityKind, slug: string) =>
    setFavorites((f) => ({
      ...f,
      [kind]: f[kind].includes(slug)
        ? f[kind].filter((s) => s !== slug)
        : [...f[kind], slug],
    }));
  const count =
    favorites.pass.length + favorites.tour.length + favorites.town.length;
  return {
    clear: () => setFavorites(NO_FAVORITES),
    count,
    favorites,
    isFavorite,
    toggle,
  };
};

/**
 * Which blocks of the detail panel the visitor folded away, by `Section` id.
 * Stored as the *closed* ones, so a block that did not exist yet opens by
 * itself, and in `sessionStorage`: folding the climate away applies to the
 * next pass looked at, not to the next visit a month later.
 */
export const SECTIONS_KEY = "alpenpaesse:closedSections";
/** Stable empty snapshot for `SECTIONS_KEY`, as `NO_SLUGS` is for the tours. */
export const NO_SECTIONS: string[] = [];

export const PERIOD_KEY = "alpenpaesse:period";

/**
 * The visitor's own last choice of half-month. It beats the server's "today",
 * and a shared link (hash `t`) beats both – opening someone else's link never
 * overwrites the preference, because only the period control writes here
 * (`ownPeriod` in `lib/app-state.ts`).
 */
export const readStoredPeriod = (): Period | null => {
  const value = readStored<Period | null>(PERIOD_KEY, null, "local");
  return isPeriod(value) ? value : null;
};

const SHOW_PASSES_KEY = "alpenpaesse:showPasses";
const SHOW_TOWNS_KEY = "alpenpaesse:showTowns";
const HIDDEN_TOURS_KEY = "alpenpaesse:hiddenTours";
/**
 * Which of the three lists is on screen. A preference like the sidebar's own
 * fold, so coming back lands where the last visit left off.
 */
const TAB_KEY = "alpenpaesse:tab";

const isKind = (v: unknown): v is EntityKind =>
  ALL_KINDS.includes(v as EntityKind);

/**
 * The persisted slices the reducer owns, read outside React for the `load`
 * action (`lib/hash-adapter.ts`). What is in storage is not trusted further
 * than its shape: a slug that no longer exists is dropped by `reconcileShown`,
 * a tab name this build does not know falls back to the passes.
 */
export const readStoredState = (): StoredState => {
  const tab = readStored<unknown>(TAB_KEY, "pass", "local");
  const hidden = readStored<unknown>(HIDDEN_TOURS_KEY, NO_SLUGS, "local");
  // The stored array itself when it is one, so a load that changes nothing
  // hands the reducer the reference it already holds.
  const hiddenTours =
    Array.isArray(hidden) && hidden.every((s) => typeof s === "string")
      ? hidden
      : NO_SLUGS;
  const shown: Shown = {
    hiddenTours,
    // Anything but an explicit `false` is on: a switch is never off by accident.
    passes: readStored<unknown>(SHOW_PASSES_KEY, true, "local") !== false,
    towns: readStored<unknown>(SHOW_TOWNS_KEY, true, "local") !== false,
  };
  return {
    period: readStoredPeriod(),
    shown,
    tab: isKind(tab) ? tab : "pass",
  };
};

/**
 * The storage adapter's subscription: the slices of the state that outlive
 * the tab are written whenever they change, under the keys `readStoredState`
 * reads them back from. Nothing is written before `load` has run – the first
 * commit holds the defaults, and writing those would overwrite what the last
 * visit left behind before it has been read.
 *
 * `ownPeriod` rather than `filters.period`: a half-month applied from a shared
 * link is not the visitor's choice and must not become it.
 */
export const useStorageAdapter = (state: AppState) => {
  const { loaded, ownPeriod, shown, tab } = state;
  const { hiddenTours, passes, towns } = shown;
  useEffect(() => {
    if (loaded) writeStored(SHOW_PASSES_KEY, passes, "local");
  }, [loaded, passes]);
  useEffect(() => {
    if (loaded) writeStored(SHOW_TOWNS_KEY, towns, "local");
  }, [loaded, towns]);
  useEffect(() => {
    if (loaded) writeStored(HIDDEN_TOURS_KEY, hiddenTours, "local");
  }, [loaded, hiddenTours]);
  useEffect(() => {
    if (loaded) writeStored(TAB_KEY, tab, "local");
  }, [loaded, tab]);
  useEffect(() => {
    if (loaded && ownPeriod !== null)
      writeStored(PERIOD_KEY, ownPeriod, "local");
  }, [loaded, ownPeriod]);
};
