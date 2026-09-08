import { describe, expect, test } from "bun:test";

import climateJson from "@/data/generated/climate.json" with { type: "json" };
import passesJson from "@/data/passes.json" with { type: "json" };
import {
  bestPeriods,
  climateBucket,
  indexBySlug,
  isPeriod,
  passSeason,
  passStatus,
  passVerdict,
  periodAt,
  periodIndex,
  periodLabel,
  PERIODS,
  seasonSummary,
  todayPeriod,
  tourStatus,
  verdictReasons,
} from "@/lib/status";
import type {
  ClimateBucket,
  ClimateYear,
  Pass,
  Period,
  Status,
  Tour,
} from "@/lib/types";

const passes = passesJson as Pass[];
const climate = climateJson as unknown as Record<string, ClimateYear>;
const pass = (over: Partial<Pass>): Pass => ({
  ascents: [],
  beauty: 3,
  classicAscent: "",
  country: "AT",
  difficulty: 3,
  elevation: 2000,
  fame: 3,
  lat: 47,
  lon: 12,
  name: "Testpass",
  note: "",
  region: "Ostalpen",
  season: null,
  slug: "test",
  traffic: 3,
  ...over,
});
const bucket = (over: Partial<ClimateBucket> = {}): ClimateBucket => ({
  frostPct: 0,
  snowPct: 0,
  tmax: 12,
  tmin: 4,
  wetPct: 20,
  ...over,
});

/** One status per character: `o` open, `r` risky, anything else closed. */
const statuses = (spec: string): Status[] =>
  [...spec].map((c) => (c === "o" ? "open" : c === "r" ? "risky" : "closed"));

const tour = (slugs: string[]): Tour => ({
  color: "#000",
  description: "",
  elevationGain: 2000,
  km: 100,
  name: "Testtour",
  passes: slugs,
  season: "",
  slug: "t",
  waypoints: [],
});

describe("periods", () => {
  test("24 half-months round trip through index and label", () => {
    expect(PERIODS).toHaveLength(24);
    expect(PERIODS.map(periodIndex)).toEqual(
      Array.from({ length: 24 }, (_, i) => i),
    );
    expect(PERIODS.map((t) => periodAt(periodIndex(t)))).toEqual(PERIODS);
    expect(periodLabel(1)).toBe("Anfang Januar");
    expect(periodLabel(10)).toBe("Anfang Oktober");
    expect(periodLabel(10.5)).toBe("Ende Oktober");
    expect(periodLabel(12.5)).toBe("Ende Dezember");
  });

  test("periodAt wraps around the year", () => {
    expect(periodAt(24)).toBe(1);
    expect(periodAt(-1)).toBe(12.5);
  });

  test("isPeriod guards values from the hash or storage", () => {
    expect(isPeriod(6)).toBe(true);
    expect(isPeriod(6.5)).toBe(true);
    expect(isPeriod(0)).toBe(false);
    expect(isPeriod(13)).toBe(false);
    expect(isPeriod(6.25)).toBe(false);
    expect(isPeriod("6")).toBe(false);
    expect(isPeriod(Number.NaN)).toBe(false);
  });

  test("todayPeriod splits the month at the 15th, in Europe/Berlin", () => {
    expect(todayPeriod(new Date("2026-05-01T12:00:00Z"))).toBe(5);
    expect(todayPeriod(new Date("2026-05-15T12:00:00Z"))).toBe(5);
    expect(todayPeriod(new Date("2026-05-16T12:00:00Z"))).toBe(5.5);
    expect(todayPeriod(new Date("2026-12-31T12:00:00Z"))).toBe(12.5);
    // 00:30 Berlin time on 1 June is still 22:30 UTC on 31 May.
    expect(todayPeriod(new Date("2026-05-31T22:30:00Z"))).toBe(6);
  });
});

describe("passStatus without a climate series", () => {
  test("cleared all year: only altitude and the calendar matter", () => {
    const high = pass({ elevation: 2400 });
    const mid = pass({ elevation: 1900 });
    const low = pass({ elevation: 900 });
    expect(passStatus(high, 7)).toBe("open");
    expect(passStatus(high, 10)).toBe("risky");
    expect(passStatus(high, 5)).toBe("risky");
    expect(passStatus(mid, 10)).toBe("open");
    expect(passStatus(mid, 11)).toBe("risky");
    expect(passStatus(low, 7)).toBe("open");
    expect(passStatus(low, 1)).toBe("risky");
    expect(passStatus(low, 12.5)).toBe("risky");
  });

  test("season window: closed outside, risky at the edges", () => {
    const p = pass({ elevation: 1500, season: { closes: 10.5, opens: 6 } });
    expect(passStatus(p, 5.5)).toBe("closed");
    expect(passStatus(p, 6)).toBe("risky");
    expect(passStatus(p, 6.5)).toBe("open");
    expect(passStatus(p, 10)).toBe("risky");
    expect(passStatus(p, 10.5)).toBe("closed");
  });

  test("the altitude penalty inside the window is waived for maintained roads", () => {
    const wild = pass({ elevation: 2400, season: { closes: 11, opens: 5 } });
    const toll = pass({
      elevation: 2400,
      season: { closes: 11, maintained: true, opens: 5 },
    });
    expect(passStatus(wild, 6)).toBe("risky");
    expect(passStatus(toll, 6)).toBe("open");
    expect(passStatus(wild, 8)).toBe("open");
  });
});

describe("the climate series", () => {
  test("snow days turn open into weather-dependent, with a reason", () => {
    const p = pass({ elevation: 1500, season: { closes: 10.5, opens: 6 } });
    expect(passVerdict(p, 7, bucket({ snowPct: 27 }))).toEqual({
      reasons: ["snow"],
      status: "risky",
    });
    expect(verdictReasons(p, 7, bucket({ snowPct: 27 }))[0]).toContain(
      "Schneefall an 27 % der Tage",
    );
  });

  test("frost nights count too, snow first", () => {
    const p = pass({ elevation: 1500, season: { closes: 10.5, opens: 6 } });
    expect(passVerdict(p, 7, bucket({ frostPct: 85 })).reasons).toEqual([
      "frost",
    ]);
    expect(
      passVerdict(p, 7, bucket({ frostPct: 85, snowPct: 21 })).reasons,
    ).toEqual(["snow"]);
  });

  test("just below the thresholds nothing changes", () => {
    const p = pass({ elevation: 1500, season: { closes: 10.5, opens: 6 } });
    expect(passStatus(p, 7, bucket({ frostPct: 79, snowPct: 19 }))).toBe(
      "open",
    );
  });

  test("maintained roads get the climate rule as well", () => {
    const toll = pass({
      elevation: 2400,
      season: { closes: 11, maintained: true, opens: 5 },
    });
    expect(passStatus(toll, 6, bucket({ snowPct: 25 }))).toBe("risky");
  });

  test("no bucket behaves exactly as before", () => {
    const p = pass({ elevation: 1500, season: { closes: 10.5, opens: 6 } });
    expect(passStatus(p, 7, null)).toBe(passStatus(p, 7));
    expect(passStatus(p, 7)).toBe(passStatus(p, 7));
  });

  test("climate never produces a closure, for no pass and no half-month", () => {
    for (const p of passes) {
      for (const [i, t] of PERIODS.entries()) {
        const withClimate = passStatus(p, t, climate[p.slug]?.[i] ?? null);
        const without = passStatus(p, t);
        if (withClimate === "closed") expect(without).toBe("closed");
        if (without === "risky") expect(withClimate).toBe("risky");
      }
    }
  });

  test("the shoulder-season cases from plan 04", () => {
    const cases: [string, Period, Status][] = [
      ["grossglockner-hochalpenstrasse", 10, "risky"],
      ["silvretta-hochalpenstrasse", 10, "risky"],
      ["gotthard-tremola", 10, "risky"],
      ["col-du-galibier", 7.5, "open"],
    ];
    for (const [slug, t, expected] of cases) {
      const p = passes.find((x) => x.slug === slug);
      expect(p, slug).toBeDefined();
      expect(
        passStatus(p!, t, climateBucket(climate, slug, t)),
        `${slug} ${periodLabel(t)}`,
      ).toBe(expected);
    }
  });
});

describe("season strips and best periods", () => {
  test("passSeason has one verdict per half-month and matches passStatus", () => {
    const p = passes[0]!;
    const season = passSeason(p, climate[p.slug]);
    expect(season).toHaveLength(24);
    expect(season[periodIndex(8)]).toBe(
      passStatus(p, 8, climateBucket(climate, p.slug, 8)),
    );
  });

  test("bestPeriods finds the longest quiet open run", () => {
    const galibier = passes.find((p) => p.slug === "col-du-galibier")!;
    const best = bestPeriods(galibier, climate[galibier.slug]);
    expect(best).not.toBeNull();
    const [from, to] = best!;
    expect(from).toBeGreaterThanOrEqual(6);
    expect(to).toBeLessThanOrEqual(10);
    expect(from).toBeLessThan(to);
  });

  test("bestPeriods returns null when nothing lasts two half-months", () => {
    const p = pass({ elevation: 2600, season: { closes: 7.5, opens: 7 } });
    expect(bestPeriods(p, null)).toBeNull();
  });

  test("every pass has a plausible best time (acceptance criterion of plan 04)", () => {
    const withBest = passes.filter((p) => bestPeriods(p, climate[p.slug]));
    expect(withBest.length).toBeGreaterThanOrEqual(80);
  });

  test("seasonSummary describes the strip in one sentence", () => {
    expect(seasonSummary(statuses("xxxxxxxxxxrooooooorxxxxx"))).toBe(
      "Saison: meist offen Ende Juni bis Ende September, wetterabhängig Anfang Juni bis Anfang Oktober.",
    );
    expect(seasonSummary(statuses("o".repeat(24)))).toBe(
      "Saison: meist offen ganzjährig.",
    );
    expect(seasonSummary(statuses("x".repeat(24)))).toBe(
      "Saison: ganzjährig oft gesperrt.",
    );
    expect(seasonSummary(statuses("xxxxxxxxxxxxrrxxxxxxxxxx"))).toBe(
      "Saison: wetterabhängig Anfang Juli bis Ende Juli, sonst oft gesperrt.",
    );
  });
});

describe("tourStatus", () => {
  const index = indexBySlug([
    pass({ elevation: 1000, season: { closes: 11, opens: 5 }, slug: "a" }),
    pass({ elevation: 1000, season: { closes: 9, opens: 7 }, slug: "b" }),
  ]);

  test("a tour is as rideable as its worst pass", () => {
    expect(tourStatus(tour(["a", "b"]), index, 8)).toBe("open");
    expect(tourStatus(tour(["a", "b"]), index, 7)).toBe("risky");
    expect(tourStatus(tour(["a", "b"]), index, 6)).toBe("closed");
  });

  test("unknown pass slugs are ignored", () => {
    expect(tourStatus(tour(["a", "ghost"]), index, 8)).toBe("open");
  });

  test("the climate map reaches the passes of a tour", () => {
    const snowy = { a: PERIODS.map(() => bucket({ snowPct: 30 })) } as Record<
      string,
      ClimateYear
    >;
    expect(tourStatus(tour(["a"]), index, 8)).toBe("open");
    expect(tourStatus(tour(["a"]), index, 8, snowy)).toBe("risky");
  });
});

/**
 * The whole matrix as a snapshot: any change to the heuristic shows up here as
 * a diff, one line per pass, one character per half-month (o/r/x).
 */
test("status matrix for all passes × 24 half-months", () => {
  const code: Record<Status, string> = { closed: "x", open: "o", risky: "r" };
  const matrix = passes
    .map(
      (p) =>
        `${passSeason(p, climate[p.slug])
          .map((s) => code[s])
          .join("")}  ${p.slug}`,
    )
    .toSorted();
  expect(matrix).toMatchSnapshot();
});
