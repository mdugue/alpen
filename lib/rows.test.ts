import { describe, expect, test } from "bun:test";

import { DEFAULT_FILTERS } from "@/lib/app-state";
import type { Filters } from "@/lib/app-state";
import { membersOf } from "@/lib/destination";
import { DE } from "@/lib/i18n/dictionaries";
import { PERIODS } from "@/lib/period";
import {
  barTotal,
  buildDestinationRows,
  buildPassRows,
  buildTourRows,
  buildTownRows,
  currentBar,
  facetCount,
  nestTowns,
  tabCounts,
  rowBlocks,
  ROWS_PER_BLOCK,
  seasonBand,
  sortPassRows,
} from "@/lib/rows";
import type { AreaGroup, ListInputs } from "@/lib/rows";
import {
  cellAt,
  indexBySlug,
  passYear,
  signalsOf,
  tourYear,
} from "@/lib/status";
import type { Signals, Year, Years } from "@/lib/status";
import type {
  ClimateBucket,
  ClimateYear,
  Destination,
  Pass,
  Tour,
  Town,
} from "@/lib/types";

const filters = (over: Partial<Filters> = {}): Filters => ({
  ...DEFAULT_FILTERS,
  period: 8,
  ...over,
});
const never = () => false;
type Favorite = (kind: string, slug: string) => boolean;
/** What a list is built from besides the filters (`ListInputs`), in German. */
const inputs = (
  years: Years,
  isFavorite: Favorite = never,
  signals: Signals = {},
): ListInputs => ({ isFavorite, signals, w: DE, years });
/** The years of no road and no loop – what a list of towns is built with. */
const NO_YEARS: Years = { passes: {}, tours: {} };

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
  surface: "asphalt",
  traffic: 3,
  type: "pass",
  ...over,
});

const passes = [
  pass({
    elevation: 2500,
    fame: 5,
    name: "Hochpass",
    region: "Westalpen",
    slug: "hoch",
    surface: "asphalt",
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
  note: "",
  passes: [],
  season: null,
  surface: "asphalt",
  waypoints: [],
  ...over,
});
const tours = [
  tour({
    elevationGain: 1000,
    name: "Kurze Runde",
    passes: ["mittel"],
    slug: "kurz",
    surface: "asphalt",
  }),
  tour({
    elevationGain: 3000,
    name: "Lange Runde",
    passes: ["mittel", "winter"],
    slug: "lang",
  }),
];

/**
 * The years the page hands down, built exactly as `getYears` (lib/data.ts)
 * does. Every builder below reads them instead of grading a pass itself, so a
 * test that changes the signals has to rebuild them – which is the point: the
 * row and the strip can no longer be fed two different opinions of one pass.
 */
const yearsOf = (
  list: Pass[],
  tourList: Tour[] = [],
  signals?: Signals,
): Years => {
  const p: Record<string, Year> = {};
  for (const x of list) p[x.slug] = passYear(x, signalsOf(signals, x.slug));
  const t: Record<string, Year> = {};
  for (const x of tourList) t[x.slug] = tourYear(x, p);
  return { passes: p, tours: t };
};
const years = yearsOf(passes, tours);
/** The slugs of the tour rows a filter leaves, in list order. */
const tourSlugs = (over: Partial<Filters>) =>
  buildTourRows(tours, index, filters(over), inputs(years)).map(
    (r) => r.tour.slug,
  );

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

/** A flat year of one bucket, with the fields under test overridden. */
const bucketed = (over: Partial<ClimateBucket>): ClimateYear =>
  PERIODS.map(
    () =>
      ({
        frostPct: 0,
        snowPct: 0,
        tmax: 10,
        tmin: 2,
        wetPct: 20,
        ...over,
      }) satisfies ClimateBucket,
  );

const periodIndexOf = (t: number) => PERIODS.indexOf(t);

describe("buildPassRows", () => {
  test("filters by elevation, fame, search and favourites", () => {
    expect(
      buildPassRows(passes, filters({ minElevation: 2000 }), inputs(years)).map(
        (r) => r.pass.slug,
      ),
    ).toEqual(["hoch"]);
    expect(
      buildPassRows(passes, filters({ minFame: 4 }), inputs(years)).map(
        (r) => r.pass.slug,
      ),
    ).toEqual(["hoch"]);
    expect(
      buildPassRows(passes, filters({ query: "winter" }), inputs(years)).map(
        (r) => r.pass.slug,
      ),
    ).toEqual(["winter"]);
    expect(
      buildPassRows(passes, filters({ query: "westalpen" }), inputs(years)).map(
        (r) => r.pass.slug,
      ),
    ).toEqual(["hoch"]);
    expect(
      buildPassRows(passes, filters({ favoritesOnly: true }), inputs(years)),
    ).toHaveLength(0);
    expect(
      buildPassRows(
        passes,
        filters({ favoritesOnly: true }),
        inputs(years, (_, slug) => slug === "mittel"),
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
        inputs(years),
      ).map((r) => r.pass.slug),
    ).toEqual(["mittel"]);
    expect(
      buildPassRows(
        passes,
        filters({ period: 4, status: ["closed"] }),
        inputs(years),
      ).map((r) => r.pass.slug),
    ).toEqual(["winter"]);
  });

  test("every row carries its 24 cells and the climate series is applied", () => {
    const [row] = buildPassRows([passes[1]!], filters(), inputs(years));
    expect(row!.season).toHaveLength(24);
    expect(row!.status).toBe("open");
    const signals = { climate: { mittel: snowy(30) } };
    const withSnow = buildPassRows(
      [passes[1]!],
      filters(),
      inputs(yearsOf(passes, tours, signals), never, signals),
    );
    expect(withSnow[0]!.status).toBe("risky");
    expect(withSnow[0]!.reason).toBe("snow");
    expect(withSnow[0]!.season.every((c) => c.grade === "limited")).toBe(true);
  });

  // The acceptance criterion of plan 15: one `Year` per pass, not one per
  // reader. Identity, not equality – two builders that agree today but grade
  // separately would drift the moment one of them changes.
  test("the row, the histogram and the strip read one and the same year", () => {
    // A value only the `Year` can supply: planted in the year, then looked for
    // in each reader. Equality would pass for a reader that graded the pass
    // again and happened to agree; only a value the heuristic would never
    // produce tells the two apart.
    const own = yearsOf([passes[1]!]);
    const { cells } = own.passes.mittel!;
    cells[0] = {
      grade: "limited",
      reasons: ["heat"],
      snowy: true,
      status: "risky",
    };

    const [row] = buildPassRows(
      [passes[1]!],
      filters({ period: 1 }),
      inputs(own),
    );
    expect(row!.status).toBe("risky");
    expect(row!.reason).toBe("heat");
    // The strip is handed `row.season` unchanged (`PassList` → `SeasonStrip`),
    // so the row and the strip are the same 24 cells by construction, not by
    // two builders agreeing.
    expect(row!.season).toBe(cells);
    expect(row!.season[0]!.grade).toBe("limited");

    const { bars } = seasonBand([passes[1]!], filters(), inputs(own));
    expect(bars[0]).toMatchObject({ best: 0, good: 0, limited: 1 });

    // And the detail panel, which reads the cell through `cellAt`.
    expect(cellAt(own.passes.mittel, 1)).toBe(cells[0]);
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
    buildPassRows(mixed, filters(over), inputs(yearsOf(mixed))).map(
      (r) => r.pass.slug,
    );

  test("difficulty window, traffic and beauty on passes", () => {
    expect(pick({ difficulty: [4, 5] })).toEqual(["grenze"]);
    expect(pick({ difficulty: [1, 2] })).toEqual([]);
    expect(pick({ maxTraffic: 1 })).toEqual(["grenze"]);
    expect(pick({ minBeauty: 4 })).toEqual(["grenze"]);
  });

  test("search folds accents and matches every token", () => {
    const umlaut = [pass({ name: "Großer Sankt Bernhard", slug: "gross" })];
    expect(
      buildPassRows(
        umlaut,
        filters({ query: "grosser bernhard" }),
        inputs(yearsOf(umlaut)),
      ),
    ).toHaveLength(1);
    expect(
      buildPassRows(
        umlaut,
        filters({ query: "bernhard klein" }),
        inputs(yearsOf(umlaut)),
      ),
    ).toHaveLength(0);
  });

  // "kurz" crosses the 1,500 m pass only, "lang" the 1,500 m and the 1,200 m one.
  test("a tour needs one pass that clears the lower bounds", () => {
    expect(tourSlugs({ minElevation: 1400 })).toEqual(["lang", "kurz"]);
    expect(tourSlugs({ minElevation: 2000 })).toEqual([]);
    expect(tourSlugs({ minFame: 3 })).toEqual(["lang", "kurz"]);
    // Found through the name of a pass it crosses.
    expect(tourSlugs({ query: "winterpass" })).toEqual(["lang"]);
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
      buildTourRows(
        withHard,
        hardIndex,
        filters(over),
        inputs(yearsOf(hard, withHard)),
      ).map((r) => r.tour.slug);
    expect(rows({})).toContain("hart");
    expect(rows({ difficulty: [1, 3] })).toEqual(["lang", "kurz"]);
    expect(rows({ maxTraffic: 3 })).toEqual(["lang", "kurz"]);
  });

  test("towns see search, favourites and the range, nothing else", () => {
    expect(
      buildTownRows(
        towns,
        {},
        filters({ maxTraffic: 1, minBeauty: 5 }),
        inputs(NO_YEARS),
      ),
    ).toHaveLength(2);
    const ranges = { aosta: "Alpen" as const };
    // Bormio has no road in reach here, so it has no range: listed while
    // nothing is asked, gone once a range is – it cannot be "a Jura town".
    expect(
      buildTownRows(towns, ranges, filters(), inputs(NO_YEARS)).map(
        (r) => r.town.slug,
      ),
    ).toEqual(["aosta", "bormio"]);
    expect(
      buildTownRows(
        towns,
        ranges,
        filters({ ranges: ["Alpen"] }),
        inputs(NO_YEARS),
      ).map((r) => r.town.slug),
    ).toEqual(["aosta"]);
    expect(
      buildTownRows(
        towns,
        ranges,
        filters({ ranges: ["Jura"] }),
        inputs(NO_YEARS),
      ),
    ).toEqual([]);
    // The range word finds the town, through the range it was handed.
    expect(
      buildTownRows(
        towns,
        ranges,
        filters({ query: "alpen" }),
        inputs(NO_YEARS),
      ).map((r) => r.town.slug),
    ).toEqual(["aosta"]);
  });
});

/** A uniform year, so the chosen half-month reads the same bucket. */
const year = (over: Partial<ClimateBucket>): ClimateYear =>
  PERIODS.map(() => ({
    frostPct: 0,
    snowPct: 0,
    tmax: 20,
    tmin: 8,
    wetPct: 20,
    ...over,
  }));

describe("plan 13 summer filters", () => {
  // "mittel" is at 1 500 m; a valley at 500 m adds 6,5 °C to the summit value.
  const valleys = { mittel: 500 };
  const slugs = (
    over: Partial<Filters>,
    climate: Record<string, ClimateYear>,
    withValleys = true,
  ) => {
    const signals = { climate, valleys: withValleys ? valleys : {} };
    return buildPassRows(
      [passes[1]!],
      filters(over),
      inputs(yearsOf(passes, tours, signals), never, signals),
    ).map((r) => r.pass.slug);
  };

  test("heat is an exclusive upper bound on the derived valley tmax", () => {
    // 20 °C at the summit is 26,5 °C in the valley.
    expect(
      slugs({ maxValleyTmax: 28 }, { mittel: year({ tmax: 20 }) }),
    ).toEqual(["mittel"]);
    expect(
      slugs({ maxValleyTmax: 24 }, { mittel: year({ tmax: 20 }) }),
    ).toEqual([]);
    // 22 °C at the summit is 28,5 °C in the valley: not "unter 28".
    expect(
      slugs({ maxValleyTmax: 28 }, { mittel: year({ tmax: 22 }) }),
    ).toEqual([]);
  });

  test("rain days are an inclusive upper bound, counted in days", () => {
    // The share is rounded to whole days before it is compared, so a pass the
    // panel shows as "8 von 15" clears a "bis 8 von 15" filter.
    expect(slugs({ maxWetDays: 8 }, { mittel: year({ wetPct: 53 }) })).toEqual([
      "mittel",
    ]);
    // 56 % still rounds to 8 days and passes; 60 % is the ninth day.
    expect(slugs({ maxWetDays: 8 }, { mittel: year({ wetPct: 56 }) })).toEqual([
      "mittel",
    ]);
    expect(slugs({ maxWetDays: 8 }, { mittel: year({ wetPct: 60 }) })).toEqual(
      [],
    );
    // 10 days is exactly the line at which the status starts saying "nass".
    expect(slugs({ maxWetDays: 10 }, { mittel: year({ wetPct: 69 }) })).toEqual(
      ["mittel"],
    );
    expect(slugs({ maxWetDays: 10 }, { mittel: year({ wetPct: 70 }) })).toEqual(
      [],
    );
  });

  test("a missing value fails an active filter and passes an inactive one", () => {
    // No profile, so no valley elevation: the heat filter cannot say "under".
    expect(slugs({ maxValleyTmax: 28 }, { mittel: year({}) }, false)).toEqual(
      [],
    );
    expect(slugs({}, { mittel: year({}) }, false)).toEqual(["mittel"]);
    // No climate series at all: neither filter can say anything.
    expect(slugs({ maxValleyTmax: 28 }, {})).toEqual([]);
    expect(slugs({ maxWetDays: 8 }, {})).toEqual([]);
    expect(slugs({}, {})).toEqual(["mittel"]);
  });

  test("every pass of a tour has to respect the summer bounds", () => {
    const signals = {
      climate: { mittel: year({ tmax: 20, wetPct: 40 }) },
      valleys,
    };
    const rows = (over: Partial<Filters>) =>
      buildTourRows(
        tours,
        index,
        filters(over),
        inputs(yearsOf(passes, tours, signals), never, signals),
      ).map((r) => r.tour.slug);
    expect(rows({})).toEqual(["lang", "kurz"]);
    // "lang" also crosses "winter", which has no series: it fails both bounds.
    expect(rows({ maxValleyTmax: 28 })).toEqual(["kurz"]);
    expect(rows({ maxWetDays: 8 })).toEqual(["kurz"]);
  });
});

describe("plan 14 type and label filters", () => {
  const roads = [
    pass({ name: "Übergang", slug: "uebergang" }),
    pass({ name: "Stich", slug: "stich", tags: ["toll"], type: "spur" }),
    pass({
      name: "Balkon",
      slug: "balkon",
      tags: ["carfree", "gorge"],
      type: "balcony",
    }),
  ];
  const slugs = (over: Partial<Filters>) =>
    buildPassRows(roads, filters(over), inputs(yearsOf(roads))).map(
      (r) => r.pass.slug,
    );

  // The rows come back sorted (`buildPassRows`); these three are the same
  // height, so the default key falls through to the name.
  test("all five types selected is no filter", () => {
    expect(slugs({})).toEqual(["balkon", "stich", "uebergang"]);
  });

  test("a type set keeps exactly its members", () => {
    expect(slugs({ types: ["spur"] })).toEqual(["stich"]);
    expect(slugs({ types: ["spur", "plateau", "balcony", "valley"] })).toEqual([
      "balkon",
      "stich",
    ]);
  });

  test("labels stack: every selected one has to be present", () => {
    expect(slugs({ tags: ["carfree"] })).toEqual(["balkon"]);
    expect(slugs({ tags: ["carfree", "gorge"] })).toEqual(["balkon"]);
    expect(slugs({ tags: ["carfree", "toll"] })).toEqual([]);
    // A road without labels never satisfies an active one.
    expect(slugs({ tags: ["toll"] })).toEqual(["stich"]);
  });

  test("a tour needs one road of a selected type, and sees no labels", () => {
    const withSpur = tour({ passes: ["stich"], slug: "mit-stich" });
    const rows = (over: Partial<Filters>) =>
      buildTourRows(
        [withSpur],
        indexBySlug(roads),
        filters(over),
        inputs(yearsOf(roads, [withSpur])),
      ).map((r) => r.tour.slug);
    expect(rows({ types: ["spur"] })).toEqual(["mit-stich"]);
    expect(rows({ types: ["pass"] })).toEqual([]);
    // "autofrei" is a label of one road, never of the loop around it.
    expect(rows({ tags: ["carfree"] })).toEqual(["mit-stich"]);
  });
});

describe("buildTourRows", () => {
  test("status comes from the passes, sorted by elevation gain", () => {
    const rows = buildTourRows(tours, index, filters(), inputs(years));
    expect(rows.map((r) => r.tour.slug)).toEqual(["lang", "kurz"]);
    expect(rows.map((r) => r.status)).toEqual(["open", "open"]);
    expect(
      buildTourRows(tours, index, filters({ period: 4 }), inputs(years)).map(
        (r) => r.status,
      ),
    ).toEqual(["closed", "open"]);
  });

  test("search matches name and description, the status filter applies", () => {
    expect(
      buildTourRows(
        tours,
        index,
        filters({ query: "kurze" }),
        inputs(years),
      ).map((r) => r.tour.slug),
    ).toEqual(["kurz"]);
    expect(
      buildTourRows(
        tours,
        index,
        filters({ period: 4, status: ["open"] }),
        inputs(years),
      ).map((r) => r.tour.slug),
    ).toEqual(["kurz"]);
  });

  test("the climate series reaches the tour verdict, with the limiting reason", () => {
    const signals = { climate: { mittel: snowy(40) } };
    const rows = buildTourRows(
      tours,
      index,
      filters(),
      inputs(yearsOf(passes, tours, signals), never, signals),
    );
    expect(rows.every((r) => r.status === "risky")).toBe(true);
    expect(rows.every((r) => r.reason === "snow")).toBe(true);
    const clear = buildTourRows(tours, index, filters(), inputs(years));
    expect(clear.every((r) => r.reason === null)).toBe(true);
  });
});

describe("buildTownRows", () => {
  test("sorted by name, searchable, favourites only", () => {
    expect(
      buildTownRows(towns, {}, filters(), inputs(NO_YEARS)).map(
        (r) => r.town.slug,
      ),
    ).toEqual(["aosta", "bormio"]);
    expect(
      buildTownRows(
        towns,
        {},
        filters({ query: "stelvio" }),
        inputs(NO_YEARS),
      ).map((r) => r.town.slug),
    ).toEqual(["bormio"]);
    expect(
      buildTownRows(
        towns,
        {},
        filters({ favoritesOnly: true }),
        inputs(NO_YEARS),
      ),
    ).toHaveLength(0);
  });
});

describe("sortPassRows", () => {
  const rows = buildPassRows(passes, filters({ period: 4 }), inputs(years));

  test("buildPassRows has already applied `Filters.sort`", () => {
    expect(
      buildPassRows(passes, filters({ sort: "name" }), inputs(years)).map(
        (r) => r.pass.slug,
      ),
    ).toEqual(["hoch", "mittel", "winter"]);
    expect(
      buildPassRows(passes, filters({ sort: "traffic" }), inputs(years)).map(
        (r) => r.pass.slug,
      ),
    ).toEqual(sortPassRows(rows, "traffic").map((r) => r.pass.slug));
  });

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
      buildPassRows(twins, filters(), inputs(yearsOf(twins))),
      "beauty",
    );
    expect(sorted.map((r) => r.pass.slug)).toEqual(["a", "b"]);
  });
});

describe("seasonBand", () => {
  test("one bar per half-month, counting every matching pass", () => {
    const { bars } = seasonBand(passes, filters(), inputs(years));
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
    const { bars } = seasonBand(
      passes,
      filters({ minFame: 4, status: ["open"] }),
      inputs(years),
    );
    for (const b of bars) expect(barTotal(b)).toBe(1);
  });

  test("currentBar is the column of the chosen half-month", () => {
    const band = seasonBand(passes, filters(), inputs(years));
    expect(currentBar(band, 4)).toBe(band.bars[periodIndexOf(4)]!);
    expect(currentBar(band, 12.5).period).toBe(12.5);
  });

  test("no matching pass leaves 24 empty bars rather than nothing", () => {
    const { bars } = seasonBand(
      passes,
      filters({ query: "gibtsnicht" }),
      inputs(years),
    );
    expect(bars).toHaveLength(24);
    expect(bars.every((b) => barTotal(b) === 0)).toBe(true);
  });

  test("the climate series moves passes from open to weather-dependent", () => {
    const signals = {
      climate: { hoch: snowy(30), mittel: snowy(30), winter: snowy(30) },
    };
    const { bars } = seasonBand(
      passes,
      filters(),
      inputs(yearsOf(passes, tours, signals), never, signals),
    );
    expect(bars.every((b) => b.best === 0 && b.good === 0)).toBe(true);
  });

  test("averages the climate over the counted passes, not over the data", () => {
    // Two of the three carry a series; the third counts towards the grades
    // and towards nothing else, so the mean is over two.
    const signals = {
      climate: { hoch: bucketed({ tmax: 4 }), mittel: bucketed({ tmax: 10 }) },
    };
    const { bars, lat } = seasonBand(
      passes,
      filters(),
      inputs(yearsOf(passes, tours, signals), never, signals),
    );
    for (const b of bars) {
      expect(b.tmax).toBe(7);
      expect(barTotal(b)).toBe(passes.length);
    }
    expect(lat).toBe(47);
  });

  test("no climate series at all leaves the means null, not zero", () => {
    const { bars } = seasonBand(passes, filters(), inputs(years));
    for (const b of bars)
      expect([b.tmax, b.tmin, b.snowPct, b.wetPct]).toEqual([
        null,
        null,
        null,
        null,
      ]);
  });

  test("the ribbon is the grade of most passes, a tie going to the better", () => {
    const { bars } = seasonBand(passes, filters(), inputs(years));
    // Early January: the two year-round passes are limited, the winter one is
    // closed – a majority of two.
    expect(bars[periodIndexOf(1)]).toMatchObject({
      closed: 1,
      grade: "limited",
      limited: 2,
    });
    // Early April is one pass each of best, limited and closed: a three-way
    // tie, and the best of them leads.
    expect(bars[periodIndexOf(4)]).toMatchObject({
      best: 1,
      closed: 1,
      grade: "best",
      limited: 1,
    });
    expect(
      seasonBand(passes, filters({ query: "gibtsnicht" }), inputs(years))
        .bars[0]!.grade,
    ).toBeNull();
  });
});

describe("facetCount", () => {
  test("counts what the patch would leave, not what is left now", () => {
    const f = filters({ minFame: 5 });
    expect(buildPassRows(passes, f, inputs(years)).length).toBe(1);
    // The patch replaces the fame filter rather than narrowing it further.
    expect(facetCount(passes, f, { minFame: 3 }, inputs(years))).toBe(2);
    expect(facetCount(passes, f, { minFame: 1 }, inputs(years))).toBe(3);
  });

  test("a group's own filter never decides its own numbers", () => {
    // The point of counting disjunctively: with "ab 5" chosen, the other two
    // fame chips still report what they would give, instead of the 0 a naive
    // conjunctive count would report for every one of them.
    const chosen = filters({ minFame: 5 });
    const untouched = filters();
    for (const v of [1, 3, 5]) {
      expect(facetCount(passes, chosen, { minFame: v }, inputs(years))).toBe(
        facetCount(passes, untouched, { minFame: v }, inputs(years)),
      );
    }
  });

  test("the other groups do still narrow it", () => {
    const f = filters({ minElevation: 2000 });
    expect(facetCount(passes, f, { minFame: 1 }, inputs(years))).toBe(1);
    expect(facetCount(passes, filters(), { minFame: 1 }, inputs(years))).toBe(
      3,
    );
  });

  test("it agrees with the rows it counts", () => {
    for (const patch of [
      { minFame: 3 },
      { minElevation: 2000 },
      { status: ["closed" as const] },
      { types: ["spur" as const] },
    ]) {
      const f = { ...filters(), ...patch };
      expect(facetCount(passes, filters(), patch, inputs(years))).toBe(
        buildPassRows(passes, f, inputs(years)).length,
      );
    }
  });
});

describe("rowBlocks", () => {
  test("blocks are full except the last one, and nothing is lost", () => {
    const rows = Array.from({ length: 201 }, (_, i) => i);
    const blocks = rowBlocks(rows);
    expect(blocks.length).toBe(21);
    expect(blocks.slice(0, -1).every((b) => b.length === ROWS_PER_BLOCK)).toBe(
      true,
    );
    expect(blocks.at(-1)?.length).toBe(1);
    expect(blocks.flat()).toEqual(rows);
  });

  test("a short list is one block, an empty one none", () => {
    expect(rowBlocks([1, 2, 3])).toEqual([[1, 2, 3]]);
    expect(rowBlocks([])).toEqual([]);
  });
});

const area = (over: Partial<Destination> & { slug: string }): Destination => ({
  access: "",
  baseTowns: [],
  center: { lat: 46, lon: 10 },
  character: "",
  country: "IT",
  exclude: [],
  include: [],
  multiDay: "",
  name: over.slug,
  radiusKm: 30,
  ...over,
});

/** A nesting as slugs: each area with its towns, `null` for the rest. */
const shape = (groups: AreaGroup[]) =>
  groups.map((g) => [
    g.area?.destination.slug ?? null,
    g.towns.map((t) => t.town.slug),
  ]);

describe("buildDestinationRows (plan 12)", () => {
  const roads = [
    pass({ beauty: 5, lat: 46, lon: 10, name: "Nah", slug: "nah" }),
    pass({ beauty: 2, lat: 46, lon: 10.2, name: "Mittel", slug: "mittel" }),
    pass({ beauty: 4, lat: 47, lon: 12, name: "Fern", slug: "fern" }),
  ];
  const roadIndex = indexBySlug(roads);
  const bases: Town[] = [
    {
      country: "IT",
      lat: 46,
      lon: 10.05,
      name: "Bormio",
      slug: "bormio",
      tags: [],
      why: "",
    } as unknown as Town,
  ];
  const areas = [
    area({ baseTowns: ["bormio"], name: "Ortler", slug: "ortler" }),
    area({ center: { lat: 47, lon: 12 }, name: "Tauern", slug: "tauern" }),
  ];
  const members = Object.fromEntries(
    areas.map((d) => [d.slug, membersOf(d, roads, [], bases)]),
  );
  const rows = (over: Partial<Filters> = {}, fav: Favorite = never) =>
    buildDestinationRows(
      areas,
      members,
      roadIndex,
      indexBySlug(bases),
      filters(over),
      inputs(yearsOf(roads, []), fav),
    );

  test("ranks by the beauty that is rideable, and names the bases", () => {
    const [first, second] = rows();
    expect(first?.destination.slug).toBe("ortler");
    expect(first?.baseTowns.map((t) => t.name)).toEqual(["Bormio"]);
    expect(first?.text).toBe("2 von 2 Straßen gut");
    expect(second?.destination.slug).toBe("tauern");
    expect(first!.score).toBeGreaterThan(second!.score);
  });

  test("sees search, favourites and the range, not the road criteria", () => {
    expect(rows({ minBeauty: 5 })).toHaveLength(2);
    expect(rows({ query: "bormio" }).map((r) => r.destination.slug)).toEqual([
      "ortler",
    ]);
    expect(rows({ favoritesOnly: true })).toHaveLength(0);
    expect(
      rows(
        { favoritesOnly: true },
        (kind, slug) => kind === "destination" && slug === "tauern",
      ).map((r) => r.destination.slug),
    ).toEqual(["tauern"]);
    expect(rows({ ranges: ["Jura"] })).toHaveLength(0);
  });

  test("the towns sit under their areas, and what no listed area holds comes last", () => {
    const livigno = { ...bases[0]!, name: "Livigno", slug: "livigno" };
    const zell = { ...bases[0]!, name: "Zell", slug: "zell" };
    const townRows = buildTownRows(
      [...bases, livigno, zell],
      {},
      filters(),
      inputs(NO_YEARS),
      { bormio: [areas[0]!], zell: [areas[1]!, areas[0]!] },
    );
    const all = { destination: rows(), pass: [], tour: [], town: townRows };
    expect(shape(nestTowns(all.destination, townRows))).toEqual([
      ["ortler", ["bormio", "zell"]],
      ["tauern", ["zell"]],
      [null, ["livigno"]],
    ]);
    // An area the filters dropped hands its towns to the last group, unless
    // another listed area holds them too.
    const tauern = rows({ query: "tauern" });
    expect(shape(nestTowns(tauern, townRows))).toEqual([
      ["tauern", ["zell"]],
      [null, ["bormio", "livigno"]],
    ]);
    // The tab counts an area, or a town outside every listed area – never a
    // town twice, and never one that sits under its area.
    expect(tabCounts(all).destination).toBe(3);
    expect(tabCounts({ ...all, destination: tauern }).destination).toBe(3);
  });
});
