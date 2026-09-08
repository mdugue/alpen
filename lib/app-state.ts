"use client";
import { useCallback, useSyncExternalStore } from "react";
import { isPeriod } from "@/lib/status";
import type { Period, Status } from "@/lib/types";

export type EntityKind = "pass" | "tour" | "town";
export interface Selection {
  kind: EntityKind;
  slug: string;
}

export const ALL_STATUS: Status[] = ["open", "risky", "closed"];
export const ALL_KINDS: EntityKind[] = ["pass", "tour", "town"];
/** Stable initial values for array-valued stored keys (useSyncExternalStore needs stable snapshots). */
export const NO_SLUGS: string[] = [];

export interface Filters {
  period: Period;
  /** Statuses that stay visible; all three = no filter. Applies to passes and tours. */
  status: Status[];
  /** Passes only. */
  minFame: number;
  /** Passes only. */
  minElevation: number;
  query: string;
  favoritesOnly: boolean;
}

/**
 * The period here is only a placeholder: the page is handed today's half-month
 * by the server and the visitor's own choice wins over both (see `Explorer`).
 */
export const DEFAULT_FILTERS: Filters = {
  period: 10,
  status: ALL_STATUS,
  minFame: 1,
  minElevation: 0,
  query: "",
  favoritesOnly: false,
};

/** True when any filter apart from the period is active. */
export const hasActiveFilters = (f: Filters) =>
  f.status.length !== ALL_STATUS.length ||
  f.minFame > 1 ||
  f.minElevation > 0 ||
  f.query.trim() !== "" ||
  f.favoritesOnly;

export interface MapView {
  lat: number;
  lon: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export const DEFAULT_VIEW: MapView = { lat: 46.3, lon: 9.6, zoom: 6.5, pitch: 0, bearing: 0 };

/** Drops keys that are undefined (or NaN) so a spread does not overwrite defaults. */
export const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && !(typeof v === "number" && Number.isNaN(v))),
  ) as Partial<T>;

export interface HashState {
  filters: Partial<Filters>;
  selection: Selection | null;
  view: Partial<MapView>;
}

/**
 * View state lives in the URL hash (shareable), bookmarks and map settings in
 * localStorage (private, per device). `parseHash` is the pure half of
 * `readHash`, so the parsing can be tested without a window.
 */
export function parseHash(hash: string): HashState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const num = (k: string) => {
    if (!p.has(k)) return undefined;
    const v = Number(p.get(k));
    return Number.isFinite(v) ? v : undefined;
  };
  const selection: Selection | null = p.get("pass")
    ? { kind: "pass", slug: p.get("pass")! }
    : p.get("tour")
      ? { kind: "tour", slug: p.get("tour")! }
      : p.get("town")
        ? { kind: "town", slug: p.get("town")! }
        : null;
  const c = p.get("c")?.split(",").map(Number);
  const period = num("t");
  return {
    filters: {
      period: isPeriod(period) ? period : undefined,
      status: parseStatus(p.get("s")),
      minFame: num("f"),
      minElevation: num("m"),
      query: p.get("q") ?? undefined,
    },
    selection,
    view: {
      lat: c?.[0],
      lon: c?.[1],
      zoom: num("z"),
      pitch: num("pi"),
      bearing: num("b"),
    },
  };
}

export function readHash(): HashState {
  if (typeof window === "undefined") return { filters: {}, selection: null, view: {} };
  return parseHash(window.location.hash);
}

/** `s=open,risky`; the legacy values `open` and `openRisky` from older links still work. */
function parseStatus(raw: string | null): Status[] | undefined {
  if (!raw || raw === "all") return undefined;
  if (raw === "none") return [];
  if (raw === "openRisky") return ["open", "risky"];
  const list = raw.split(",").filter((s): s is Status => ALL_STATUS.includes(s as Status));
  return list.length ? list : undefined;
}

/** Pure half of `writeHash`: the hash body without the leading "#". */
export function serializeHash(filters: Filters, selection: Selection | null, view: MapView): string {
  const p = new URLSearchParams();
  p.set("t", String(filters.period));
  p.set("z", view.zoom.toFixed(2));
  p.set("c", `${view.lat.toFixed(4)},${view.lon.toFixed(4)}`);
  if (view.pitch > 1) {
    p.set("pi", view.pitch.toFixed(0));
    p.set("b", view.bearing.toFixed(0));
  }
  if (filters.status.length !== ALL_STATUS.length) p.set("s", filters.status.join(",") || "none");
  if (filters.minFame > 1) p.set("f", String(filters.minFame));
  if (filters.minElevation > 0) p.set("m", String(filters.minElevation));
  if (filters.query) p.set("q", filters.query);
  if (selection) p.set(selection.kind, selection.slug);
  return String(p);
}

export function writeHash(filters: Filters, selection: Selection | null, view: MapView) {
  history.replaceState(null, "", `#${serializeHash(filters, selection, view)}`);
}

/**
 * localStorage hook with an SSR-safe initial value. The value is read via
 * useSyncExternalStore so that the first client render matches the server
 * HTML and no setState in an effect is needed.
 */
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStored<T>(key: string, initial: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    // Blocked storage: still hand back one stable reference per key.
    const hit = cache.get(key);
    if (hit) return hit.value as T;
    cache.set(key, { raw: null, value: initial });
    return initial;
  }
  const hit = cache.get(key);
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
  cache.set(key, { raw, value });
  return value;
}

export function useStored<T>(key: string, initial: T) {
  const value = useSyncExternalStore(
    subscribe,
    () => readStored(key, initial),
    () => initial,
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(readStored(key, initial)) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        /* Private mode or similar – then simply without persistence */
      }
      cache.set(key, { raw: JSON.stringify(resolved), value: resolved });
      for (const l of listeners) l();
    },
    [key, initial],
  );

  return [value, setValue] as const;
}

export interface Favorites {
  pass: string[];
  tour: string[];
  town: string[];
}
export const NO_FAVORITES: Favorites = { pass: [], tour: [], town: [] };

export function useFavorites() {
  const [favorites, setFavorites] = useStored<Favorites>("alpenpaesse:favorites", NO_FAVORITES);
  const isFavorite = (kind: EntityKind, slug: string) => favorites[kind].includes(slug);
  const toggle = (kind: EntityKind, slug: string) =>
    setFavorites((f) => ({
      ...f,
      [kind]: f[kind].includes(slug) ? f[kind].filter((s) => s !== slug) : [...f[kind], slug],
    }));
  const count = favorites.pass.length + favorites.tour.length + favorites.town.length;
  return { favorites, isFavorite, toggle, clear: () => setFavorites(NO_FAVORITES), count };
}

export const PERIOD_KEY = "alpenpaesse:period";

/**
 * The visitor's own last choice of half-month. It beats the server's "today",
 * and a shared link (hash `t`) beats both – opening someone else's link never
 * overwrites the preference, because only the period control writes here.
 */
export function useStoredPeriod() {
  return useStored<Period | null>(PERIOD_KEY, null);
}

/**
 * Precedence for the half-month the app opens on: a shared link wins over the
 * visitor's own last choice, which wins over today's half-month from the
 * server (see docs/data-model.md, "Time reckoning").
 */
export const resolvePeriod = (fromHash: Period | undefined, stored: Period | null, today: Period): Period =>
  fromHash ?? stored ?? today;

/** The stored period outside React, for the one-shot hash initialisation. */
export function readStoredPeriod(): Period | null {
  const value = readStored<Period | null>(PERIOD_KEY, null);
  return isPeriod(value) ? value : null;
}

export const statusMatches = (status: Status, filter: Status[]) => filter.includes(status);
