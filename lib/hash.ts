import {
  createLoader,
  createParser,
  createSerializer,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";

import {
  ALL_STATUS,
  BEAUTY_OPTIONS,
  DEFAULT_FILTERS,
  ELEVATION_OPTIONS,
  FAME_OPTIONS,
  HEAT_OPTIONS,
  PASS_SORTS,
  TRAFFIC_OPTIONS,
  WET_OPTIONS,
} from "@/lib/app-state";
import type { Filters, HashState, MapView, Selection } from "@/lib/app-state";
import { ROAD_TAGS, ROAD_TYPES } from "@/lib/regions";
import { isPeriod } from "@/lib/status";
import type { Period, Status } from "@/lib/types";

// ── The URL hash ─────────────────────────────────────────────────────────────
//
// View state lives in the URL hash (shareable), bookmarks and map settings in
// localStorage (private, per device). The page stays static, so the state
// goes into the hash rather than the query string; nuqs only lends its
// parsers here, no router adapter is involved.
//
//   t     half-month, 1 … 12.5             z     zoom
//   c     centre "lat,lon"                 pi,b  pitch and bearing (only when tilted)
//   s     statuses "open,risky"        q     search text
//   f     min. fame                        m     min. elevation in m
//   d     difficulty window "2-4"          v     max. traffic
//   be    min. beauty                      o     pass sort key
//   h     max. valley heat in °C           w     max. rain days of 15
//   a     road types "pass,spur"           e     road labels "toll,carfree"
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
/**
 * `s=open,risky`; the legacy values `open` and `openRisky` from older links
 * still work. `none` used to mean "hide everything" – no control produces that
 * any more (`toggleMember`), so an old link with it opens unfiltered.
 */
const parseAsStatus = createParser<Status[]>({
  eq: (a, b) => a.length === b.length && a.every((s) => b.includes(s)),
  parse: (raw) => {
    if (raw === "openRisky") return ["open", "risky"];
    const list = ALL_STATUS.filter((s) => raw.split(",").includes(s));
    return list.length ? list : null;
  },
  serialize: (list) => list.join(","),
});
/**
 * A comma-joined subset of a fixed vocabulary, in vocabulary order – `a=pass,spur`,
 * `e=toll,carfree`. Unknown members are dropped rather than rejected, so an
 * old link keeps the part of its filter this build still understands; a value
 * that leaves nothing behind is no filter at all and falls back to the
 * default – `none` included, see `parseAsStatus`.
 */
const parseAsSubset = <T extends string>(vocabulary: readonly T[]) =>
  createParser<T[]>({
    eq: (a, b) => a.length === b.length && a.every((x) => b.includes(x)),
    parse: (raw) => {
      const picked = raw.split(",");
      const list = vocabulary.filter((v) => picked.includes(v));
      return list.length ? list : null;
    },
    serialize: (list) => list.join(","),
  });

const RATINGS = [1, 2, 3, 4, 5] as const;
/** Exactly one of the given values; anything else is not a filter. */
const parseAsOneOf = (values: readonly number[]) =>
  createParser<number>({
    parse: (v) => (values.includes(Number(v)) ? Number(v) : null),
    serialize: String,
  });
/** `d=2-4`; `d=3` means exactly 3. */
const parseAsRange = createParser<[number, number]>({
  eq: (a, b) => a[0] === b[0] && a[1] === b[1],
  parse: (raw) => {
    const [lo, hi = lo] = raw.split("-").map(Number);
    if (!RATINGS.includes(lo as never) || !RATINGS.includes(hi as never))
      return null;
    return lo! <= hi! ? [lo!, hi!] : [hi!, lo!];
  },
  serialize: ([lo, hi]) => (lo === hi ? String(lo) : `${lo}-${hi}`),
});

/** Reading: a missing or invalid value is `null`, which `parseHash` turns into "not given". */
const HASH = {
  a: parseAsSubset(ROAD_TYPES),
  b: parseAsFixed(0),
  be: parseAsOneOf(BEAUTY_OPTIONS.map(([v]) => v)),
  c: parseAsCenter,
  d: parseAsRange,
  e: parseAsSubset(ROAD_TAGS),
  f: parseAsOneOf(FAME_OPTIONS.map(([v]) => v)),
  h: parseAsOneOf(HEAT_OPTIONS.map(([v]) => v)),
  m: parseAsOneOf(ELEVATION_OPTIONS.map(([v]) => v)),
  o: parseAsStringLiteral(PASS_SORTS),
  pass: parseAsString,
  pi: parseAsFixed(0),
  q: parseAsString,
  s: parseAsStatus,
  t: parseAsPeriod,
  tour: parseAsString,
  town: parseAsString,
  v: parseAsOneOf(TRAFFIC_OPTIONS.map(([v]) => v)),
  w: parseAsOneOf(WET_OPTIONS.map(([v]) => v)),
  z: parseAsFixed(2),
};
/** Writing: a value equal to its default leaves the hash. */
const HASH_OUT = {
  ...HASH,
  a: HASH.a.withDefault(DEFAULT_FILTERS.types),
  be: HASH.be.withDefault(DEFAULT_FILTERS.minBeauty),
  d: HASH.d.withDefault(DEFAULT_FILTERS.difficulty),
  e: HASH.e.withDefault(DEFAULT_FILTERS.tags),
  f: HASH.f.withDefault(DEFAULT_FILTERS.minFame),
  h: HASH.h.withDefault(DEFAULT_FILTERS.maxValleyTmax),
  m: HASH.m.withDefault(DEFAULT_FILTERS.minElevation),
  o: HASH.o.withDefault(DEFAULT_FILTERS.sort),
  q: HASH.q.withDefault(DEFAULT_FILTERS.query),
  s: HASH.s.withDefault(DEFAULT_FILTERS.status),
  v: HASH.v.withDefault(DEFAULT_FILTERS.maxTraffic),
  w: HASH.w.withDefault(DEFAULT_FILTERS.maxWetDays),
};
const loadHash = createLoader(HASH);
const serialize = createSerializer(HASH_OUT, { clearOnDefault: true });

/**
 * The pure half of the hash adapter (`lib/hash-adapter.ts`), so the parsing can
 * be tested without a window. What the adapter reads becomes the `load` action
 * of `reduce` in `lib/app-state.ts`.
 */
export const parseHash = (hash: string): HashState => {
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
      difficulty: given("d"),
      maxTraffic: given("v"),
      maxValleyTmax: given("h"),
      maxWetDays: given("w"),
      minBeauty: given("be"),
      minElevation: given("m"),
      minFame: given("f"),
      period: given("t"),
      query: given("q"),
      sort: given("o"),
      status: given("s"),
      tags: given("e"),
      types: given("a"),
    },
    selection,
    view: {
      bearing: given("b"),
      lat: h.c?.[0],
      lon: h.c?.[1],
      pitch: given("pi"),
      zoom: given("z"),
    },
  };
};

/** The other pure half: the hash body without the leading "#". */
export const serializeHash = (
  filters: Filters,
  selection: Selection | null,
  view: MapView,
): string => {
  const tilted = view.pitch > 1;
  return serialize({
    a: filters.types,
    b: tilted ? view.bearing : null,
    be: filters.minBeauty,
    c: [view.lat, view.lon],
    d: filters.difficulty,
    e: filters.tags,
    f: filters.minFame,
    h: filters.maxValleyTmax,
    m: filters.minElevation,
    o: filters.sort,
    pass: selection?.kind === "pass" ? selection.slug : null,
    pi: tilted ? view.pitch : null,
    q: filters.query,
    s: filters.status,
    t: filters.period,
    tour: selection?.kind === "tour" ? selection.slug : null,
    town: selection?.kind === "town" ? selection.slug : null,
    v: filters.maxTraffic,
    w: filters.maxWetDays,
    z: view.zoom,
  }).replace(/^\?/u, "");
};
