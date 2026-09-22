import {
  createLoader,
  createParser,
  createSerializer,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";
import type { SingleParserBuilder } from "nuqs";

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
import type {
  Filters,
  HashState,
  MapView,
  Options,
  Selection,
} from "@/lib/app-state";
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
//   z     zoom                             c     centre "lat,lon"
//   pi,b  pitch and bearing (only when tilted)
//   pass | tour | town   the selected entity's slug
//
// Every filter has a key too; those are `FILTER_KEYS` below, one row each.
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
/**
 * Exactly one rung of a threshold group; anything else is not a filter. It
 * takes the group itself rather than a list of numbers, so the promise on
 * `Options` – a link never applies a filter the chips cannot show – is one
 * expression rather than a `.map` per key.
 */
const parseAsOneOf = (options: Options) =>
  createParser<number>({
    parse: (v) =>
      options.some(([value]) => value === Number(v)) ? Number(v) : null,
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

/**
 * One row per filter that travels in the hash: the key, the field of `Filters`
 * it carries, how it is read. The four things a key needs – a parser going in,
 * a default that elides it going out, an entry in each direction – are derived
 * from this table instead of being spelled out four times, which is four
 * places to forget a key in. `favoritesOnly` has no row on purpose: bookmarks
 * are private and stay in localStorage. That the table covers `Filters` is a
 * test (`lib/hash.test.ts`), which also pins the hash a populated state writes.
 */
type FilterKey = {
  [F in keyof Filters]: {
    /** Written even when it equals the default. */
    always?: true;
    field: F;
    parser: SingleParserBuilder<Filters[F]>;
  };
}[keyof Filters];

const FILTER_KEYS = {
  /** Road types "pass,spur". */
  a: { field: "types", parser: parseAsSubset(ROAD_TYPES) },
  /** Min. beauty. */
  be: {
    field: "minBeauty",
    parser: parseAsOneOf(BEAUTY_OPTIONS),
  },
  /** Difficulty window "2-4". */
  d: { field: "difficulty", parser: parseAsRange },
  /** Road labels "toll,carfree". */
  e: { field: "tags", parser: parseAsSubset(ROAD_TAGS) },
  /** Min. fame. */
  f: { field: "minFame", parser: parseAsOneOf(FAME_OPTIONS) },
  /** Max. valley heat in °C. */
  h: {
    field: "maxValleyTmax",
    parser: parseAsOneOf(HEAT_OPTIONS),
  },
  /** Min. elevation in m. */
  m: {
    field: "minElevation",
    parser: parseAsOneOf(ELEVATION_OPTIONS),
  },
  /** Pass sort key. */
  o: { field: "sort", parser: parseAsStringLiteral(PASS_SORTS) },
  /** Search text. */
  q: { field: "query", parser: parseAsString },
  /** Statuses "open,risky". */
  s: { field: "status", parser: parseAsStatus },
  /** Half-month, 1 … 12.5 – what the app opens on, so every link carries it. */
  t: { always: true, field: "period", parser: parseAsPeriod },
  /** Max. traffic. */
  v: {
    field: "maxTraffic",
    parser: parseAsOneOf(TRAFFIC_OPTIONS),
  },
  /** Max. rain days of 15. */
  w: { field: "maxWetDays", parser: parseAsOneOf(WET_OPTIONS) },
} as const satisfies Record<string, FilterKey>;

type FilterHashKey = keyof typeof FILTER_KEYS;
type Rows = typeof FILTER_KEYS;
const filterRows = Object.entries(FILTER_KEYS) as [
  FilterHashKey,
  Rows[FilterHashKey],
][];

/**
 * nuqs writes a hash in the order of the map it was built with, so a key's
 * place in a link must not depend on which half of that map it came from.
 */
const inKeyOrder = <T extends object>(map: T): T =>
  Object.fromEntries(
    Object.entries(map).toSorted(([a], [b]) => (a < b ? -1 : 1)),
  ) as T;

/** Reading: a missing or invalid value is `null`, which `parseHash` turns into "not given". */
const HASH = inKeyOrder({
  ...(Object.fromEntries(filterRows.map(([key, row]) => [key, row.parser])) as {
    [K in FilterHashKey]: Rows[K]["parser"];
  }),
  b: parseAsFixed(0),
  c: parseAsCenter,
  pass: parseAsString,
  pi: parseAsFixed(0),
  tour: parseAsString,
  town: parseAsString,
  z: parseAsFixed(2),
});
/**
 * The row's parser carrying its default. A row is one of thirteen parser
 * types, and the one thing that union cannot do is call a method whose `this`
 * is a single member of it – so the parser is widened for the call, once here.
 */
const withDefault = (row: Rows[FilterHashKey]) =>
  (row.parser as SingleParserBuilder<unknown>).withDefault(
    DEFAULT_FILTERS[row.field],
  );

/** Writing: a value equal to its default leaves the hash – `t` excepted, see its row. */
const HASH_OUT = {
  ...HASH,
  ...(Object.fromEntries(
    filterRows
      .filter(([, row]) => !("always" in row))
      .map(([key, row]) => [key, withDefault(row)]),
  ) as Partial<{ [K in FilterHashKey]: Rows[K]["parser"] }>),
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
    filters: Object.fromEntries(
      filterRows.map(([key, row]) => [row.field, given(key)]),
    ),
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
    ...(Object.fromEntries(
      filterRows.map(([key, row]) => [key, filters[row.field]]),
    ) as { [K in FilterHashKey]: Filters[Rows[K]["field"]] }),
    b: tilted ? view.bearing : null,
    c: [view.lat, view.lon],
    pass: selection?.kind === "pass" ? selection.slug : null,
    pi: tilted ? view.pitch : null,
    tour: selection?.kind === "tour" ? selection.slug : null,
    town: selection?.kind === "town" ? selection.slug : null,
    z: view.zoom,
  }).replace(/^\?/u, "");
};
