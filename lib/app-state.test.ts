import { describe, expect, test } from "bun:test";

import {
  ALL_STATUS,
  DEFAULT_FILTERS,
  DEFAULT_VIEW,
  DETAIL_SNAPS,
  initialState,
  isShown,
  LIST_SNAPS,
  pickedMembers,
  reconcileShown,
  reduce,
  shownTourCount,
  toggleLevel,
  toggleMember,
} from "@/lib/app-state";
import type {
  AppState,
  Env,
  Filters,
  Selection,
  StoredState,
} from "@/lib/app-state";
import { parseHash } from "@/lib/hash";
import { entityKey } from "@/lib/route-key";
import type { Period } from "@/lib/types";

const filters = (over: Partial<Filters> = {}): Filters => ({
  ...DEFAULT_FILTERS,
  ...over,
});

describe("filters", () => {
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
const TODAY: Period = 7;
const desktop: Env = { mobile: false, today: TODAY, tours: TOURS };
const phone: Env = { mobile: true, today: TODAY, tours: TOURS };
const [LIST_HALF, LIST_FULL] = LIST_SNAPS;
const [DETAIL_HALF, DETAIL_FULL] = DETAIL_SNAPS;
const GALIBIER: Selection = { kind: "pass", slug: "col-du-galibier" };
const SELLARONDA: Selection = { kind: "tour", slug: "sellaronda" };
const BORMIO: Selection = { kind: "town", slug: "bormio" };

/**
 * The world read in, the way the hash adapter reads it in: the one path from
 * the empty state the server renders to a state with a link and a last visit
 * in it.
 */
const load = (
  hash: string,
  stored: StoredState = {},
  env: Env = desktop,
): AppState =>
  reduce(
    initialState(env.today),
    { hash: parseHash(hash), stored, type: "load" },
    env,
  );

/** A hash pasted into the address bar of the open page: the second `load`. */
const hashchange = (
  state: AppState,
  hash: string,
  env: Env = desktop,
): AppState =>
  reduce(state, { hash: parseHash(hash), stored: {}, type: "load" }, env);

/** A state with something to clear: a hover, a cursor, everything hidden. */
const busy = (over: Partial<AppState> = {}): AppState => ({
  ...initialState(TODAY),
  hovered: BORMIO,
  profileCursor: { lat: 46, lon: 9 },
  shown: { hiddenTours: [...TOURS], passes: false, towns: false },
  ...over,
});

describe("shown", () => {
  test("isShown and shownTourCount read the one value", () => {
    const shown = { hiddenTours: ["sellaronda"], passes: false, towns: true };
    expect(isShown(shown, "pass", "x")).toBe(false);
    expect(isShown(shown, "town", "x")).toBe(true);
    expect(isShown(shown, "tour", "sellaronda")).toBe(false);
    expect(isShown(shown, "tour", "stelvio-runde")).toBe(true);
    expect(shownTourCount(shown, TOURS.length)).toBe(1);
    expect(shownTourCount({ ...shown, hiddenTours: [] }, TOURS.length)).toBe(2);
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
    const shown = initialState(TODAY);
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
  const may: Env = { ...desktop, today: 5.5 };

  test("resolves the period as the link, then the visitor's choice, then today", () => {
    const stored = { period: 9 as const };
    expect(load("#t=7", stored, may).filters.period).toBe(7);
    expect(load("", stored, may).filters.period).toBe(9);
    expect(load("", {}, may).filters.period).toBe(5.5);
  });

  test("the visitor's own period is what was stored, never what the link says", () => {
    const s = load("#t=7", { period: 9 }, may);
    expect(s.ownPeriod).toBe(9);
    expect(load("#t=7", {}, may).ownPeriod).toBeNull();
    const chosen = reduce(s, { period: 3, type: "period" }, desktop);
    expect(chosen.filters.period).toBe(3);
    expect(chosen.ownPeriod).toBe(3);
  });

  test("a second load, as on hashchange, resolves the same way without a period", () => {
    const first = load("#t=7&q=gal", { period: 9 }, may);
    expect(first.filters.period).toBe(7);
    expect(first.loaded).toBe(true);
    const second = reduce(
      first,
      { hash: parseHash("#q=stel"), stored: { period: 9 }, type: "load" },
      may,
    );
    expect(second.filters.period).toBe(9);
    expect(second.filters.query).toBe("stel");
    const third = reduce(
      second,
      { hash: parseHash(""), stored: {}, type: "load" },
      may,
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
    const s = load("#tour=sellaronda", { tab: "pass" });
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
    const s = load("", stored);
    expect(s.shown).toEqual({
      hiddenTours: ["sellaronda"],
      passes: false,
      towns: true,
    });
    expect(s.tab).toBe("town");
  });

  test("the camera is requested by a later hash, never by the one that opened the page", () => {
    // The hash the page opened on is what the map is built from
    // (`cameraIntent`, lib/hash-adapter.ts). Requesting it a second time
    // would take the camera off the flight that frames what the link names,
    // and a link that names something carries a camera every time: the app
    // writes one into every hash it produces.
    const opened = load("#pass=col-du-galibier&z=9&c=45.06,6.41");
    expect(opened.selection).toEqual(GALIBIER);
    expect(opened.view).toEqual({
      ...DEFAULT_VIEW,
      lat: 45.06,
      lon: 6.41,
      zoom: 9,
    });
    expect(opened.requestedView).toBeNull();

    // The same link pasted into the address bar of the open page is a camera
    // the built map has to be moved to.
    const pasted = hashchange(opened, "#z=11&c=46.50,11.30");
    expect(pasted.requestedView).toEqual({
      ...DEFAULT_VIEW,
      lat: 46.5,
      lon: 11.3,
      zoom: 11,
    });
    expect(pasted.view).toEqual(pasted.requestedView!);
    // A hash without a camera asks for none.
    expect(hashchange(opened, "#t=6").requestedView).toBeNull();
  });

  test("before anything is read, the state the server renders", () => {
    const s = initialState(TODAY);
    expect(s.loaded).toBe(false);
    expect(s.selection).toBeNull();
    expect(s.filters).toEqual(filters({ period: 7 }));
    expect(s.shown).toEqual({ hiddenTours: [], passes: true, towns: true });
    expect(s.sheet.list.open).toBe(false);
  });
});

describe("reduce · the switches and the sheets", () => {
  const start = load("");

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
