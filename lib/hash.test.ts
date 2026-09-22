import { describe, expect, test } from "bun:test";

import { DEFAULT_FILTERS, DEFAULT_VIEW, defined } from "@/lib/app-state";
import type { Filters, MapView } from "@/lib/app-state";
import { parseHash, serializeHash } from "@/lib/hash";

const filters = (over: Partial<Filters> = {}): Filters => ({
  ...DEFAULT_FILTERS,
  ...over,
});
const view = (over: Partial<MapView> = {}): MapView => ({
  ...DEFAULT_VIEW,
  ...over,
});

describe("parseHash", () => {
  test("reads filters, selection and camera", () => {
    const h = parseHash(
      "#pass=col-du-galibier&t=6&z=9&c=45.06,6.41&f=4&m=2000&q=gal&s=open,risky&pi=60&b=30&d=2-4&v=2&be=4&o=beauty",
    );
    expect(h.filters).toEqual({
      difficulty: [2, 4],
      maxTraffic: 2,
      minBeauty: 4,
      minElevation: 2000,
      minFame: 4,
      period: 6,
      query: "gal",
      sort: "beauty",
      status: ["open", "risky"],
    });
    expect(h.selection).toEqual({ kind: "pass", slug: "col-du-galibier" });
    expect(h.view).toEqual({
      bearing: 30,
      lat: 45.06,
      lon: 6.41,
      pitch: 60,
      zoom: 9,
    });
  });

  test("works with and without the leading #, and ignores unknown keys", () => {
    expect(parseHash("t=6&unknown=1")).toEqual(parseHash("#t=6"));
  });

  test("an empty hash leaves everything undefined", () => {
    const h = parseHash("");
    expect(h.selection).toBeNull();
    expect(Object.values(h.filters).every((v) => v === undefined)).toBe(true);
    expect(Object.values(h.view).every((v) => v === undefined)).toBe(true);
  });

  test("only one selection kind, passes first", () => {
    expect(parseHash("#tour=sellaronda").selection).toEqual({
      kind: "tour",
      slug: "sellaronda",
    });
    expect(parseHash("#town=bormio").selection).toEqual({
      kind: "town",
      slug: "bormio",
    });
    expect(parseHash("#pass=a&tour=b").selection).toEqual({
      kind: "pass",
      slug: "a",
    });
  });

  test("legacy and special status values from older links", () => {
    expect(parseHash("#s=openRisky").filters.status).toEqual(["open", "risky"]);
    expect(parseHash("#s=all").filters.status).toBeUndefined();
    // "none" used to hide everything; no control produces it any more.
    expect(parseHash("#s=none").filters.status).toBeUndefined();
    expect(parseHash("#s=open,nonsense").filters.status).toEqual(["open"]);
    expect(parseHash("#s=nonsense").filters.status).toBeUndefined();
  });

  test("nonsense numbers are dropped rather than becoming NaN", () => {
    expect(parseHash("#c=abc,def").view.lat).toBeUndefined();
    expect(parseHash("#c=abc,def").view.lon).toBeUndefined();
    expect(parseHash("#c=45.06").view.lat).toBeUndefined();
    expect(parseHash("#c=45.06,6.41,9").view.lat).toBeUndefined();
    expect(parseHash("#t=99").filters.period).toBeUndefined();
    expect(parseHash("#t=abc").filters.period).toBeUndefined();
    expect(parseHash("#t=6.25").filters.period).toBeUndefined();
    expect(parseHash("#z=abc").view.zoom).toBeUndefined();
  });

  test("the filter keys from plan 05 are validated", () => {
    expect(parseHash("#d=1-3&v=2&o=beauty").filters).toMatchObject({
      difficulty: [1, 3],
      maxTraffic: 2,
      sort: "beauty",
    });
    // A reversed window is turned around.
    expect(parseHash("#d=4-2").filters.difficulty).toEqual([2, 4]);
    expect(parseHash("#d=3").filters.difficulty).toEqual([3, 3]);
    expect(parseHash("#d=0-9").filters.difficulty).toBeUndefined();
    expect(parseHash("#v=7").filters.maxTraffic).toBeUndefined();
    // Only what the selects offer, and whole numbers only.
    expect(parseHash("#v=4").filters.maxTraffic).toBeUndefined();
    expect(parseHash("#be=2").filters.minBeauty).toBeUndefined();
    expect(parseHash("#f=99").filters.minFame).toBeUndefined();
    expect(parseHash("#f=4").filters.minFame).toBe(4);
    expect(parseHash("#f=5").filters.minFame).toBe(5);
    expect(parseHash("#f=2").filters.minFame).toBeUndefined();
    expect(parseHash("#m=2000oops").filters.minElevation).toBeUndefined();
    expect(parseHash("#m=2000").filters.minElevation).toBe(2000);
    // Only the thresholds the chips offer.
    expect(parseHash("#m=1700").filters.minElevation).toBeUndefined();
    expect(parseHash("#be=abc").filters.minBeauty).toBeUndefined();
    expect(parseHash("#o=nonsense").filters.sort).toBeUndefined();
  });

  test("the summer-signal keys from plan 13 round-trip and are validated", () => {
    expect(parseHash("#h=26&w=6").filters).toMatchObject({
      maxValleyTmax: 26,
      maxWetDays: 6,
    });
    // Only the rungs of the two ladders. `w` counts rain days now, so the old
    // percentages are not values it can hold at all.
    expect(parseHash("#h=27").filters.maxValleyTmax).toBeUndefined();
    expect(parseHash("#h=28").filters.maxValleyTmax).toBe(28);
    expect(parseHash("#w=5").filters.maxWetDays).toBeUndefined();
    expect(parseHash("#w=50").filters.maxWetDays).toBeUndefined();
    expect(parseHash("#w=10").filters.maxWetDays).toBe(10);
    expect(parseHash("#s=open,risky").filters).toMatchObject({
      maxValleyTmax: undefined,
      maxWetDays: undefined,
      status: ["open", "risky"],
    });
    const out = serializeHash(
      filters({ maxValleyTmax: 22, maxWetDays: 8 }),
      DEFAULT_VIEW,
    );
    expect(out).toContain("h=22");
    expect(out).toContain("w=8");
    expect(parseHash(out).filters).toMatchObject({
      maxValleyTmax: 22,
      maxWetDays: 8,
    });
    expect(serializeHash(filters(), DEFAULT_VIEW)).not.toMatch(/[hw]=/u);
  });
});

describe("plan 14 road types and labels", () => {
  test("a and e read a subset of their vocabulary, in vocabulary order", () => {
    const h = parseHash("#a=valley,spur&e=toll,carfree");
    expect(h.filters.types).toEqual(["spur", "valley"]);
    expect(h.filters.tags).toEqual(["carfree", "toll"]);
  });

  test("unknown members drop out, a value that leaves nothing is no filter", () => {
    expect(parseHash("#a=spur,autobahn").filters.types).toEqual(["spur"]);
    expect(parseHash("#a=autobahn").filters.types).toBeUndefined();
    expect(parseHash("#e=schnee").filters.tags).toBeUndefined();
  });

  test("both survive the round trip, the defaults leave the hash", () => {
    const hash = serializeHash(
      filters({ tags: ["toll"], types: ["pass", "spur"] }),
      view(),
    );
    expect(hash).toContain("a=pass,spur");
    expect(hash).toContain("e=toll");
    const back = parseHash(hash);
    expect(back.filters.types).toEqual(["pass", "spur"]);
    expect(back.filters.tags).toEqual(["toll"]);
    expect(serializeHash(filters(), view())).not.toMatch(/[ae]=/u);
  });
});

describe("destinations in the hash (plan 12)", () => {
  test("`ziel` selects a destination and `vgl` carries the comparison", () => {
    const h = parseHash("#ziel=oisans&vgl=oisans,engadin,oisans,ubaye,ventoux");
    expect(h.selection).toEqual({ kind: "destination", slug: "oisans" });
    // Deduplicated and cut to the sheet's three columns.
    expect(h.compare).toEqual(["oisans", "engadin", "ubaye"]);
    expect(parseHash("#vgl=").compare).toEqual([]);
    expect(parseHash("").compare).toEqual([]);
  });

  test("both travel out and back", () => {
    const hash = serializeHash(filters(), view(), ["engadin", "oisans"]);
    expect(hash).not.toContain("ziel=");
    expect(hash).toContain("vgl=engadin,oisans");
    expect(parseHash(hash).compare).toEqual(["engadin", "oisans"]);
    expect(serializeHash(filters(), view(), [])).not.toMatch(/vgl=/u);
  });
});

describe("serializeHash", () => {
  test("writes only what differs from the defaults", () => {
    expect(
      serializeHash(
        filters({ period: 7 }),
        view({ lat: 46.3, lon: 9.6, zoom: 6.5 }),
      ),
    ).toBe("c=46.3000,9.6000&t=7&z=6.50");
  });

  test("filters, selection and a tilted camera are carried", () => {
    const hash = serializeHash(
      filters({
        difficulty: [2, 5],
        maxTraffic: 3,
        minBeauty: 4,
        minElevation: 2000,
        minFame: 4,
        period: 6,
        query: "gal",
        sort: "traffic",
        status: ["open"],
      }),
      view({ bearing: 30, pitch: 60 }),
    );
    expect(hash).toContain("d=2-5");
    const back = parseHash(hash);
    expect(back.filters.period).toBe(6);
    expect(back.filters.status).toEqual(["open"]);
    expect(back.filters.minFame).toBe(4);
    expect(back.filters.minElevation).toBe(2000);
    expect(back.filters.difficulty).toEqual([2, 5]);
    expect(back.filters.maxTraffic).toBe(3);
    expect(back.filters.minBeauty).toBe(4);
    expect(back.filters.sort).toBe("traffic");
    expect(back.filters.query).toBe("gal");
    expect(back.view.pitch).toBe(60);
    expect(back.view.bearing).toBe(30);
  });

  test("an empty set never reaches the hash – it is no filter", () => {
    // `toggleMember` cannot produce one; a hand-written link with it opens
    // unfiltered rather than on an empty list.
    const hash = serializeHash(filters({ status: [] }), view());
    expect(parseHash(hash).filters.status).toBeUndefined();
    expect(parseHash("#a=").filters.types).toBeUndefined();
  });

  test("round trip through parse and serialize is stable", () => {
    const first = serializeHash(
      filters({ period: 9.5, query: "bor" }),
      view({ zoom: 8.25 }),
    );
    const parsed = parseHash(first);
    const second = serializeHash(
      { ...DEFAULT_FILTERS, ...defined(parsed.filters) },
      { ...DEFAULT_VIEW, ...defined(parsed.view) },
    );
    expect(second).toBe(first);
  });
});

// ── The uniform filter keys, as a table ──────────────────────────────────────
//
// `lib/hash.ts` derives parser, default and both directions of every filter
// key from one row each. This is the independent, hand-written copy of that
// row set: a key that disappears, is renamed or loses its default elision
// fails here rather than in a review. `favoritesOnly` is the one filter that
// never travels – it is private and lives in localStorage – and saying so is
// what makes the row set exhaustive over `Filters`.

interface Row<K extends keyof Filters> {
  /** The hash key, or null for a filter that deliberately stays out of the hash. */
  key: string | null;
  /** A value that differs from the default, for the round trip. */
  value?: Filters[K];
  /** False for the key that is written even when it equals its default. */
  elides?: boolean;
}

const ROWS = {
  difficulty: { key: "d", value: [2, 4] },
  favoritesOnly: { key: null },
  maxTraffic: { key: "v", value: 3 },
  maxValleyTmax: { key: "h", value: 22 },
  maxWetDays: { key: "w", value: 8 },
  minBeauty: { key: "be", value: 4 },
  minElevation: { key: "m", value: 2000 },
  minFame: { key: "f", value: 4 },
  // The half-month is the one key every link carries: it is what the app opens
  // on, so it is written even when it equals the default.
  period: { elides: false, key: "t", value: 6.5 },
  query: { key: "q", value: "stelvio" },
  ranges: { key: "g", value: ["Jura"] },
  sort: { key: "o", value: "beauty" },
  status: { key: "s", value: ["open", "risky"] },
  tags: { key: "e", value: ["toll"] },
  types: { key: "a", value: ["pass", "spur"] },
} satisfies { [K in keyof Filters]: Row<K> };

const rows = Object.entries(ROWS) as [
  keyof Filters,
  Row<keyof Filters> & { key: string },
][];
const hashed = rows.filter(([, row]) => row.key !== null);
/** `a=…` at the start of the hash or after an `&`, never a suffix of another key. */
const carries = (hash: string, key: string) =>
  new RegExp(`(^|&)${key}=`, "u").test(hash);

describe("every filter key", () => {
  test("the table covers `Filters` exactly", () => {
    expect(Object.keys(ROWS).toSorted()).toEqual(
      Object.keys(DEFAULT_FILTERS).toSorted(),
    );
    expect(hashed).toHaveLength(14);
  });

  test("each key carries a non-default value there and back", () => {
    for (const [field, row] of hashed) {
      const hash = serializeHash(filters({ [field]: row.value }), view());
      expect(carries(hash, row.key)).toBe(true);
      expect(parseHash(hash).filters[field]).toEqual(row.value);
    }
  });

  test("a default value leaves the hash", () => {
    const hash = serializeHash(filters(), view());
    for (const [, row] of hashed)
      expect(carries(hash, row.key)).toBe(row.elides === false);
  });

  test("the whole hash of a populated state, byte for byte", () => {
    const populated = Object.fromEntries(
      hashed.map(([field, row]) => [field, row.value]),
    ) as Partial<Filters>;
    expect(
      serializeHash(
        filters(populated),
        view({
          bearing: 30,
          lat: 46.5253,
          lon: 10.4541,
          pitch: 60,
          zoom: 9.75,
        }),
      ),
    ).toBe(
      "a=pass,spur&b=30&be=4&c=46.5253,10.4541&d=2-4&e=toll&f=4&g=Jura&h=22&m=2000&o=beauty&pi=60&q=stelvio&s=open,risky&t=6.5&v=3&w=8&z=9.75",
    );
  });

  test("the two bespoke status values survive the table", () => {
    // Neither is uniform: `openRisky` is a legacy spelling of a two-member
    // list, `none` used to mean "hide everything" and now means no filter.
    expect(parseHash("#s=openRisky").filters.status).toEqual(["open", "risky"]);
    expect(parseHash("#s=none").filters.status).toBeUndefined();
  });
});
