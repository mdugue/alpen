import { describe, expect, test } from "bun:test";

import {
  ALL_STATUS,
  countCriteria,
  DEFAULT_FILTERS,
  DEFAULT_VIEW,
  defined,
  hasActiveFilters,
  parseHash,
  resolvePeriod,
  serializeHash,
  statusMatches,
} from "@/lib/app-state";
import type { Filters, MapView, Selection } from "@/lib/app-state";

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
    expect(parseHash("#tour=sellaronda")!.selection).toEqual({
      kind: "tour",
      slug: "sellaronda",
    });
    expect(parseHash("#town=bormio")!.selection).toEqual({
      kind: "town",
      slug: "bormio",
    });
    expect(parseHash("#pass=a&tour=b")!.selection).toEqual({
      kind: "pass",
      slug: "a",
    });
  });

  test("legacy and special status values from older links", () => {
    expect(parseHash("#s=openRisky").filters.status).toEqual(["open", "risky"]);
    expect(parseHash("#s=all").filters.status).toBeUndefined();
    expect(parseHash("#s=none").filters.status).toEqual([]);
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
    expect(parseHash("#m=2000oops").filters.minElevation).toBeUndefined();
    expect(parseHash("#m=2000").filters.minElevation).toBe(2000);
    expect(parseHash("#be=abc").filters.minBeauty).toBeUndefined();
    expect(parseHash("#o=nonsense").filters.sort).toBeUndefined();
  });
});

describe("serializeHash", () => {
  test("writes only what differs from the defaults", () => {
    expect(
      serializeHash(
        filters({ period: 7 }),
        null,
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
      { kind: "pass", slug: "col-du-galibier" },
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
    expect(back.selection).toEqual({ kind: "pass", slug: "col-du-galibier" });
    expect(back.view.pitch).toBe(60);
    expect(back.view.bearing).toBe(30);
  });

  test("an empty status filter survives the round trip", () => {
    expect(
      parseHash(serializeHash(filters({ status: [] }), null, view())).filters
        .status,
    ).toEqual([]);
  });

  test("round trip through parse and serialize is stable", () => {
    const selection: Selection = { kind: "town", slug: "bormio" };
    const first = serializeHash(
      filters({ period: 9.5, query: "bor" }),
      selection,
      view({ zoom: 8.25 }),
    );
    const parsed = parseHash(first);
    const second = serializeHash(
      { ...DEFAULT_FILTERS, ...defined(parsed.filters) },
      parsed.selection,
      { ...DEFAULT_VIEW, ...defined(parsed.view) },
    );
    expect(second).toBe(first);
  });
});

describe("filters", () => {
  test("hasActiveFilters ignores the period and the sort", () => {
    expect(hasActiveFilters(filters({ period: 3 }))).toBe(false);
    expect(hasActiveFilters(filters({ sort: "name" }))).toBe(false);
    expect(hasActiveFilters(filters({ difficulty: [1, 4] }))).toBe(true);
    expect(hasActiveFilters(filters({ maxTraffic: 2 }))).toBe(true);
    expect(hasActiveFilters(filters({ minFame: 4 }))).toBe(true);
    expect(hasActiveFilters(filters({ status: ["open"] }))).toBe(true);
    expect(hasActiveFilters(filters({ query: "  " }))).toBe(false);
    expect(hasActiveFilters(filters({ favoritesOnly: true }))).toBe(true);
  });

  test("countCriteria counts every criterion once", () => {
    expect(countCriteria(filters())).toBe(0);
    expect(
      countCriteria(
        filters({
          difficulty: [2, 4],
          maxTraffic: 2,
          minBeauty: 4,
          minElevation: 2000,
          minFame: 3,
        }),
      ),
    ).toBe(5);
  });

  test("statusMatches follows the visible set", () => {
    expect(statusMatches("open", ALL_STATUS)).toBe(true);
    expect(statusMatches("closed", ["open", "risky"])).toBe(false);
  });
});

describe("resolvePeriod", () => {
  test("a shared link wins over the stored choice and over today", () => {
    expect(resolvePeriod(7, 9, 5.5)).toBe(7);
  });
  test("without a link the visitor's own last choice wins", () => {
    expect(resolvePeriod(undefined, 9, 5.5)).toBe(9);
  });
  test("without either, today's half-month from the server", () => {
    expect(resolvePeriod(undefined, null, 5.5)).toBe(5.5);
  });
});
