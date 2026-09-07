"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Period, Status } from "@/lib/types";

export type EntityKind = "pass" | "tour" | "town";
export interface Selection {
  kind: EntityKind;
  slug: string;
}

export interface Filters {
  period: Period;
  kinds: EntityKind[];
  status: "all" | "open" | "openRisky";
  minFame: number;
  minElevation: number;
  query: string;
  favoritesOnly: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  period: 10, // Anfang Oktober
  kinds: ["pass", "tour", "town"],
  status: "all",
  minFame: 1,
  minElevation: 0,
  query: "",
  favoritesOnly: false,
};

export interface MapView {
  lat: number;
  lon: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export const DEFAULT_VIEW: MapView = { lat: 46.3, lon: 9.6, zoom: 6.5, pitch: 0, bearing: 0 };

/**
 * Ansichtszustand steht im URL-Hash (teilbar), Merkungen und
 * Karteneinstellungen im localStorage (privat, gerätespezifisch).
 */
export function readHash(): { filters: Partial<Filters>; selection: Selection | null; view: Partial<MapView> } {
  if (typeof window === "undefined") return { filters: {}, selection: null, view: {} };
  const p = new URLSearchParams(window.location.hash.slice(1));
  const num = (k: string) => (p.has(k) ? Number(p.get(k)) : undefined);
  const selection: Selection | null = p.get("pass")
    ? { kind: "pass", slug: p.get("pass")! }
    : p.get("tour")
      ? { kind: "tour", slug: p.get("tour")! }
      : p.get("town")
        ? { kind: "town", slug: p.get("town")! }
        : null;
  const c = p.get("c")?.split(",").map(Number);
  return {
    filters: {
      period: num("t"),
      status: (p.get("s") as Filters["status"]) ?? undefined,
      minFame: num("f"),
      minElevation: num("m"),
      query: p.get("q") ?? undefined,
      kinds: p.get("k")?.split(",") as EntityKind[] | undefined,
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

export function writeHash(filters: Filters, selection: Selection | null, view: MapView) {
  const p = new URLSearchParams();
  p.set("t", String(filters.period));
  p.set("z", view.zoom.toFixed(2));
  p.set("c", `${view.lat.toFixed(4)},${view.lon.toFixed(4)}`);
  if (view.pitch > 1) {
    p.set("pi", view.pitch.toFixed(0));
    p.set("b", view.bearing.toFixed(0));
  }
  if (filters.status !== "all") p.set("s", filters.status);
  if (filters.minFame > 1) p.set("f", String(filters.minFame));
  if (filters.minElevation > 0) p.set("m", String(filters.minElevation));
  if (filters.query) p.set("q", filters.query);
  if (filters.kinds.length !== 3) p.set("k", filters.kinds.join(","));
  if (selection) p.set(selection.kind, selection.slug);
  history.replaceState(null, "", `#${p}`);
}

/**
 * localStorage-Hook mit SSR-sicherem Startwert. Der Wert wird über
 * useSyncExternalStore gelesen, damit der erste Client-Render dem Server-HTML
 * entspricht und kein setState im Effekt nötig ist.
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
    return initial;
  }
  const hit = cache.get(key);
  // Referenzstabil halten, sonst rendert useSyncExternalStore endlos.
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
        /* Privatmodus o. Ä. – dann eben ohne Persistenz */
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
  const isFavorite = useCallback(
    (kind: EntityKind, slug: string) => favorites[kind].includes(slug),
    [favorites],
  );
  const toggle = useCallback(
    (kind: EntityKind, slug: string) =>
      setFavorites((f) => ({
        ...f,
        [kind]: f[kind].includes(slug) ? f[kind].filter((s) => s !== slug) : [...f[kind], slug],
      })),
    [setFavorites],
  );
  const count = useMemo(
    () => favorites.pass.length + favorites.tour.length + favorites.town.length,
    [favorites],
  );
  return { favorites, isFavorite, toggle, clear: () => setFavorites(NO_FAVORITES), count };
}

export const statusMatches = (status: Status, filter: Filters["status"]) =>
  filter === "all" ||
  (filter === "open" && status === "open") ||
  (filter === "openRisky" && status !== "closed");
