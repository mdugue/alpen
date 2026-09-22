"use client";
import { useEffect, useSyncExternalStore } from "react";

import { ALL_KINDS } from "@/lib/app-state";
import type { AppState, EntityKind, StoredState } from "@/lib/app-state";
import { BASEMAP_ID } from "@/lib/basemap";
import { isPeriod } from "@/lib/status";
import type { Period } from "@/lib/types";

/**
 * Web storage with an SSR-safe initial value. Every value is read through
 * `useSyncExternalStore`, so the first client render matches the server HTML
 * and no `setState` in an effect is needed.
 *
 * Two areas, because the two kinds of state have different lifetimes: what the
 * visitor decided about the app (favourites, period, which lists are open)
 * belongs in `localStorage` and outlives the tab; how they arranged one
 * sitting (which detail blocks they folded away) belongs in `sessionStorage`
 * and is forgotten with it.
 */
type StorageArea = "local" | "session";

interface Slot<T> {
  area: StorageArea;
  /** What the key is worth before anybody has stored anything under it. */
  value: T;
}
const slot = <T>(area: StorageArea, value: T): Slot<T> => ({ area, value });

interface Favorites {
  pass: string[];
  tour: string[];
  town: string[];
}
const NO_FAVORITES: Favorites = { pass: [], tour: [], town: [] };

/**
 * Every `alpenpaesse:*` key there is, with its area and its default – the one
 * place a storage key is spelled. `useStored` takes a key of this table and
 * nothing else, which is what keeps a default a module constant: a caller that
 * handed in a fresh array each render only worked because of the cache below,
 * and `useSyncExternalStore` needs a snapshot that keeps its identity.
 */
const STORAGE = {
  /** Which basemap the map draws. */
  "alpenpaesse:base": slot<string>("local", BASEMAP_ID),
  /** Which blocks of the detail panel are folded away, by `Section` id. */
  "alpenpaesse:closedSections": slot<string[]>("session", []),
  "alpenpaesse:favorites": slot<Favorites>("local", NO_FAVORITES),
  /** The tours kept off the map; stored as the hidden ones (`Shown`). */
  "alpenpaesse:hiddenTours": slot<string[]>("local", []),
  /** Which of the basemap's overlays are on. */
  "alpenpaesse:overlays": slot<string[]>("local", ["hillshade"]),
  /**
   * The visitor's own last choice of half-month. It beats the server's
   * "today", and a shared link (hash `t`) beats both – opening someone else's
   * link never overwrites the preference, because only the period control
   * writes here (`ownPeriod` in `lib/app-state.ts`).
   */
  "alpenpaesse:period": slot<Period | null>("local", null),
  "alpenpaesse:showPasses": slot<boolean>("local", true),
  "alpenpaesse:showTowns": slot<boolean>("local", true),
  /** Whether the desktop sidebar is unfolded. */
  "alpenpaesse:sidebar": slot<boolean>("local", true),
  /**
   * Which of the three lists is on screen. A preference like the sidebar's own
   * fold, so coming back lands where the last visit left off.
   */
  "alpenpaesse:tab": slot<EntityKind>("local", "pass"),
};

type StorageKey = keyof typeof STORAGE;
type Value<K extends StorageKey> = (typeof STORAGE)[K]["value"];

const listeners = new Set<() => void>();
/** One cached snapshot per key, so a re-read hands back the same reference. */
const cache = new Map<StorageKey, { raw: string | null; value: unknown }>();

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

const readStored = <K extends StorageKey>(key: K): Value<K> => {
  const { area, value: initial } = STORAGE[key];
  let raw: string | null = null;
  try {
    raw = storage(area).getItem(key);
  } catch {
    // Blocked storage: still hand back one stable reference per key.
    const blocked = cache.get(key);
    if (blocked) return blocked.value as Value<K>;
    cache.set(key, { raw: null, value: initial });
    return initial;
  }
  const hit = cache.get(key);
  // Keep referentially stable, otherwise useSyncExternalStore renders endlessly.
  if (hit && hit.raw === raw) return hit.value as Value<K>;
  let value: unknown = initial;
  if (raw !== null) {
    try {
      value = JSON.parse(raw);
    } catch {
      value = initial;
    }
  }
  cache.set(key, { raw, value });
  return value as Value<K>;
};

/**
 * Writes one key and tells every reader of it. A value that is already stored
 * under the key is not written again: the adapter below offers every persisted
 * slice on every commit, and a write would wake every `useStored` in the tree
 * for nothing. A blocked storage keeps the value for the tab.
 */
const writeStored = <K extends StorageKey>(key: K, value: Value<K>) => {
  const raw = JSON.stringify(value);
  if (cache.get(key)?.raw === raw) return;
  try {
    storage(STORAGE[key].area).setItem(key, raw);
  } catch {
    /* Private mode or similar – then simply without persistence */
  }
  cache.set(key, { raw, value });
  for (const l of listeners) l();
};

export const useStored = <K extends StorageKey>(key: K) => {
  const value = useSyncExternalStore<Value<K>>(
    subscribe,
    () => readStored(key),
    () => STORAGE[key].value,
  );
  const setValue = (update: Value<K> | ((prev: Value<K>) => Value<K>)) => {
    writeStored(
      key,
      typeof update === "function" ? update(readStored(key)) : update,
    );
  };
  return [value, setValue] as const;
};

export const useFavorites = () => {
  const [favorites, setFavorites] = useStored("alpenpaesse:favorites");
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

const isKind = (v: unknown): v is EntityKind =>
  ALL_KINDS.includes(v as EntityKind);

/**
 * The persisted slices the reducer owns, read outside React for the `load`
 * action (`lib/hash-adapter.ts`). What is in storage is not trusted further
 * than its shape: a slug that no longer exists is dropped by `reconcileShown`,
 * a tab name this build does not know falls back to the passes, and a
 * half-month that is not one of the 24 is no preference at all.
 */
export const readStoredState = (): StoredState => {
  const tab: unknown = readStored("alpenpaesse:tab");
  const hidden: unknown = readStored("alpenpaesse:hiddenTours");
  const period: unknown = readStored("alpenpaesse:period");
  const passes: unknown = readStored("alpenpaesse:showPasses");
  const towns: unknown = readStored("alpenpaesse:showTowns");
  return {
    period: isPeriod(period) ? period : null,
    shown: {
      // The stored array itself when it is one, so a load that changes nothing
      // hands the reducer the reference it already holds.
      hiddenTours:
        Array.isArray(hidden) && hidden.every((s) => typeof s === "string")
          ? hidden
          : STORAGE["alpenpaesse:hiddenTours"].value,
      // Anything but an explicit `false` is on: a switch is never off by accident.
      passes: passes !== false,
      towns: towns !== false,
    },
    tab: isKind(tab) ? tab : "pass",
  };
};

/**
 * One persisted slice of the state: which key it is written under and what
 * the state says about it. `undefined` means "nothing to say yet", which is
 * what keeps a shared link's half-month out of the preference.
 */
interface Slice {
  write: (state: AppState) => void;
}
const slice = <K extends StorageKey>(
  key: K,
  from: (state: AppState) => Value<K> | undefined,
): Slice => ({
  write: (state) => {
    const value = from(state);
    if (value !== undefined) writeStored(key, value);
  },
});

/**
 * Everything the reducer owns that outlives the tab, one row per key, under
 * the keys `readStoredState` reads back. Adding a persisted slice is a row
 * here and a row in `STORAGE`.
 */
const PERSISTED: Slice[] = [
  slice("alpenpaesse:showPasses", (s) => s.shown.passes),
  slice("alpenpaesse:showTowns", (s) => s.shown.towns),
  slice("alpenpaesse:hiddenTours", (s) => s.shown.hiddenTours),
  slice("alpenpaesse:tab", (s) => s.tab),
  // `ownPeriod` rather than `filters.period`: a half-month applied from a
  // shared link is not the visitor's choice and must not become it.
  slice("alpenpaesse:period", (s) => s.ownPeriod ?? undefined),
];

/**
 * The storage adapter's subscription: every row of `PERSISTED` is offered the
 * state after each commit, and `writeStored` keeps the ones that did not
 * change. Nothing is written before `load` has run – the first commit holds
 * the defaults, and writing those would overwrite what the last visit left
 * behind before it has been read.
 */
export const useStorageAdapter = (state: AppState) => {
  useEffect(() => {
    if (!state.loaded) return;
    for (const persisted of PERSISTED) persisted.write(state);
  }, [state]);
};
