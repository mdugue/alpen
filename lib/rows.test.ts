import { describe, expect, test } from "bun:test";

import { DEFAULT_FILTERS } from "@/lib/app-state";
import type { Filters } from "@/lib/app-state";
import {
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
  name: over.slug,
  country: "AT",
  region: "Ostalpen",
  lat: 47,
  lon: 12,
  elevation: 1500,
  classicAscent: "",
  beauty: 3,
  fame: 3,
  difficulty: 3,
  traffic: 3,
  season: null,
  note: "",
  ascents: [],
  ...over,
});

const passes = [
  pass({
    slug: "hoch",
    name: "Hochpass",
    elevation: 2500,
    fame: 5,
    region: "Westalpen",
  }),
  pass({ slug: "mittel", name: "Mittelpass", elevation: 1500, fame: 3 }),
  pass({
    slug: "winter",
    name: "Winterpass",
    elevation: 1200,
    fame: 1,
    season: { opens: 6, closes: 10 },
  }),
];
const index = indexBySlug(passes);

const tour = (over: Partial<Tour> & { slug: string }): Tour => ({
  name: over.slug,
  color: "#000",
  km: 100,
  elevationGain: 2000,
  passes: [],
  season: "",
  description: "",
  waypoints: [],
  ...over,
});
const tours = [
  tour({
    slug: "kurz",
    name: "Kurze Runde",
    passes: ["mittel"],
    elevationGain: 1000,
  }),
  tour({
    slug: "lang",
    name: "Lange Runde",
    passes: ["mittel", "winter"],
    elevationGain: 3000,
  }),
];

const towns: Town[] = [
  {
    slug: "bormio",
    name: "Bormio",
    country: "IT",
    lat: 46.4,
    lon: 10.3,
    why: "Stelvio vor der Tür",
  },
  {
    slug: "aosta",
    name: "Aosta",
    country: "IT",
    lat: 45.7,
    lon: 7.3,
    why: "Vier Pässe im Umkreis",
  },
];

const snowy = (snowPct: number): ClimateYear =>
  PERIODS.map(
    () =>
      ({
        tmax: 10,
        tmin: 2,
        snowPct,
        frostPct: 0,
        wetPct: 20,
      }) satisfies ClimateBucket,
  );

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
      mittel: snowy(30),
    });
    expect(withSnow[0]!.status).toBe("risky");
    expect(withSnow[0]!.season.every((s) => s === "risky")).toBe(true);
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
      mittel: snowy(40),
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
      pass({ slug: "b", name: "B" }),
      pass({ slug: "a", name: "A" }),
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
    for (const b of bars)
      expect(b.open + b.risky + b.closed).toBe(passes.length);
    expect(bars[periodIndexOf(4)]).toMatchObject({
      open: 1,
      risky: 1,
      closed: 1,
    });
  });

  test("the status filter is ignored, the other filters are not", () => {
    const bars = statusHistogram(
      passes,
      filters({ status: ["open"], minFame: 4 }),
      never,
    );
    for (const b of bars) expect(b.open + b.risky + b.closed).toBe(1);
  });

  test("no matching pass leaves 24 empty bars rather than nothing", () => {
    const bars = statusHistogram(
      passes,
      filters({ query: "gibtsnicht" }),
      never,
    );
    expect(bars).toHaveLength(24);
    expect(bars.every((b) => b.open + b.risky + b.closed === 0)).toBe(true);
  });

  test("the climate series moves passes from open to weather-dependent", () => {
    const bars = statusHistogram(passes, filters(), never, {
      mittel: snowy(30),
      hoch: snowy(30),
      winter: snowy(30),
    });
    expect(bars.every((b) => b.open === 0)).toBe(true);
  });
});

const periodIndexOf = (t: number) => PERIODS.indexOf(t);
