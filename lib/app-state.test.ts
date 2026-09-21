import { describe, expect, test } from "bun:test";

import {
  ALL_STATUS,
  countCriteria,
  DEFAULT_FILTERS,
  DEFAULT_VIEW,
  DETAIL_SNAPS,
  hasActiveFilters,
  initialState,
  isShown,
  LIST_SNAPS,
  pickedMembers,
  reconcileShown,
  reduce,
  resolvePeriod,
  shownTours,
  statusMatches,
  toggleLevel,
  toggleMember,
} from "@/lib/app-state";
import type { AppState, Env, Filters, Selection } from "@/lib/app-state";
import { parseHash } from "@/lib/hash";
import { entityKey } from "@/lib/route-key";

const filters = (over: Partial<Filters> = {}): Filters => ({
  ...DEFAULT_FILTERS,
  ...over,
});

describe("plan 14 road types and labels", () => {
  test("both count as one criterion each", () => {
    expect(countCriteria(filters({ types: ["balcony"] }))).toBe(1);
    expect(countCriteria(filters({ tags: ["carfree", "glacier"] }))).toBe(1);
    expect(hasActiveFilters(filters({ types: ["balcony"] }))).toBe(true);
    expect(hasActiveFilters(filters({ tags: ["toll"] }))).toBe(true);
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
          maxValleyTmax: 28,
          maxWetDays: 6,
          minBeauty: 4,
          minElevation: 2000,
          minFame: 3,
        }),
      ),
    ).toBe(7);
  });

  test("toggleMember never leaves an empty or a full set behind", () => {
    expect(toggleMember(ALL_STATUS, ALL_STATUS, "open")).toEqual(["open"]);
    expect(toggleMember(["open"], ALL_STATUS, "closed")).toEqual([
      "open",
      "closed",
    ]);
    // The last one out lifts the filter; so does picking every one.
    expect(toggleMember(["open"], ALL_STATUS, "open")).toEqual(ALL_STATUS);
    expect(toggleMember(["open", "closed"], ALL_STATUS, "risky")).toEqual(
      ALL_STATUS,
    );
    expect(pickedMembers(ALL_STATUS, ALL_STATUS)).toEqual([]);
    expect(pickedMembers(["risky"], ALL_STATUS)).toEqual(["risky"]);
  });

  test("toggleLevel keeps the difficulty window in one piece", () => {
    expect(toggleLevel([1, 5], 3)).toEqual([3, 3]);
    expect(toggleLevel([3, 3], 5)).toEqual([3, 5]);
    expect(toggleLevel([3, 5], 1)).toEqual([1, 5]);
    expect(toggleLevel([2, 4], 4)).toEqual([2, 3]);
    expect(toggleLevel([2, 4], 2)).toEqual([3, 4]);
    expect(toggleLevel([2, 4], 3)).toEqual([3, 3]);
    expect(toggleLevel([3, 3], 3)).toEqual([1, 5]);
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

describe("entityKey", () => {
  test("is the kind and the slug, from a selection or from the pair", () => {
    expect(entityKey("pass", "stilfser-joch")).toBe("pass:stilfser-joch");
    expect(entityKey({ kind: "tour", slug: "sellaronda" })).toBe(
      "tour:sellaronda",
    );
  });
});

const TOURS = ["sellaronda", "stelvio-runde"];
const desktop: Env = { mobile: false, tours: TOURS };
const phone: Env = { mobile: true, tours: TOURS };
const [LIST_HALF, LIST_FULL] = LIST_SNAPS;
const [DETAIL_HALF, DETAIL_FULL] = DETAIL_SNAPS;
const GALIBIER: Selection = { kind: "pass", slug: "col-du-galibier" };
const SELLARONDA: Selection = { kind: "tour", slug: "sellaronda" };
const BORMIO: Selection = { kind: "town", slug: "bormio" };

/** A state with something to clear: a hover, a cursor, everything hidden. */
const busy = (over: Partial<AppState> = {}): AppState => ({
  ...initialState({ defaultPeriod: 7, tours: TOURS }),
  hovered: BORMIO,
  profileCursor: { lat: 46, lon: 9 },
  shown: { hiddenTours: [...TOURS], passes: false, towns: false },
  ...over,
});

describe("shown", () => {
  test("isShown and shownTours read the one value", () => {
    const shown = { hiddenTours: ["sellaronda"], passes: false, towns: true };
    expect(isShown(shown, "pass", "x")).toBe(false);
    expect(isShown(shown, "town", "x")).toBe(true);
    expect(isShown(shown, "tour", "sellaronda")).toBe(false);
    expect(isShown(shown, "tour", "stelvio-runde")).toBe(true);
    expect(shownTours(shown, TOURS)).toEqual(["stelvio-runde"]);
  });

  test("reconcileShown drops slugs that left the data and keeps the rest", () => {
    const shown = {
      hiddenTours: ["gone", "sellaronda"],
      passes: true,
      towns: true,
    };
    expect(reconcileShown(shown, TOURS).hiddenTours).toEqual(["sellaronda"]);
    const clean = { hiddenTours: ["sellaronda"], passes: true, towns: true };
    expect(reconcileShown(clean, TOURS)).toBe(clean);
  });
});

describe("reduce · select", () => {
  test.each([
    [
      "a row, with the list drawer open",
      phone,
      { open: true, snap: LIST_HALF },
    ],
    [
      "the map, with no list behind it",
      phone,
      { open: false, snap: LIST_HALF },
    ],
    ["a row on desktop", desktop, { open: false, snap: LIST_HALF }],
  ])(
    "from %s sets the tab, clears the pointer and reveals the kind",
    (_, env, list) => {
      const before = busy({ sheet: { ...busy().sheet, list }, tab: "town" });
      const s = reduce(before, { selection: GALIBIER, type: "select" }, env);
      expect(s.selection).toEqual(GALIBIER);
      expect(s.last).toEqual(GALIBIER);
      expect(s.tab).toBe("pass");
      expect(s.hovered).toBeNull();
      expect(s.profileCursor).toBeNull();
      expect(s.shown.passes).toBe(true);
      expect(s.shown.towns).toBe(false);
    },
  );

  test("from the hash, by way of load", () => {
    const s = reduce(
      busy({ tab: "pass" }),
      { hash: parseHash("#tour=sellaronda"), stored: {}, type: "load" },
      desktop,
    );
    expect(s.selection).toEqual(SELLARONDA);
    expect(s.tab).toBe("tour");
    expect(s.hovered).toBeNull();
    expect(s.profileCursor).toBeNull();
    expect(s.shown.hiddenTours).toEqual(["stelvio-runde"]);
  });

  test("reveals each kind in its own way", () => {
    const town = reduce(busy(), { selection: BORMIO, type: "select" }, desktop);
    expect(town.shown).toEqual({
      hiddenTours: [...TOURS],
      passes: false,
      towns: true,
    });
    const tour = reduce(
      busy(),
      { selection: SELLARONDA, type: "select" },
      desktop,
    );
    expect(tour.shown.hiddenTours).toEqual(["stelvio-runde"]);
    // Already shown: the same object, so nothing downstream re-renders for it.
    const shown = initialState({ defaultPeriod: 7 });
    expect(
      reduce(shown, { selection: GALIBIER, type: "select" }, desktop).shown,
    ).toBe(shown.shown);
  });

  test.each([
    ["closed list", { open: false, snap: LIST_FULL }, DETAIL_HALF, false],
    ["list at half", { open: true, snap: LIST_HALF }, DETAIL_HALF, true],
    ["list all the way up", { open: true, snap: LIST_FULL }, DETAIL_FULL, true],
  ])(
    "on a phone, over a %s, picks the detail snap and nesting",
    (_, list, snap, nested) => {
      const before = busy({ sheet: { ...busy().sheet, list } });
      const s = reduce(before, { selection: GALIBIER, type: "select" }, phone);
      expect(s.sheet.detail).toEqual({ nested, snap });
      expect(s.sheet.list).toEqual(list);
    },
  );

  test("on desktop the sheets are left alone", () => {
    const before = busy({
      sheet: { ...busy().sheet, list: { open: true, snap: LIST_FULL } },
    });
    const s = reduce(before, { selection: GALIBIER, type: "select" }, desktop);
    expect(s.sheet).toBe(before.sheet);
  });
});

describe("reduce · back", () => {
  test("clears the selection, the hover and the cursor, keeps what the sheet shows", () => {
    const open = reduce(busy(), { selection: GALIBIER, type: "select" }, phone);
    const s = reduce(
      { ...open, hovered: BORMIO, profileCursor: { lat: 46, lon: 9 } },
      { type: "back" },
      phone,
    );
    expect(s.selection).toBeNull();
    expect(s.last).toEqual(GALIBIER);
    expect(s.hovered).toBeNull();
    expect(s.profileCursor).toBeNull();
    expect(s.tab).toBe("pass");
  });
});

describe("reduce · load", () => {
  test("resolves the period as the link, then the visitor's choice, then today", () => {
    const stored = { period: 9 as const };
    expect(
      initialState({ defaultPeriod: 5.5, hash: parseHash("#t=7"), stored })
        .filters.period,
    ).toBe(7);
    expect(initialState({ defaultPeriod: 5.5, stored }).filters.period).toBe(9);
    expect(initialState({ defaultPeriod: 5.5 }).filters.period).toBe(5.5);
  });

  test("the visitor's own period is what was stored, never what the link says", () => {
    const s = initialState({
      defaultPeriod: 5.5,
      hash: parseHash("#t=7"),
      stored: { period: 9 },
    });
    expect(s.ownPeriod).toBe(9);
    expect(
      initialState({ defaultPeriod: 5.5, hash: parseHash("#t=7") }).ownPeriod,
    ).toBeNull();
    const chosen = reduce(s, { period: 3, type: "period" }, desktop);
    expect(chosen.filters.period).toBe(3);
    expect(chosen.ownPeriod).toBe(3);
  });

  test("a second load, as on hashchange, resolves the same way without a period", () => {
    const first = reduce(
      initialState({ defaultPeriod: 5.5 }),
      { hash: parseHash("#t=7&q=gal"), stored: { period: 9 }, type: "load" },
      desktop,
    );
    expect(first.filters.period).toBe(7);
    expect(first.loaded).toBe(true);
    const second = reduce(
      first,
      { hash: parseHash("#q=stel"), stored: { period: 9 }, type: "load" },
      desktop,
    );
    expect(second.filters.period).toBe(9);
    expect(second.filters.query).toBe("stel");
    const third = reduce(
      second,
      { hash: parseHash(""), stored: {}, type: "load" },
      desktop,
    );
    expect(third.filters.period).toBe(5.5);
    expect(third.filters.query).toBe("");
  });

  test("a link without an entity closes what was open, as Escape does", () => {
    const open = reduce(busy(), { selection: GALIBIER, type: "select" }, phone);
    const s = reduce(
      { ...open, hovered: BORMIO },
      { hash: parseHash("#t=6"), stored: {}, type: "load" },
      phone,
    );
    expect(s.selection).toBeNull();
    expect(s.last).toEqual(GALIBIER);
    expect(s.hovered).toBeNull();
    expect(s.profileCursor).toBeNull();
  });

  test("with #tour=… while the pass tab is open ends with the tour tab", () => {
    const s = reduce(
      initialState({ defaultPeriod: 7, tours: TOURS }),
      {
        hash: parseHash("#tour=sellaronda"),
        stored: { tab: "pass" },
        type: "load",
      },
      desktop,
    );
    expect(s.tab).toBe("tour");
    expect(s.selection).toEqual(SELLARONDA);
  });

  test("a stale slug in hiddenTours is dropped, the stored tab and switches kept", () => {
    const stored = {
      shown: {
        hiddenTours: ["gone", "sellaronda"],
        passes: false,
        towns: true,
      },
      tab: "town" as const,
    };
    const s = initialState({ defaultPeriod: 7, stored, tours: TOURS });
    expect(s.shown).toEqual({
      hiddenTours: ["sellaronda"],
      passes: false,
      towns: true,
    });
    expect(s.tab).toBe("town");
  });

  test("the camera is requested only when the link carries one", () => {
    expect(
      initialState({ defaultPeriod: 7, hash: parseHash("#t=6") }).requestedView,
    ).toBeNull();
    const s = initialState({
      defaultPeriod: 7,
      hash: parseHash("#z=9&c=45.06,6.41"),
    });
    expect(s.requestedView).toEqual({
      ...DEFAULT_VIEW,
      lat: 45.06,
      lon: 6.41,
      zoom: 9,
    });
    expect(s.view).toEqual(s.requestedView!);
  });

  test("the empty inputs give the state the server renders", () => {
    const s = initialState({ defaultPeriod: 7 });
    expect(s.loaded).toBe(false);
    expect(s.selection).toBeNull();
    expect(s.filters).toEqual(filters({ period: 7 }));
    expect(s.shown).toEqual({ hiddenTours: [], passes: true, towns: true });
    expect(s.sheet.list.open).toBe(false);
  });
});

describe("reduce · the switches and the sheets", () => {
  const start = initialState({ defaultPeriod: 7, tours: TOURS });

  test("toggleKind, toggleTour and the master switch", () => {
    const s1 = reduce(
      start,
      { kind: "town", on: false, type: "toggleKind" },
      desktop,
    );
    expect(s1.shown.towns).toBe(false);
    const s2 = reduce(
      s1,
      { on: false, slug: "sellaronda", type: "toggleTour" },
      desktop,
    );
    expect(s2.shown.hiddenTours).toEqual(["sellaronda"]);
    // Twice off is once off.
    expect(
      reduce(s2, { on: false, slug: "sellaronda", type: "toggleTour" }, desktop)
        .shown.hiddenTours,
    ).toEqual(["sellaronda"]);
    const s3 = reduce(s2, { on: false, type: "toggleTours" }, desktop);
    expect(s3.shown.hiddenTours).toEqual(TOURS);
    expect(
      reduce(s3, { on: true, type: "toggleTours" }, desktop).shown.hiddenTours,
    ).toEqual([]);
    expect(
      reduce(s3, { on: true, slug: "sellaronda", type: "toggleTour" }, desktop)
        .shown.hiddenTours,
    ).toEqual(["stelvio-runde"]);
  });

  test("filters take an updater, hover and cursor are plain sets", () => {
    const s = reduce(
      start,
      { type: "filters", update: (f) => ({ ...f, query: "gal" }) },
      desktop,
    );
    expect(s.filters.query).toBe("gal");
    expect(
      reduce(s, { selection: BORMIO, type: "hover" }, desktop).hovered,
    ).toEqual(BORMIO);
    expect(
      reduce(s, { at: { lat: 1, lon: 2 }, type: "profileCursor" }, desktop)
        .profileCursor,
    ).toEqual({ lat: 1, lon: 2 });
    expect(reduce(s, { tab: "town", type: "tab" }, desktop).tab).toBe("town");
  });

  test("the list drawer opens with or without its filter panel, and each sheet snaps on its own", () => {
    const list = reduce(
      start,
      { filters: true, open: true, type: "list" },
      phone,
    );
    expect(list.sheet.list.open).toBe(true);
    expect(list.sheet.filters).toBe(true);
    const up = reduce(
      list,
      { sheet: "list", snap: LIST_FULL, type: "snap" },
      phone,
    );
    expect(up.sheet.list.snap).toBe(LIST_FULL);
    expect(up.sheet.detail.snap).toBe(DETAIL_HALF);
    const closed = reduce(up, { open: false, type: "list" }, phone);
    expect(closed.sheet.list).toEqual({ open: false, snap: LIST_FULL });
    expect(closed.sheet.filters).toBe(true);
    expect(
      reduce(closed, { open: null, type: "filtersOpen" }, phone).sheet.filters,
    ).toBeNull();
  });
});
