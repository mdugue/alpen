"use client";
import {
  createLoader,
  createParser,
  createSerializer,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";
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

export const PASS_SORTS = [
  "elevation",
  "name",
  "status",
  "beauty",
  "fame",
  "difficulty",
  "traffic",
] as const;
export type PassSort = (typeof PASS_SORTS)[number];

/** Editorial 1–5 scale bounds; the difficulty filter is a window inside them. */
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/**
 * The thresholds the selects offer, hash value → label. The hash parsers
 * accept exactly these, so a link never applies a filter the control cannot
 * show.
 */
export const TRAFFIC_OPTIONS = [
  [5, "egal"],
  [3, "höchstens 3"],
  [2, "höchstens 2"],
  [1, "nur ruhige"],
] as const;
export const BEAUTY_OPTIONS = [
  [1, "alle"],
  [3, "ab 3 von 5"],
  [4, "ab 4 von 5"],
  [5, "nur 5 von 5"],
] as const;
export const FAME_OPTIONS = [
  [1, "alle"],
  [3, "ab 3 von 5"],
  [4, "nur Klassiker"],
] as const;

export interface Filters {
  period: Period;
  /** Statuses that stay visible; all three = no filter. Passes and tours. */
  status: Status[];
  /**
   * The pass criteria below apply to passes and, through their passes, to
   * tours: a tour needs one pass that clears the lower bounds (elevation,
   * fame, beauty, min. difficulty) and every pass has to respect the upper
   * bounds (max. difficulty, traffic). Towns see only search and favourites.
   */
  minFame: number;
  minElevation: number;
  /** Inclusive window on the 1–5 scale; [1, 5] = no filter. */
  difficulty: [min: number, max: number];
  /** 5 = no filter. */
  maxTraffic: number;
  /** 1 = no filter. */
  minBeauty: number;
  sort: PassSort;
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
  difficulty: [RATING_MIN, RATING_MAX],
  maxTraffic: RATING_MAX,
  minBeauty: RATING_MIN,
  sort: "elevation",
  query: "",
  favoritesOnly: false,
};

/** How many of the pass criteria are active – the badge on the filter trigger. */
export const countCriteria = (f: Filters) =>
  (f.minFame > 1 ? 1 : 0) +
  (f.minElevation > 0 ? 1 : 0) +
  (f.difficulty[0] > RATING_MIN || f.difficulty[1] < RATING_MAX ? 1 : 0) +
  (f.maxTraffic < RATING_MAX ? 1 : 0) +
  (f.minBeauty > RATING_MIN ? 1 : 0);

/** True when any filter apart from the period and the sort is active. */
export const hasActiveFilters = (f: Filters) =>
  f.status.length !== ALL_STATUS.length ||
  countCriteria(f) > 0 ||
  f.query.trim() !== "" ||
  f.favoritesOnly;

export interface MapView {
  lat: number;
  lon: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export const DEFAULT_VIEW: MapView = {
  lat: 46.3,
  lon: 9.6,
  zoom: 6.5,
  pitch: 0,
  bearing: 0,
};

/** Drops keys that are undefined (or NaN) so a spread does not overwrite defaults. */
export const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(o).filter(
      ([, v]) => v !== undefined && !(typeof v === "number" && Number.isNaN(v)),
    ),
  ) as Partial<T>;

export interface HashState {
  filters: Partial<Filters>;
  selection: Selection | null;
  view: Partial<MapView>;
}

// ── The URL hash ─────────────────────────────────────────────────────────────
//
// View state lives in the URL hash (shareable), bookmarks and map settings in
// localStorage (private, per device). The page stays static, so the state
// goes into the hash rather than the query string; nuqs only lends its
// parsers here, no router adapter is involved.
//
//   t     half-month, 1 … 12.5             z     zoom
//   c     centre "lat,lon"                 pi,b  pitch and bearing (only when tilted)
//   s     statuses "open,risky" | "none"   q     search text
//   f     min. fame                        m     min. elevation in m
//   d     difficulty window "2-4"          v     max. traffic
//   be    min. beauty                      o     pass sort key
//   pass | tour | town   the selected entity's slug
//
// Every key is validated on the way in: unknown values fall back to the
// default rather than reaching the state.

const parseAsPeriod = createParser<Period>({
  parse: (v) => {
    const n = Number(v);
    return isPeriod(n) ? n : null;
  },
  serialize: String,
});
const parseAsFixed = (digits: number) =>
  createParser<number>({
    parse: (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    },
    serialize: (n) => n.toFixed(digits),
  });
/** Both halves have to be numbers; half a pair is no camera at all. */
const parseAsCenter = createParser<[lat: number, lon: number]>({
  parse: (v) => {
    const pair = v.split(",").map(Number);
    return pair.length === 2 && pair.every((n) => Number.isFinite(n))
      ? (pair as [number, number])
      : null;
  },
  serialize: ([lat, lon]) => `${lat.toFixed(4)},${lon.toFixed(4)}`,
});
/** `s=open,risky`; the legacy values `open` and `openRisky` from older links still work. */
const parseAsStatus = createParser<Status[]>({
  parse: (raw) => {
    if (raw === "all") return null;
    if (raw === "none") return [];
    if (raw === "openRisky") return ["open", "risky"];
    const list = ALL_STATUS.filter((s) => raw.split(",").includes(s));
    return list.length ? list : null;
  },
  serialize: (list) => list.join(",") || "none",
  eq: (a, b) => a.length === b.length && a.every((s) => b.includes(s)),
});
const RATINGS = [1, 2, 3, 4, 5] as const;
/** Exactly one of the given values; anything else is not a filter. */
const parseAsOneOf = (values: readonly number[]) =>
  createParser<number>({
    parse: (v) => (values.includes(Number(v)) ? Number(v) : null),
    serialize: String,
  });
/** A whole number of metres; "2000oops" is not one (parseAsInteger would take the prefix). */
const parseAsMetres = createParser<number>({
  parse: (v) => (/^\d{1,4}$/u.test(v) ? Number(v) : null),
  serialize: String,
});
/** `d=2-4`; `d=3` means exactly 3. */
const parseAsRange = createParser<[number, number]>({
  parse: (raw) => {
    const [lo, hi = lo] = raw.split("-").map(Number);
    if (!RATINGS.includes(lo as never) || !RATINGS.includes(hi as never))
      return null;
    return lo! <= hi! ? [lo!, hi!] : [hi!, lo!];
  },
  serialize: ([lo, hi]) => (lo === hi ? String(lo) : `${lo}-${hi}`),
  eq: (a, b) => a[0] === b[0] && a[1] === b[1],
});

/** Reading: a missing or invalid value is `null`, which `parseHash` turns into "not given". */
const HASH = {
  t: parseAsPeriod,
  z: parseAsFixed(2),
  c: parseAsCenter,
  pi: parseAsFixed(0),
  b: parseAsFixed(0),
  s: parseAsStatus,
  f: parseAsOneOf(FAME_OPTIONS.map(([v]) => v)),
  m: parseAsMetres,
  d: parseAsRange,
  v: parseAsOneOf(TRAFFIC_OPTIONS.map(([v]) => v)),
  be: parseAsOneOf(BEAUTY_OPTIONS.map(([v]) => v)),
  o: parseAsStringLiteral(PASS_SORTS),
  q: parseAsString,
  pass: parseAsString,
  tour: parseAsString,
  town: parseAsString,
};
/** Writing: a value equal to its default leaves the hash. */
const HASH_OUT = {
  ...HASH,
  s: HASH.s.withDefault(DEFAULT_FILTERS.status),
  f: HASH.f.withDefault(DEFAULT_FILTERS.minFame),
  m: HASH.m.withDefault(DEFAULT_FILTERS.minElevation),
  d: HASH.d.withDefault(DEFAULT_FILTERS.difficulty),
  v: HASH.v.withDefault(DEFAULT_FILTERS.maxTraffic),
  be: HASH.be.withDefault(DEFAULT_FILTERS.minBeauty),
  o: HASH.o.withDefault(DEFAULT_FILTERS.sort),
  q: HASH.q.withDefault(DEFAULT_FILTERS.query),
};
const loadHash = createLoader(HASH);
const serialize = createSerializer(HASH_OUT, { clearOnDefault: true });

/** `parseHash` is the pure half of `readHash`, so the parsing can be tested without a window. */
export function parseHash(hash: string): HashState {
  const h = loadHash(new URLSearchParams(hash.replace(/^#/u, "")));
  const given = <K extends keyof typeof HASH>(key: K) => h[key] ?? undefined;
  const selection: Selection | null = h.pass
    ? { kind: "pass", slug: h.pass }
    : h.tour
      ? { kind: "tour", slug: h.tour }
      : h.town
        ? { kind: "town", slug: h.town }
        : null;
  return {
    filters: {
      period: given("t"),
      status: given("s"),
      minFame: given("f"),
      minElevation: given("m"),
      difficulty: given("d"),
      maxTraffic: given("v"),
      minBeauty: given("be"),
      sort: given("o"),
      query: given("q"),
    },
    selection,
    view: {
      lat: h.c?.[0],
      lon: h.c?.[1],
      zoom: given("z"),
      pitch: given("pi"),
      bearing: given("b"),
    },
  };
}

export function readHash(): HashState {
  if (typeof window === "undefined")
    return { filters: {}, selection: null, view: {} };
  return parseHash(window.location.hash);
}

/** Pure half of `writeHash`: the hash body without the leading "#". */
export function serializeHash(
  filters: Filters,
  selection: Selection | null,
  view: MapView,
): string {
  const tilted = view.pitch > 1;
  return serialize({
    t: filters.period,
    z: view.zoom,
    c: [view.lat, view.lon],
    pi: tilted ? view.pitch : null,
    b: tilted ? view.bearing : null,
    s: filters.status,
    f: filters.minFame,
    m: filters.minElevation,
    d: filters.difficulty,
    v: filters.maxTraffic,
    be: filters.minBeauty,
    o: filters.sort,
    q: filters.query,
    pass: selection?.kind === "pass" ? selection.slug : null,
    tour: selection?.kind === "tour" ? selection.slug : null,
    town: selection?.kind === "town" ? selection.slug : null,
  }).replace(/^\?/u, "");
}

export function writeHash(
  filters: Filters,
  selection: Selection | null,
  view: MapView,
) {
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
        typeof next === "function"
          ? (next as (prev: T) => T)(readStored(key, initial))
          : next;
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
    favorites,
    isFavorite,
    toggle,
    clear: () => setFavorites(NO_FAVORITES),
    count,
  };
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
export const resolvePeriod = (
  fromHash: Period | undefined,
  stored: Period | null,
  today: Period,
): Period => fromHash ?? stored ?? today;

/** The stored period outside React, for the one-shot hash initialisation. */
export function readStoredPeriod(): Period | null {
  const value = readStored<Period | null>(PERIOD_KEY, null);
  return isPeriod(value) ? value : null;
}

export const statusMatches = (status: Status, filter: Status[]) =>
  filter.includes(status);
