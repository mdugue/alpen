import { describe, expect, test } from "bun:test";

import { ALL_SHOWN } from "@/lib/app-state";
import type { Selection, Shown } from "@/lib/app-state";
import type { Bounds } from "@/lib/geo";
import { buildScene } from "@/lib/map-scene";
import type { Scene, SceneInput } from "@/lib/map-scene";
import { ascentKey } from "@/lib/route-key";
import type { DestinationRow, PassRow, TourRow, TownRow } from "@/lib/rows";
import type { Pass, Tour, Town } from "@/lib/types";
import { fmtUnit } from "@/lib/utils";
import { makePass, makeTour, makeTown } from "@/test/fixtures";

const passRow = (pass: Pass, extra: Partial<PassRow> = {}): PassRow => ({
  favorite: false,
  pass,
  reason: null,
  season: [],
  status: "open",
  ...extra,
});

const tourRow = (tour: Tour, extra: Partial<TourRow> = {}): TourRow => ({
  favorite: false,
  range: "Alpen",
  reason: null,
  season: [],
  status: "open",
  tour,
  window: "wie ihre Pässe",
  ...extra,
});

const townRow = (town: Town, extra: Partial<TownRow> = {}): TownRow => ({
  favorite: false,
  town,
  ...extra,
});

const galibier = makePass("galibier", 0, {
  ascents: [
    { from: { lat: 45, lon: 6 }, label: "Nord" },
    { from: { lat: 45.2, lon: 6.2 }, label: "Süd" },
  ],
  elevation: 2642,
  name: "Col du Galibier",
  tags: ["hairpins"],
});
const stelvio = makePass("stelvio", 40, { name: "Stilfser Joch" });
const marmotte = makeTour("marmotte", ["galibier"], {
  elevationGain: 5000,
  km: 174,
  name: "La Marmotte",
});
const bormio = makeTown("bormio", 20, { name: "Bormio", tags: ["hotels"] });

const TOUR_BOUNDS: Record<string, Bounds> = { marmotte: [6, 45, 6.4, 45.4] };
const REACH: Record<string, [number, number][]> = {
  bormio: [
    [10, 46],
    [10.2, 46],
    [10.1, 46.2],
  ],
};

const input = (extra: Partial<SceneInput> = {}): SceneInput => ({
  env: { coarse: false },
  hovered: null,
  profileCursor: null,
  rows: {
    destination: [],
    pass: [passRow(galibier), passRow(stelvio)],
    tour: [tourRow(marmotte)],
    town: [townRow(bormio)],
  },
  selection: null,
  shown: ALL_SHOWN,
  tourBounds: TOUR_BOUNDS,
  townReach: REACH,
  ...extra,
});

/** The slugs a `["in", ["get", "slug"], ["literal", […]]]` filter lets through. */
const filtered = (filter: unknown): string[] =>
  ((filter as unknown[])[2] as unknown[])[1] as string[];

const passMark = (scene: Scene, slug: string) =>
  scene.passes.features.find((f) => f.properties.slug === slug)?.properties;
const townMark = (scene: Scene, slug: string) =>
  scene.towns.features.find((f) => f.properties.slug === slug)?.properties;

describe("what is drawn", () => {
  test("every row of a kind is a mark, and the switch takes all of them", () => {
    const on = buildScene(input());
    expect(on.passes.features.map((f) => f.properties.slug)).toEqual([
      "galibier",
      "stelvio",
    ]);
    expect(on.towns.features).toHaveLength(1);
    expect(filtered(on.routes.filter)).toEqual(["galibier", "stelvio"]);

    const off = buildScene(
      input({ shown: { ...ALL_SHOWN, passes: false, towns: false } }),
    );
    expect(off.passes.features).toEqual([]);
    expect(off.towns.features).toEqual([]);
    // The lines of a switched-off kind leave the picture and hit-testing with it.
    expect(filtered(off.routes.filter)).toEqual([]);
  });

  test("a hidden tour is out of the filter, a shown one in it", () => {
    expect(filtered(buildScene(input()).tours.filter)).toEqual(["marmotte"]);
    const hidden: Shown = { ...ALL_SHOWN, hiddenTours: ["marmotte"] };
    expect(filtered(buildScene(input({ shown: hidden })).tours.filter)).toEqual(
      [],
    );
  });

  test("a mark carries what the style paints it from", () => {
    const scene = buildScene(
      input({
        rows: {
          destination: [],
          pass: [passRow(galibier, { favorite: true, status: "risky" })],
          tour: [],
          town: [townRow(bormio)],
        },
      }),
    );
    expect(passMark(scene, "galibier")).toEqual({
      fame: 3,
      favorite: 1,
      name: "Col du Galibier",
      selected: 0,
      slug: "galibier",
      status: "risky",
    });
    expect(townMark(scene, "bormio")).toEqual({
      favorite: 0,
      name: "Bormio",
      selected: 0,
      slug: "bormio",
    });
  });

  test("the box around everything drawn is what a fit frames", () => {
    expect(buildScene(input()).bounds).not.toBeNull();
    const nothing = buildScene(
      input({
        rows: { destination: [], pass: [], tour: [], town: [] },
        shown: { ...ALL_SHOWN, passes: false },
      }),
    );
    expect(nothing.bounds).toBeNull();
  });

  test("the map opens on the home range, not on everything it draws", () => {
    const tourmalet = passRow({
      ...galibier,
      lat: 42.9,
      lon: 0.15,
      region: "Pyrenäen",
      slug: "tourmalet",
    });
    const scene = buildScene(
      input({
        rows: {
          destination: [],
          pass: [passRow(galibier), tourmalet],
          tour: [],
          town: [],
        },
      }),
    );
    // The fit button frames both; the opening frame holds the Alps alone.
    expect(scene.bounds![0]).toBeLessThan(1);
    expect(scene.opening).toEqual([
      galibier.lon,
      galibier.lat,
      galibier.lon,
      galibier.lat,
    ]);
    // A loop is at home where its passes are, not where its box happens to
    // lie: a Pyrenean loop stays out of the opening frame.
    const raid = tourRow(makeTour("raid", ["tourmalet"]), {
      range: "Pyrenäen",
    });
    const withLoop = buildScene(
      input({
        rows: {
          destination: [],
          pass: [passRow(galibier)],
          tour: [raid],
          town: [],
        },
        tourBounds: { raid: [-0.5, 42.8, 0.5, 43.2] },
      }),
    );
    expect(withLoop.opening).toEqual([
      galibier.lon,
      galibier.lat,
      galibier.lon,
      galibier.lat,
    ]);
    // With nothing of the home range drawn – a Pyrenees chip pressed, say –
    // the opening frame is what is drawn.
    const away = buildScene(
      input({
        rows: { destination: [], pass: [tourmalet], tour: [], town: [] },
      }),
    );
    expect(away.opening).toEqual(away.bounds);
  });

  test("the profile cursor is a point of its own", () => {
    expect(buildScene(input()).cursor.features).toEqual([]);
    const at = buildScene(input({ profileCursor: { lat: 45.1, lon: 6.1 } }));
    expect(at.cursor.features[0]?.geometry.coordinates).toEqual([6.1, 45.1]);
  });
});

describe("selection", () => {
  const selected: Selection = { kind: "pass", slug: "galibier" };

  test("the selected pass says so in its mark and on every ascent", () => {
    const scene = buildScene(input({ selection: selected }));
    expect(passMark(scene, "galibier")?.selected).toBe(1);
    expect(passMark(scene, "stelvio")?.selected).toBe(0);
    expect(scene.routes.state[ascentKey("galibier", 0)]?.selected).toBe(1);
    expect(scene.routes.state[ascentKey("galibier", 1)]?.selected).toBe(1);
    expect(scene.routes.state[ascentKey("stelvio", 0)]?.selected).toBe(0);
  });

  test("every ascent carries its road's status", () => {
    const scene = buildScene(
      input({
        rows: {
          destination: [],
          pass: [passRow(galibier, { status: "closed" })],
          tour: [],
          town: [],
        },
      }),
    );
    expect(scene.routes.state[ascentKey("galibier", 0)]).toEqual({
      hovered: 0,
      selected: 0,
      status: "closed",
    });
  });

  test("a selected tour is state, not geometry", () => {
    const scene = buildScene(
      input({ selection: { kind: "tour", slug: "marmotte" } }),
    );
    expect(scene.tours.state.marmotte).toEqual({ hovered: 0, selected: 1 });
  });
});

/**
 * The hover surfaces. There is one `hovered` value and one scene built from
 * it, so a row hovered in the list and a mark hovered on the map cannot draw
 * different things – which they did, for as long as the map kept a hover
 * state of its own: the hull below was the one a list hover never drew.
 */
describe("hover", () => {
  test("a hovered town rings its mark and outlines what it reaches", () => {
    const scene = buildScene(
      input({ hovered: { kind: "town", slug: "bormio" } }),
    );
    expect(scene.hover.mark.features[0]?.properties).toEqual({ kind: "town" });
    expect(scene.hover.hull).toBe(REACH.bormio!);
    expect(scene.hover.popup).toEqual({
      anchor: [bormio.lon, bormio.lat],
      name: "Bormio",
      subtitle: null,
      tags: ["hotels"],
    });
  });

  test("a hovered road rings its summit and widens every ascent of it", () => {
    const scene = buildScene(
      input({ hovered: { kind: "pass", slug: "galibier" } }),
    );
    expect(scene.hover.mark.features[0]?.properties).toEqual({
      fame: 3,
      favorite: 0,
      kind: "pass",
      selected: 0,
      status: "open",
    });
    expect(scene.routes.state[ascentKey("galibier", 0)]?.hovered).toBe(1);
    expect(scene.routes.state[ascentKey("galibier", 1)]?.hovered).toBe(1);
    expect(scene.routes.state[ascentKey("stelvio", 0)]?.hovered).toBe(0);
    expect(scene.hover.hull).toBeNull();
    expect(scene.hover.popup).toEqual({
      anchor: [galibier.lon, galibier.lat],
      name: "Col du Galibier",
      // A road says how high it goes; only a pass keeps its type to itself.
      subtitle: fmtUnit(2642, "m"),
      tags: ["hairpins"],
    });
  });

  test("a road the filter has dropped keeps nothing highlighted", () => {
    // The bug two hover states left behind: the pointer left a row that the
    // next keystroke filtered away, and its ascents stayed wide.
    const scene = buildScene(
      input({
        hovered: { kind: "pass", slug: "galibier" },
        rows: { destination: [], pass: [passRow(stelvio)], tour: [], town: [] },
      }),
    );
    expect(scene.hover.mark.features).toEqual([]);
    expect(scene.hover.popup).toBeNull();
    expect(Object.keys(scene.routes.state)).toEqual([ascentKey("stelvio", 0)]);
  });

  test("a destination is a ring under everything, lit when hovered or selected", () => {
    const area: DestinationRow = {
      baseTowns: [],
      destination: {
        access: "",
        baseTowns: [],
        center: { lat: 46, lon: 10 },
        character: "",
        country: "IT",
        exclude: [],
        include: [],
        multiDay: "",
        name: "Testgebiet",
        radiusKm: 30,
        slug: "test",
      },
      favorite: false,
      members: {
        bounds: [10, 46, 10.3, 46.1],
        passes: ["galibier"],
        tours: [],
        towns: [],
      },
      score: 3,
      season: [],
      text: "1 von 1 Straßen gut",
      verdict: {
        counts: { best: 1, closed: 0, good: 0, limited: 0 },
        peak: 1,
        total: 1,
        year: { best: null, cells: [] },
      },
    };
    const scene = buildScene(
      input({
        hovered: { kind: "destination", slug: "test" },
        rows: { destination: [area], pass: [], tour: [], town: [] },
      }),
    );
    const [feature] = scene.destinations.features;
    expect(feature?.properties).toMatchObject({
      hovered: 1,
      name: "Testgebiet",
      selected: 0,
      share: 1,
      slug: "test",
    });
    // A closed ring of 49 points, 30 km either side of the centre.
    const ring = feature!.geometry.coordinates[0]!;
    expect(ring).toHaveLength(49);
    expect(ring[0]).toEqual(ring.at(-1));
    expect(ring[0]![0]).toBeGreaterThan(10.3);
    expect(scene.hover.popup).toEqual({
      anchor: [10, 46],
      name: "Testgebiet",
      subtitle: "1 von 1 Straßen gut",
      tags: [],
    });
  });

  test("a hovered tour is labelled at the centre of its box", () => {
    const scene = buildScene(
      input({ hovered: { kind: "tour", slug: "marmotte" } }),
    );
    expect(scene.tours.state.marmotte?.hovered).toBe(1);
    // A loop has no point of its own, so nothing is ringed.
    expect(scene.hover.mark.features).toEqual([]);
    expect(scene.hover.popup).toEqual({
      anchor: [6.2, 45.2],
      name: "La Marmotte",
      subtitle: "ca. 174 km · 5.000 hm",
      tags: [],
    });
  });

  test("what the map does not draw answers no hover", () => {
    const scene = buildScene(
      input({
        hovered: { kind: "town", slug: "bormio" },
        shown: { ...ALL_SHOWN, towns: false },
      }),
    );
    expect(scene.hover.hull).toBeNull();
    expect(scene.hover.mark.features).toEqual([]);
    expect(scene.hover.popup).toBeNull();
  });

  test("a finger gets the ring and the hull, never a label", () => {
    const scene = buildScene(
      input({
        env: { coarse: true },
        hovered: { kind: "town", slug: "bormio" },
      }),
    );
    expect(scene.hover.popup).toBeNull();
    expect(scene.hover.hull).toBe(REACH.bormio!);
  });
});
