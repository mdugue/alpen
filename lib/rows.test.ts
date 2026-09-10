import { describe, expect, test } from "bun:test";

import { DEFAULT_FILTERS } from "@/lib/app-state";
import type { Filters } from "@/lib/app-state";
import {
  barTotal,
  buildPassRows,
  buildTourRows,
  buildTownRows,
  sortPassRows,
  statusHistogram,
} from "@/lib/rows";
import { indexBySlug, PERIODS } from "@/lib/status";
import type { ClimateBucket, ClimateYear, Pass, Tour, Town } from "@/lib/types";

const filters = (over: Partial<Filters> = {}): Filters => ({
  ...DEFAULT_FILTERS,
  period: 8,
  ...over,
});
const never = () => false;

const pass = (over: Partial<Pass> & { slug: string }): Pass => ({
  ascents: [],
  beauty: 3,
  classicAscent: "",
  country: "AT",
  difficulty: 3,
  elevation: 1500,
  fame: 3,
  lat: 47,
  lon: 12,
  name: over.slug,
  note: "",
  region: "Ostalpen",
  season: null,
  traffic: 3,
  ...over,
});

const passes = [
  pass({
    elevation: 2500,
    fame: 5,
    name: "Hochpass",
    region: "Westalpen",
    slug: "hoch",
  }),
  pass({ elevation: 1500, fame: 3, name: "Mittelpass", slug: "mittel" }),
  pass({
    elevation: 1200,
    fame: 1,
    name: "Winterpass",
    season: { closes: 10, opens: 6 },
    slug: "winter",
  }),
];
const index = indexBySlug(passes);

const tour = (over: Partial<Tour> & { slug: string }): Tour => ({
  color: "#000",
  description: "",
  elevationGain: 2000,
  km: 100,
  name: over.slug,
  passes: [],
  season: "",
  waypoints: [],
  ...over,
});
const tours = [
  tour({
    elevationGain: 1000,
    name: "Kurze Runde",
    passes: ["mittel"],
    slug: "kurz",
  }),
  tour({
    elevationGain: 3000,
    name: "Lange Runde",
    passes: ["mittel", "winter"],
    slug: "lang",
  }),
];

const towns: Town[] = [
  {
    country: "IT",
    lat: 46.4,
    lon: 10.3,
    name: "Bormio",
    slug: "bormio",
    tags: ["hub", "passes"],
    why: "Stelvio vor der Tür",
  },
  {
    country: "IT",
    lat: 45.7,
    lon: 7.3,
    name: "Aosta",
    slug: "aosta",
    tags: ["passes", "train"],
    why: "Vier Pässe im Umkreis",
  },
];

const snowy = (snowPct: number): ClimateYear =>
  PERIODS.map(
    () =>
      ({
        frostPct: 0,
        snowPct,
        tmax: 10,
        tmin: 2,
        wetPct: 20,
      }) satisfies ClimateBucket,
  );

const periodIndexOf = (t: number) => PERIODS.indexOf(t);

describe("buildPassRows", () => {
  test("filters by elevation, fame, search and favourites", () => {
    expect(
      buildPassRows(passes, filters({ minElevation: 2000 }), never).map(
        (r) => r.pass.slug,
      ),
    ).toEqual(["hoch"]);
    expect(
      buildPassRows(passes, filters({ minFame: 4 }), never).map(
        (r) => r.pass.slug,
      ),
    ).toEqual(["hoch"]);
    expect(
      buildPassRows(passes, filters({ query: "winter" }), never).map(
        (r) => r.pass.slug,
      ),
    ).toEqual(["winter"]);
    expect(
      buildPassRows(passes, filters({ query: "westalpen" }), never).map(
        (r) => r.pass.slug,
      ),
    ).toEqual(["hoch"]);
    expect(
      buildPassRows(passes, filters({ favoritesOnly: true }), never),
    ).toHaveLength(0);
    expect(
      buildPassRows(
        passes,
        filters({ favoritesOnly: true }),
        (_, slug) => slug === "mittel",
      ).map((r) => r.pass.slug),
    ).toEqual(["mittel"]);
  });

  // Early April: the 2,500 m pass is weather-dependent by altitude, the
  // 1,500 m one open, the pass with a June–October window closed.
  test("filters by status for the chosen half-month", () => {
    expect(
      buildPassRows(
        passes,
        filters({ period: 4, status: ["open"] }),
        never,
      ).map((r) => r.pass.slug),
    ).toEqual(["mittel"]);
    expect(
      buildPassRows(
        passes,
        filters({ period: 4, status: ["closed"] }),
        never,
      ).map((r) => r.pass.slug),
    ).toEqual(["winter"]);
  });

  test("every row carries its 24 verdicts and the climate series is applied", () => {
    const [row] = buildPassRows([passes[1]!], filters(), never);
    expect(row!.season).toHaveLength(24);
    expect(row!.status).toBe("open");
    const withSnow = buildPassRows([passes[1]!], filters(), never, {
      climate: { mittel: snowy(30) },
    });
    expect(withSnow[0]!.status).toBe("risky");
    expect(withSnow[0]!.reason).toBe("snow");
    expect(withSnow[0]!.season.every((s) => s === "limited")).toBe(true);
  });
});

describe("plan 05 criteria", () => {
  const mixed = [
    ...passes,
    pass({
      beauty: 5,
      country: "CH/IT",
      difficulty: 5,
      name: "Grenzpass",
      region: "Zentralalpen",
      slug: "grenze",
      traffic: 1,
    }),
  ];
  const pick = (over: Partial<Filters>) =>
    buildPassRows(mixed, filters(over), never).map((r) => r.pass.slug);

  test("difficulty window, traffic and beauty on passes", () => {
    expect(pick({ difficulty: [4, 5] })).toEqual(["grenze"]);
    expect(pick({ difficulty: [1, 2] })).toEqual([]);
    expect(pick({ maxTraffic: 1 })).toEqual(["grenze"]);
    expect(pick({ minBeauty: 4 })).toEqual(["grenze"]);
  });

  test("search folds accents and matches every token", () => {
    const umlaut = [pass({ name: "Großer Sankt Bernhard", slug: "gross" })];
    expect(
      buildPassRows(umlaut, filters({ query: "grosser bernhard" }), never),
    ).toHaveLength(1);
    expect(
      buildPassRows(umlaut, filters({ query: "bernhard klein" }), never),
    ).toHaveLength(0);
  });

  // "kurz" crosses the 1,500 m pass only, "lang" the 1,500 m and the 1,200 m one.
  test("a tour needs one pass that clears the lower bounds", () => {
    const rows = (over: Partial<Filters>) =>
      buildTourRows(tours, index, filters(over), never).map((r) => r.tour.slug);
    expect(rows({ minElevation: 1400 })).toEqual(["lang", "kurz"]);
    expect(rows({ minElevation: 2000 })).toEqual([]);
    expect(rows({ minFame: 3 })).toEqual(["lang", "kurz"]);
    // Found through the name of a pass it crosses.
    expect(rows({ query: "winterpass" })).toEqual(["lang"]);
  });

  test("every pass of a tour has to respect the upper bounds", () => {
    const hard = [
      ...passes,
      pass({ difficulty: 5, name: "Steilpass", slug: "steil", traffic: 5 }),
    ];
    const hardIndex = indexBySlug(hard);
    const withHard = [
      ...tours,
      tour({ name: "Harte Runde", passes: ["mittel", "steil"], slug: "hart" }),
    ];
    const rows = (over: Partial<Filters>) =>
      buildTourRows(withHard, hardIndex, filters(over), never).map(
        (r) => r.tour.slug,
      );
    expect(rows({})).toContain("hart");
    expect(rows({ difficulty: [1, 3] })).toEqual(["lang", "kurz"]);
    expect(rows({ maxTraffic: 3 })).toEqual(["lang", "kurz"]);
  });

  test("towns see only search and favourites", () => {
    expect(
      buildTownRows(towns, filters({ maxTraffic: 1, minBeauty: 5 }), never),
    ).toHaveLength(2);
  });
});

describe("buildTourRows", () => {
  test("status comes from the passes, sorted by elevation gain", () => {
    const rows = buildTourRows(tours, index, filters(), never);
    expect(rows.map((r) => r.tour.slug)).toEqual(["lang", "kurz"]);
    expect(rows.map((r) => r.status)).toEqual(["open", "open"]);
    expect(
      buildTourRows(tours, index, filters({ period: 4 }), never).map(
        (r) => r.status,
      ),
    ).toEqual(["closed", "open"]);
  });

  test("search matches name and description, the status filter applies", () => {
    expect(
      buildTourRows(tours, index, filters({ query: "kurze" }), never).map(
        (r) => r.tour.slug,
      ),
    ).toEqual(["kurz"]);
    expect(
      buildTourRows(
        tours,
        index,
        filters({ period: 4, status: ["open"] }),
        never,
      ).map((r) => r.tour.slug),
    ).toEqual(["kurz"]);
  });

  test("the climate series reaches the tour verdict", () => {
    const rows = buildTourRows(tours, index, filters(), never, {
      climate: { mittel: snowy(40) },
    });
    expect(rows.every((r) => r.status === "risky")).toBe(true);
  });
});

describe("buildTownRows", () => {
  test("sorted by name, searchable, favourites only", () => {
    expect(
      buildTownRows(towns, filters(), never).map((r) => r.town.slug),
    ).toEqual(["aosta", "bormio"]);
    expect(
      buildTownRows(towns, filters({ query: "stelvio" }), never).map(
        (r) => r.town.slug,
      ),
    ).toEqual(["bormio"]);
    expect(
      buildTownRows(towns, filters({ favoritesOnly: true }), never),
    ).toHaveLength(0);
  });
});

describe("sortPassRows", () => {
  const rows = buildPassRows(passes, filters({ period: 4 }), never);

  test("each key puts the best value first, name breaks ties", () => {
    expect(sortPassRows(rows, "elevation").map((r) => r.pass.slug)).toEqual([
      "hoch",
      "mittel",
      "winter",
    ]);
    expect(sortPassRows(rows, "name").map((r) => r.pass.slug)).toEqual([
      "hoch",
      "mittel",
      "winter",
    ]);
    expect(sortPassRows(rows, "fame").map((r) => r.pass.slug)).toEqual([
      "hoch",
      "mittel",
      "winter",
    ]);
    expect(sortPassRows(rows, "status").map((r) => r.status)).toEqual([
      "open",
      "risky",
      "closed",
    ]);
  });

  test("does not mutate the input", () => {
    const before = rows.map((r) => r.pass.slug);
    sortPassRows(rows, "name");
    expect(rows.map((r) => r.pass.slug)).toEqual(before);
  });

  test("is stable for equal values", () => {
    const twins = [
      pass({ name: "B", slug: "b" }),
      pass({ name: "A", slug: "a" }),
    ];
    const sorted = sortPassRows(
      buildPassRows(twins, filters(), never),
      "beauty",
    );
    expect(sorted.map((r) => r.pass.slug)).toEqual(["a", "b"]);
  });
});

describe("statusHistogram", () => {
  test("one bar per half-month, counting every matching pass", () => {
    const bars = statusHistogram(passes, filters(), never);
    expect(bars).toHaveLength(24);
    expect(bars.map((b) => b.period)).toEqual(PERIODS);
    for (const b of bars) expect(barTotal(b)).toBe(passes.length);
    expect(bars[periodIndexOf(4)]).toMatchObject({
      best: 1,
      closed: 1,
      limited: 1,
    });
  });

  test("the status filter is ignored, the other filters are not", () => {
    const bars = statusHistogram(
      passes,
      filters({ minFame: 4, status: ["open"] }),
      never,
    );
    for (const b of bars) expect(barTotal(b)).toBe(1);
  });

  test("no matching pass leaves 24 empty bars rather than nothing", () => {
    const bars = statusHistogram(
      passes,
      filters({ query: "gibtsnicht" }),
      never,
    );
    expect(bars).toHaveLength(24);
    expect(bars.every((b) => barTotal(b) === 0)).toBe(true);
  });

  test("the climate series moves passes from open to weather-dependent", () => {
    const bars = statusHistogram(passes, filters(), never, {
      climate: { hoch: snowy(30), mittel: snowy(30), winter: snowy(30) },
    });
    expect(bars.every((b) => b.best === 0 && b.good === 0)).toBe(true);
  });
});
