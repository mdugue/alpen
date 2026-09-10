import { describe, expect, test } from "bun:test";

import climateJson from "@/data/generated/climate.json" with { type: "json" };
import profilesJson from "@/data/generated/profiles.json" with { type: "json" };
import passesJson from "@/data/passes.json" with { type: "json" };
import { valleyElevations } from "@/lib/profile";
import {
  bestPeriods,
  cellHint,
  climateBucket,
  GRADE_HINT,
  indexBySlug,
  inputAt,
  isPeriod,
  passCellNotes,
  passGrades,
  passSeason,
  passStatus,
  passVerdict,
  periodAt,
  periodIndex,
  periodLabel,
  PERIODS,
  REASON_ORDER,
  seasonSummary,
  signalsOf,
  todayPeriod,
  tourGrades,
  tourStatus,
  valleyTmax,
  verdictReasons,
} from "@/lib/status";
import type { Grade, Signals, StatusReason } from "@/lib/status";
import type {
  ClimateBucket,
  ClimateYear,
  ElevationProfile,
  Pass,
  Period,
  Status,
  Tour,
} from "@/lib/types";

const passes = passesJson as Pass[];
const climate = climateJson as unknown as Record<string, ClimateYear>;
const valleys = valleyElevations(
  passes,
  profilesJson as unknown as Record<string, ElevationProfile>,
);
const signals: Signals = { climate, valleys };
const bySlug = (slug: string): Pass => {
  const p = passes.find((x) => x.slug === slug);
  if (!p) throw new Error(`no pass ${slug}`);
  return p;
};
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

/** One grade per character: `b` best, `o` good, `r` limited, anything else closed. */
const grades = (spec: string): Grade[] =>
  [...spec].map((c) =>
    c === "b" ? "best" : c === "o" ? "good" : c === "r" ? "limited" : "closed",
  );

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
    expect(passVerdict(p, 7, { bucket: bucket({ snowPct: 27 }) })).toEqual({
      reasons: ["snow"],
      status: "risky",
    });
    expect(
      verdictReasons(p, 7, { bucket: bucket({ snowPct: 27 }) })[0],
    ).toContain("Schneefall an 27 % der Tage");
  });

  test("frost nights count too, snow first", () => {
    const p = pass({ elevation: 1500, season: { closes: 10.5, opens: 6 } });
    expect(
      passVerdict(p, 7, { bucket: bucket({ frostPct: 85 }) }).reasons,
    ).toEqual(["frost"]);
    // Both fire and both are kept; the ladder puts snow first.
    expect(
      passVerdict(p, 7, { bucket: bucket({ frostPct: 85, snowPct: 21 }) })
        .reasons,
    ).toEqual(["snow", "frost"]);
  });

  test("just below the thresholds nothing changes", () => {
    const p = pass({ elevation: 1500, season: { closes: 10.5, opens: 6 } });
    expect(
      passStatus(p, 7, { bucket: bucket({ frostPct: 79, snowPct: 19 }) }),
    ).toBe("open");
  });

  test("maintained roads get the climate rule as well", () => {
    const toll = pass({
      elevation: 2400,
      season: { closes: 11, maintained: true, opens: 5 },
    });
    expect(passStatus(toll, 6, { bucket: bucket({ snowPct: 25 }) })).toBe(
      "risky",
    );
  });

  test("no bucket behaves exactly as before", () => {
    const p = pass({ elevation: 1500, season: { closes: 10.5, opens: 6 } });
    expect(passStatus(p, 7, null)).toBe(passStatus(p, 7));
    expect(passStatus(p, 7, { bucket: null })).toBe(passStatus(p, 7));
    expect(passStatus(p, 7)).toBe(passStatus(p, 7));
  });

  test("climate never produces a closure, for no pass and no half-month", () => {
    for (const p of passes) {
      for (const [i, t] of PERIODS.entries()) {
        const withClimate = passStatus(p, t, {
          bucket: climate[p.slug]?.[i] ?? null,
          valley: valleys[p.slug],
        });
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
        passStatus(p!, t, { bucket: climateBucket(climate, slug, t) }),
        `${slug} ${periodLabel(t)}`,
      ).toBe(expected);
    }
  });
});

describe("the summer axis (plan 13)", () => {
  const p = pass({ elevation: 2000, lat: 46.5 });
  const july = 7.5;

  test("valley heat is derived down to the lowest ascent start", () => {
    // 17 °C on 2 000 m are 26,75 °C on 500 m: 1 500 m × 0,65 °C/100 m.
    const b = bucket({ tmax: 17 });
    expect(valleyTmax(p, b, 500)).toBeCloseTo(26.75, 5);
    expect(valleyTmax(p, b, null)).toBeNull();
    expect(passVerdict(p, july, { bucket: b, valley: 500 }).reasons).toEqual([
      "heat",
    ]);
    // Without a profile there is no valley and no heat signal.
    expect(passVerdict(p, july, { bucket: b }).reasons).toEqual([]);
    expect(
      passVerdict(p, july, { bucket: bucket({ tmax: 15 }), valley: 500 })
        .reasons,
    ).toEqual([]);
  });

  test("rain days, short days and a cold descent each lower a cell", () => {
    expect(
      passVerdict(p, july, { bucket: bucket({ wetPct: 70 }) }).reasons,
    ).toEqual(["wet"]);
    expect(
      passVerdict(p, july, { bucket: bucket({ wetPct: 69 }) }).reasons,
    ).toEqual([]);
    expect(
      passVerdict(p, 9.5, { bucket: bucket({ tmax: 7.9 }) }).reasons,
    ).toEqual(["cold-descent"]);
    // Late October at 46.5° N has less than 10¾ hours of daylight.
    const low = pass({ elevation: 900, lat: 46.5 });
    expect(passVerdict(low, 10.5).reasons).toEqual(["short-day"]);
    expect(passVerdict(low, 10).reasons).toEqual([]);
  });

  test("every reason that fired is kept, in ladder order", () => {
    const { reasons, status } = passVerdict(
      pass({ elevation: 2400, lat: 46.5 }),
      10.5,
      { bucket: bucket({ snowPct: 25, tmax: 5, wetPct: 75 }), valley: 500 },
    );
    expect(status).toBe("risky");
    expect(reasons).toEqual([
      "snow",
      "altitude",
      "wet",
      "short-day",
      "cold-descent",
    ]);
    expect(REASON_ORDER).toHaveLength(9);
  });

  test("the calibration cases from plan 13", () => {
    const cases: [string, Period, StatusReason][] = [
      ["mont-ventoux", 7.5, "heat"],
      ["passo-duran", 7.5, "wet"],
      ["passo-duran", 10.5, "short-day"],
      ["col-du-galibier", 9.5, "cold-descent"],
    ];
    for (const [slug, t, reason] of cases) {
      const v = passVerdict(
        bySlug(slug),
        t,
        inputAt(signalsOf(signals, slug), t),
      );
      expect(v.status, `${slug} ${periodLabel(t)}`).toBe("risky");
      expect(v.reasons[0], `${slug} ${periodLabel(t)}`).toBe(reason);
    }
    // Galibier and Iseran stay cool in the valley.
    for (const slug of ["col-du-galibier", "col-de-l-iseran"]) {
      const v = passVerdict(
        bySlug(slug),
        7.5,
        inputAt(signalsOf(signals, slug), 7.5),
      );
      expect(v.reasons, slug).not.toContain("heat");
    }
  });

  test("no signal but the opening window ever closes a pass", () => {
    for (const x of passes) {
      for (const [i, t] of PERIODS.entries()) {
        const v = passVerdict(x, t, {
          bucket: climate[x.slug]?.[i] ?? null,
          valley: valleys[x.slug],
        });
        if (v.status === "closed")
          expect(v.reasons, `${x.slug} ${periodLabel(t)}`).toEqual([
            "outside-window",
          ]);
      }
    }
  });

  test("from June to September all three rideable grades occur", () => {
    const seen = new Set<Grade>();
    for (const x of passes) {
      const g = passGrades(x, signalsOf(signals, x.slug));
      for (let i = periodIndex(6); i <= periodIndex(9.5); i += 1)
        seen.add(g[i]!);
    }
    expect(seen.has("best")).toBe(true);
    expect(seen.has("good")).toBe(true);
    expect(seen.has("limited")).toBe(true);
  });

  test("grades: best inside the best run, good outside it, limited and closed as the status", () => {
    const galibier = bySlug("col-du-galibier");
    const own = signalsOf(signals, "col-du-galibier");
    const best = bestPeriods(galibier, own);
    const g = passGrades(galibier, own);
    const status = passSeason(galibier, own);
    expect(best).not.toBeNull();
    for (const [i, t] of PERIODS.entries()) {
      const inBest = t >= best![0] && t <= best![1];
      const expected: Grade =
        status[i] === "closed"
          ? "closed"
          : status[i] === "risky"
            ? "limited"
            : inBest
              ? "best"
              : "good";
      expect(g[i], periodLabel(t)).toBe(expected);
    }
  });

  test("a tour cell is the worst grade of its passes", () => {
    const index = indexBySlug([
      pass({
        elevation: 1000,
        lat: 46.5,
        season: { closes: 11, opens: 5 },
        slug: "a",
      }),
      pass({
        elevation: 1000,
        lat: 46.5,
        season: { closes: 9, opens: 7 },
        slug: "b",
      }),
    ]);
    const g = tourGrades(tour(["a", "b"]), index);
    expect(g[periodIndex(8)]).toBe("best");
    expect(g[periodIndex(7)]).toBe("limited");
    expect(g[periodIndex(6)]).toBe("closed");
  });
});

describe("cell hints", () => {
  test("a limited cell names its caveat, a good cell says why it is not the best time", () => {
    expect(cellHint("limited", { reason: "heat", snowy: false })).toBe(
      "Fahrbar, aber mit einem Haken: Hitze im Tal.",
    );
    expect(cellHint("good", { reason: null, snowy: true })).toBe(
      "Nichts spricht gegen die Fahrt. Jedoch schneit es gelegentlich.",
    );
    expect(cellHint("good", { reason: null, snowy: false })).toBe(
      "Nichts spricht gegen die Fahrt. Nur ist es ein kürzerer Abschnitt als die beste Zeit.",
    );
    // Without a note the general sentence stands.
    expect(cellHint("best")).toBe(GRADE_HINT.best);
    expect(cellHint("closed")).toBe(GRADE_HINT.closed);
    expect(
      passCellNotes(
        bySlug("mont-ventoux"),
        signalsOf(signals, "mont-ventoux"),
      )[13],
    ).toMatchObject({ reason: "heat" });
  });
});

describe("season strips and best periods", () => {
  test("passSeason has one verdict per half-month and matches passStatus", () => {
    const p = passes[0]!;
    const season = passSeason(p, { climate: climate[p.slug] });
    expect(season).toHaveLength(24);
    expect(season[periodIndex(8)]).toBe(
      passStatus(p, 8, { bucket: climateBucket(climate, p.slug, 8) }),
    );
  });

  test("bestPeriods finds the longest quiet open run", () => {
    const galibier = passes.find((p) => p.slug === "col-du-galibier")!;
    const best = bestPeriods(galibier, signalsOf(signals, galibier.slug));
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
    const withBest = passes.filter((p) =>
      bestPeriods(p, signalsOf(signals, p.slug)),
    );
    expect(withBest.length).toBeGreaterThanOrEqual(80);
  });

  test("seasonSummary describes the strip in one sentence", () => {
    expect(seasonSummary(grades("xxxxxxxxxxrooooooorxxxxx"))).toBe(
      "Saison: gut Ende Juni bis Ende September, eingeschränkt Anfang Juni bis Anfang Oktober.",
    );
    expect(seasonSummary(grades("xxxxxxxxxxrobbbbooorxxxx"))).toBe(
      "Saison: beste Zeit Anfang Juli bis Ende August, gut Ende Juni bis Anfang Oktober, eingeschränkt Anfang Juni bis Ende Oktober.",
    );
    expect(seasonSummary(grades("o".repeat(24)))).toBe(
      "Saison: gut ganzjährig.",
    );
    expect(seasonSummary(grades("x".repeat(24)))).toBe(
      "Saison: ganzjährig oft gesperrt.",
    );
    expect(seasonSummary(grades("xxxxxxxxxxxxrrxxxxxxxxxx"))).toBe(
      "Saison: eingeschränkt Anfang Juli bis Ende Juli, sonst oft gesperrt.",
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
    expect(tourStatus(tour(["a"]), index, 8, { climate: snowy })).toBe("risky");
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
        `${passSeason(p, signalsOf(signals, p.slug))
          .map((s) => code[s])
          .join("")}  ${p.slug}`,
    )
    .toSorted();
  expect(matrix).toMatchSnapshot();
});
