import { describe, expect, test } from "bun:test";

import { ALL_SHOWN } from "@/lib/app-state";
import type { Selection, Shown } from "@/lib/app-state";
import type { Bounds } from "@/lib/geo";
import { DE } from "@/lib/i18n/dictionaries";
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
  older: 0,
  range: "Alpen",
  reason: null,
  season: [],
  status: "open",
  tour,
  window: "wie ihre Pässe",
  ...extra,
});

const townRow = (town: Town, extra: Partial<TownRow> = {}): TownRow => ({
  areas: [],
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
  fan: null,
  ghosts: [],
  hovered: null,
  overFan: false,
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
  w: DE,
  you: null,
  ...extra,
});

/** The slugs a `["in", ["get", "slug"], ["literal", […]]]` filter lets through. */
const filtered = (filter: unknown): string[] =>
  ((filter as unknown[])[2] as unknown[])[1] as string[];

const passMark = (scene: Scene, slug: string) =>
  scene.passes.features.find((f) => f.properties.slug === slug)?.properties;
const ghostMark = (scene: Scene) =>
  scene.ghosts.features.map((f) => f.properties);
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
      input({ shown: { ...ALL_SHOWN, destinations: false, passes: false } }),
    );
    expect(off.passes.features).toEqual([]);
    expect(off.towns.features).toEqual([]);
    // The lines of a switched-off kind leave the picture and hit-testing with it.
    expect(filtered(off.routes.filter)).toEqual([]);
  });

  test("the ascent lines are split by status, so a rideable one is drawn last", () => {
    const scene = buildScene(
      input({
        rows: {
          destination: [],
          pass: [
            passRow(galibier, { status: "closed" }),
            passRow(stelvio, { status: "open" }),
          ],
          tour: [],
          town: [],
        },
      }),
    );
    expect(filtered(scene.routes.byStatus.open)).toEqual(["stelvio"]);
    expect(filtered(scene.routes.byStatus.closed)).toEqual(["galibier"]);
    expect(filtered(scene.routes.byStatus.risky)).toEqual([]);
    // The rim, the dash and the hit area still carry every drawn ascent.
    expect(filtered(scene.routes.filter)).toEqual(["galibier", "stelvio"]);
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
      rank: 3,
      selected: 0,
      short: "Galibier",
      slug: "galibier",
      status: "risky",
      surface: "asphalt",
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

  test("the visitor's position is a point of its own, its accuracy in pixels at its latitude", () => {
    expect(buildScene(input()).you.features).toEqual([]);
    const at = buildScene(
      input({ you: { accuracy: 30, lat: 46.2, lon: 7.1 } }),
    );
    expect(at.you.features[0]?.geometry.coordinates).toEqual([7.1, 46.2]);
    // 30 m at 46.2° N: 78 271.5 m per pixel on the equator, times cos 46.2°.
    expect(at.you.features[0]?.properties?.halo).toBeCloseTo(
      30 / (78_271.517 * Math.cos((46.2 * Math.PI) / 180)),
      9,
    );
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

  test("a selected tour the filters leave out is drawn all the same", () => {
    const scene = buildScene(
      input({
        rows: { destination: [], pass: [], tour: [], town: [] },
        selection: { kind: "tour", slug: "marmotte" },
      }),
    );
    expect(filtered(scene.tours.filter)).toEqual(["marmotte"]);
    expect(scene.tours.state.marmotte).toEqual({ hovered: 0, selected: 1 });
    // Not one the map switch hides, though: that is the rider's own choice.
    const hidden = { ...ALL_SHOWN, hiddenTours: ["marmotte"] };
    expect(
      filtered(
        buildScene(
          input({
            rows: { destination: [], pass: [], tour: [], town: [] },
            selection: { kind: "tour", slug: "marmotte" },
            shown: hidden,
          }),
        ).tours.filter,
      ),
    ).toEqual([]);
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
      tags: [["hotels", "Bike-Hotels"]],
    });
  });

  describe("the roads the filters leave out", () => {
    const ghost = passRow(
      makePass("small", 30, { fame: 2, name: "Kleiner Pass", type: "spur" }),
      { status: "closed" },
    );

    test("are shadows: no status, no lines", () => {
      const scene = buildScene(input({ ghosts: [ghost] }));
      expect(ghostMark(scene)).toEqual([
        { fame: 2, name: "Kleiner Pass", slug: "small" },
      ]);
      expect(passMark(scene, "small")).toBeUndefined();
      expect(filtered(scene.routes.filter)).not.toContain("small");
      // Its ascents are the thin grey lines instead.
      expect(filtered(scene.routes.ghosts)).toEqual(["small"]);
    });

    test("are drawn whole once selected, lines and all", () => {
      const scene = buildScene(
        input({ ghosts: [ghost], selection: { kind: "pass", slug: "small" } }),
      );
      expect(ghostMark(scene)).toEqual([]);
      expect(filtered(scene.routes.ghosts)).toEqual([]);
      expect(passMark(scene, "small")).toMatchObject({
        selected: 1,
        status: "closed",
      });
      expect(filtered(scene.routes.filter)).toContain("small");
    });

    test("say why they are grey under the pointer", () => {
      const scene = buildScene(
        input({ ghosts: [ghost], hovered: { kind: "pass", slug: "small" } }),
      );
      expect(scene.hover.popup?.subtitle).toEndWith("· nicht im Filter");
      // Only the ring: the shadow under the pointer stays grey.
      expect(scene.hover.mark.features.map((f) => f.properties)).toEqual([
        { kind: "ghost" },
      ]);
    });

    test("stay shadows once selected, under the pointer too", () => {
      const scene = buildScene(
        input({
          ghosts: [ghost],
          hovered: { kind: "pass", slug: "small" },
          selection: { kind: "pass", slug: "small" },
        }),
      );
      expect(scene.hover.popup?.subtitle).toEndWith("· nicht im Filter");
      // Drawn whole, so the ring is a road's.
      expect(scene.hover.mark.features[0]?.properties).toEqual({
        kind: "pass",
      });
    });

    test("go with the roads when the roads are off the map", () => {
      const scene = buildScene(
        input({ ghosts: [ghost], shown: { ...ALL_SHOWN, passes: false } }),
      );
      expect(scene.ghosts.features).toEqual([]);
    });
  });

  test("a hovered road rings its summit and widens every ascent of it", () => {
    const scene = buildScene(
      input({ hovered: { kind: "pass", slug: "galibier" } }),
    );
    expect(scene.hover.mark.features[0]?.properties).toEqual({
      kind: "pass",
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
      tags: [["hairpins", "Kehrenbauwerk"]],
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
        label: { lat: 46.05, lon: 10.2 },
        outline: [
          [10, 46],
          [10.3, 46],
          [10.3, 46.1],
        ],
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
    // The outline the server drew around the members, as it is.
    expect(feature!.geometry.coordinates).toEqual([
      [
        [10, 46],
        [10.3, 46],
        [10.3, 46.1],
      ],
    ]);
    // The name stands on the spot the server found room for, with the same
    // properties – not on the centre, where the roads it is about are.
    const [label] = scene.destinationLabels.features;
    expect(label?.geometry.coordinates).toEqual([10.2, 46.05]);
    expect(label?.properties).toEqual(feature?.properties);
    // The popup stands on the outline's northernmost corner, not its centre.
    expect(scene.hover.popup).toEqual({
      anchor: [10.3, 46.1],
      name: "Testgebiet",
      subtitle: "1 von 1 Straßen gut",
      tags: [],
    });
    // Switched off, the area is neither drawn nor answers the hover.
    const off = buildScene(
      input({
        hovered: { kind: "destination", slug: "test" },
        rows: { destination: [area], pass: [], tour: [], town: [] },
        shown: { ...ALL_SHOWN, destinations: false },
      }),
    );
    expect(off.destinations.features).toEqual([]);
    expect(off.destinationLabels.features).toEqual([]);
    expect(off.hover.popup).toBeNull();
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
      subtitle: `ca. ${fmtUnit(174, "km")} · ${fmtUnit(5000, "hm")}`,
      tags: [],
    });
  });

  test("what the map does not draw answers no hover", () => {
    const scene = buildScene(
      input({
        hovered: { kind: "town", slug: "bormio" },
        shown: { ...ALL_SHOWN, destinations: false },
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

/** An area round `center` holding `passes`, as the server derives it. */
const areaRow = (
  slug: string,
  center: { lat: number; lon: number },
  passes: string[],
): DestinationRow => ({
  baseTowns: [],
  destination: {
    access: "",
    baseTowns: [],
    center,
    character: "",
    country: "IT",
    exclude: [],
    include: [],
    multiDay: "",
    name: slug,
    radiusKm: 30,
    slug,
  },
  favorite: false,
  members: {
    bounds: [9.5, 45.5, 11, 46.5],
    label: center,
    outline: [
      [9.5, 45.5],
      [11, 45.5],
      [11, 46.5],
    ],
    passes,
    tours: [],
    towns: [],
  },
  score: 3,
  season: [],
  text: "",
  verdict: {
    counts: { best: passes.length, closed: 0, good: 0, limited: 0 },
    peak: 1,
    total: passes.length,
    year: { best: null, cells: [] },
  },
});

const lit = (scene: Scene) =>
  scene.destinations.features
    .filter((f) => f.properties.hovered === 1)
    .map((f) => f.properties.slug);

describe("fan", () => {
  // The Galibier lies on the centre of an area it has to itself, and in a
  // farther one it shares with the Stelvio.
  const alone = areaRow("alone", { lat: 46, lon: 10 }, ["galibier"]);
  const shared = areaRow("shared", { lat: 46, lon: 10.6 }, [
    "galibier",
    "stelvio",
  ]);
  const rows = {
    destination: [alone, shared],
    pass: [passRow(galibier), passRow(stelvio)],
    tour: [],
    town: [],
  };

  test("a road opens the nearest area that has a fan, and its popup gives way", () => {
    const scene = buildScene(
      input({ hovered: { kind: "pass", slug: "galibier" }, rows }),
    );
    expect(scene.fanNext).toBe("shared");
    expect(scene.hover.popup).toBeNull();
    expect(lit(scene)).toEqual(["shared"]);
  });

  test("a road alone in its only area keeps its popup and lights its outline", () => {
    const scene = buildScene(
      input({
        hovered: { kind: "pass", slug: "galibier" },
        rows: { ...rows, destination: [alone] },
      }),
    );
    expect(scene.fanNext).toBeNull();
    expect(scene.hover.popup?.name).toBe("Col du Galibier");
    expect(lit(scene)).toEqual(["alone"]);
  });

  test("a phone opens no fan, not even for the area in the panel", () => {
    const scene = buildScene(
      input({
        env: { coarse: true },
        hovered: { kind: "pass", slug: "galibier" },
        rows,
        selection: { kind: "destination", slug: "shared" },
      }),
    );
    expect(scene.fanNext).toBeNull();
  });

  test("an open fan does not light its outline for a road outside it", () => {
    const outside = makePass("outside", 400);
    const scene = buildScene(
      input({
        fan: "shared",
        hovered: { kind: "pass", slug: "outside" },
        rows: { ...rows, pass: [...rows.pass, passRow(outside)] },
        selection: { kind: "destination", slug: "shared" },
      }),
    );
    expect(scene.fanNext).toBe("shared");
    expect(lit(scene)).toEqual([]);
    expect(scene.hover.popup?.name).toBe("outside");
  });
});
