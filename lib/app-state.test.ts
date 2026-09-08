import { describe, expect, test } from "bun:test";

import {
  ALL_STATUS,
  countPassFilters,
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
      "#pass=col-du-galibier&t=6&z=9&c=45.06,6.41&f=4&m=2000&q=gal&s=open,risky&pi=60&b=30&l=it,fr&r=dolomiten&d=2-4&v=2&be=4&o=beauty",
    );
    expect(h.filters).toEqual({
      period: 6,
      status: ["open", "risky"],
      countries: ["IT", "FR"],
      regions: ["Dolomiten"],
      minFame: 4,
      minElevation: 2000,
      difficulty: [2, 4],
      maxTraffic: 2,
      minBeauty: 4,
      sort: "beauty",
      query: "gal",
    });
    expect(h.selection).toEqual({ kind: "pass", slug: "col-du-galibier" });
    expect(h.view).toEqual({
      lat: 45.06,
      lon: 6.41,
      zoom: 9,
      pitch: 60,
      bearing: 30,
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
    expect(parseHash("#l=it&d=1-3&v=2&o=beauty").filters).toMatchObject({
      countries: ["IT"],
      difficulty: [1, 3],
      maxTraffic: 2,
      sort: "beauty",
    });
    // Unknown codes are dropped, duplicates folded, a reversed window turned around.
    expect(parseHash("#l=it,xx,IT").filters.countries).toEqual(["IT"]);
    expect(parseHash("#l=xx").filters.countries).toBeUndefined();
    expect(parseHash("#r=ostalpen,mars").filters.regions).toEqual(["Ostalpen"]);
    expect(parseHash("#d=4-2").filters.difficulty).toEqual([2, 4]);
    expect(parseHash("#d=3").filters.difficulty).toEqual([3, 3]);
    expect(parseHash("#d=0-9").filters.difficulty).toBeUndefined();
    expect(parseHash("#v=7").filters.maxTraffic).toBeUndefined();
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
    ).toBe("t=7&z=6.50&c=46.3000,9.6000");
  });

  test("filters, selection and a tilted camera are carried", () => {
    const hash = serializeHash(
      filters({
        period: 6,
        status: ["open"],
        countries: ["FR", "IT"],
        regions: ["Westalpen"],
        minFame: 4,
        minElevation: 2000,
        difficulty: [2, 5],
        maxTraffic: 3,
        minBeauty: 4,
        sort: "traffic",
        query: "gal",
      }),
      { kind: "pass", slug: "col-du-galibier" },
      view({ pitch: 60, bearing: 30 }),
    );
    expect(hash).toContain("l=fr,it");
    expect(hash).toContain("d=2-5");
    const back = parseHash(hash);
    expect(back.filters.period).toBe(6);
    expect(back.filters.status).toEqual(["open"]);
    expect(back.filters.countries).toEqual(["FR", "IT"]);
    expect(back.filters.regions).toEqual(["Westalpen"]);
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
    expect(hasActiveFilters(filters({ countries: ["CH"] }))).toBe(true);
    expect(hasActiveFilters(filters({ difficulty: [1, 4] }))).toBe(true);
    expect(hasActiveFilters(filters({ maxTraffic: 2 }))).toBe(true);
    expect(hasActiveFilters(filters({ minFame: 4 }))).toBe(true);
    expect(hasActiveFilters(filters({ status: ["open"] }))).toBe(true);
    expect(hasActiveFilters(filters({ query: "  " }))).toBe(false);
    expect(hasActiveFilters(filters({ favoritesOnly: true }))).toBe(true);
  });

  test("countPassFilters counts every pass filter once", () => {
    expect(countPassFilters(filters())).toBe(0);
    expect(
      countPassFilters(
        filters({
          regions: ["Dolomiten"],
          minFame: 3,
          minElevation: 2000,
          difficulty: [2, 4],
          maxTraffic: 2,
          minBeauty: 4,
        }),
      ),
    ).toBe(6);
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
