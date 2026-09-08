import { describe, expect, test } from "bun:test";

import type {
  AscentMetrics,
  ElevationProfile,
  TourMetrics,
} from "../../lib/types";
import {
  LIMITS,
  ascentMetrics,
  checkAscent,
  checkSummit,
  checkTour,
  geometryHash,
  length,
  tourMetrics,
  withProfile,
} from "./validate";

/**
 * The 11 ascents that were stored wrong before the gate existed, with the values
 * measured from the routes that were in `routes.json`, and the checks each one
 * has to trip. They are the fixtures the thresholds were fitted to, so a limit
 * that stops catching one of these has been loosened too far – and because the
 * expected reasons are named, loosening one limit cannot hide behind another.
 */
const KNOWN_BAD: Record<string, { m: AscentMetrics; trips: string[] }> = {
  "col-du-mont-cenis:1": {
    m: {
      km: 341.44,
      startDist: 0.025,
      endDist: 0.019,
      topDelta: 642,
      peakAt: 0.505,
      gain: 6274,
    },
    trips: ["Länge", "Profilhöhe", "höchster Punkt", "Anstieg"],
  },
  "colle-di-sampeyre:0": {
    m: {
      km: 66.33,
      startDist: 0.008,
      endDist: 0.005,
      topDelta: 12,
      peakAt: 1,
      gain: 2042,
    },
    trips: ["Länge"],
  },
  "grosse-scheidegg:0": {
    m: {
      km: 60.44,
      startDist: 0.013,
      endDist: 0.019,
      topDelta: -4,
      peakAt: 1,
      gain: 1731,
    },
    trips: ["Länge"],
  },
  "col-de-la-colombiere:1": {
    m: {
      km: 35.39,
      startDist: 0.003,
      endDist: 0.156,
      topDelta: 21,
      peakAt: 0.345,
      gain: 1536,
    },
    trips: ["höchster Punkt"],
  },
  "col-des-champs:1": {
    m: {
      km: 25.9,
      startDist: 0.116,
      endDist: 0.027,
      topDelta: 7,
      peakAt: 0.645,
      gain: 1451,
    },
    trips: ["höchster Punkt"],
  },
  "timmelsjoch:0": {
    m: {
      km: 22.2,
      startDist: 0.005,
      endDist: 0.135,
      topDelta: -179,
      peakAt: 0.996,
      gain: 1420,
    },
    trips: ["Profilhöhe"],
  },
  "kitzbueheler-horn:0": {
    m: {
      km: 12.92,
      startDist: 0.002,
      endDist: 0.056,
      topDelta: -400,
      peakAt: 0.769,
      gain: 1056,
    },
    trips: ["Profilhöhe"],
  },
  "col-de-la-colombiere:0": {
    m: {
      km: 11.66,
      startDist: 0.009,
      endDist: 0.156,
      topDelta: -343,
      peakAt: 1,
      gain: 931,
    },
    trips: ["Profilhöhe"],
  },
  "monte-zoncolan:0": {
    m: {
      km: 8.32,
      startDist: 0.002,
      endDist: 0.084,
      topDelta: -123,
      peakAt: 1,
      gain: 1179,
    },
    trips: ["Profilhöhe"],
  },
  "rossfeld-panoramastrasse:0": {
    m: {
      km: 6.1,
      startDist: 0.01,
      endDist: 0.12,
      topDelta: -857,
      peakAt: 0.988,
      gain: 319,
    },
    trips: ["Profilhöhe"],
  },
  "col-des-champs:0": {
    m: {
      km: 5.32,
      startDist: 0.002,
      endDist: 0.027,
      topDelta: -357,
      peakAt: 1,
      gain: 592,
    },
    trips: ["Profilhöhe"],
  },
};

/** Ascents that are right and have to stay right when a limit is retuned. */
const KNOWN_GOOD: Record<string, AscentMetrics> = {
  "alpe-d-huez:0": {
    km: 15.12,
    startDist: 0.002,
    endDist: 0.021,
    topDelta: -23,
    peakAt: 0.974,
    gain: 1403,
  },
  "col-d-izoard:1": {
    km: 30.28,
    startDist: 0.001,
    endDist: 0.002,
    topDelta: 12,
    peakAt: 0.995,
    gain: 1953,
  },
  // The false positive that moved `minPeakAt` from 0.85 to 0.75: a 6 km climb
  // whose highest sample sits at 81 % of the distance, and which is correct.
  "grimselpass:1": {
    km: 6.01,
    startDist: 0.013,
    endDist: 0.006,
    topDelta: 44,
    peakAt: 0.806,
    gain: 988,
  },
};

const GOOD: AscentMetrics = {
  km: 20,
  startDist: 0.1,
  endDist: 0.1,
  topDelta: 10,
  peakAt: 0.98,
  gain: 1200,
};

/** The one reason each field produces, so a boundary test can name it. */
const REASON = {
  km: "Länge",
  startDist: "Start",
  endDist: "Ende",
  topDelta: "Profilhöhe",
  peakAt: "höchster Punkt",
  gain: "Anstieg",
} as const;

describe("checkAscent", () => {
  for (const [key, { m, trips }] of Object.entries(KNOWN_BAD))
    test(`rejects ${key} for exactly ${trips.join(", ")}`, () => {
      const reasons = checkAscent(m);
      expect(reasons).toHaveLength(trips.length);
      for (const t of trips) expect(reasons.join("\n")).toContain(t);
    });

  for (const [key, metrics] of Object.entries(KNOWN_GOOD))
    test(`accepts ${key}`, () => {
      expect(checkAscent(metrics)).toBeEmpty();
    });

  test("carries the measured value in the reason", () => {
    expect(
      checkAscent(KNOWN_BAD["col-du-mont-cenis:1"]!.m).join(" "),
    ).toContain("341.44");
  });

  test("a wrong summit coordinate is reported as an elevation problem, not a length one", () => {
    // Colombière ascent 0 ends at the pass point but 343 m below it.
    expect(checkAscent(KNOWN_BAD["col-de-la-colombiere:0"]!.m)).toEqual([
      "Profilhöhe weicht -343 m ab > 80 m",
    ]);
  });

  test("judges only what has been measured", () => {
    const geometryOnly: AscentMetrics = {
      ...GOOD,
      topDelta: null,
      peakAt: null,
      gain: null,
    };
    expect(checkAscent(geometryOnly)).toBeEmpty();
  });
});

describe("every ascent limit has a boundary", () => {
  const L = LIMITS.ascent;
  // [field, value exactly at the limit (passes), value just past it (fails)]
  const cases: [keyof typeof REASON, number, number][] = [
    ["km", L.maxKm, L.maxKm + 0.01],
    ["startDist", L.maxStartDist, L.maxStartDist + 0.001],
    ["endDist", L.maxEndDist, L.maxEndDist + 0.001],
    ["topDelta", L.maxTopDelta, L.maxTopDelta + 1],
    ["topDelta", -L.maxTopDelta, -L.maxTopDelta - 1],
    ["peakAt", L.minPeakAt, L.minPeakAt - 0.001],
    ["gain", L.maxGain, L.maxGain + 1],
  ];
  for (const [field, at, past] of cases) {
    test(`${field}: ${at} passes, ${past} trips "${REASON[field]}" and nothing else`, () => {
      expect(checkAscent({ ...GOOD, [field]: at })).toBeEmpty();
      const reasons = checkAscent({ ...GOOD, [field]: past });
      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toContain(REASON[field]);
    });
  }
});

describe("ascent.check", () => {
  test("widens the named limit for that ascent alone", () => {
    const kitzbuehel = KNOWN_BAD["kitzbueheler-horn:0"]!.m;
    expect(checkAscent(kitzbuehel)).not.toBeEmpty();
    expect(
      checkAscent(kitzbuehel, {
        maxTopDelta: 420,
        note: "Straße endet am Alpenhaus",
      }),
    ).toBeEmpty();
  });

  test("leaves the other limits alone", () => {
    expect(
      checkAscent(KNOWN_BAD["col-du-mont-cenis:1"]!.m, {
        maxKm: 400,
        note: "Talanfahrt",
      }),
    ).toHaveLength(3);
  });

  test("a note on its own changes nothing", () => {
    const { m } = KNOWN_BAD["monte-zoncolan:0"]!;
    expect(checkAscent(m, { note: "nur eine Notiz" })).toEqual(checkAscent(m));
  });
});

describe("checkTour", () => {
  // Measured by routing all nine tours with ORS: seven land within ±13 % of
  // their stated distance, the two whose waypoints route long do not.
  const routed: Record<string, [routedKm: number, statedKm: number]> = {
    sellaronda: [63.5, 52],
    "maratona-dles-dolomites-lang": [163.2, 138],
    "route-des-grandes-alpes": [760, 700],
    "oetztaler-radmarathon": [227.4, 227],
    "la-marmotte": [196.3, 174],
    "andermatt-drei-paesse-runde": [121.1, 120],
    "stilfserjoch-umbrail-runde": [65.8, 70],
    "gavia-mortirolo-runde": [131.7, 130],
    "vrsic-predil-runde": [95.9, 105],
  };
  const metrics = (km: number, statedKm: number): TourMetrics => ({
    km,
    statedKm,
    kmDelta: +((km - statedKm) / statedKm).toFixed(3),
    startDist: 0.1,
    endDist: 0.1,
  });

  for (const [slug, [km, statedKm]] of Object.entries(routed)) {
    const sparse =
      slug === "sellaronda" || slug === "maratona-dles-dolomites-lang";
    test(`${sparse ? "rejects" : "accepts"} ${slug}`, () => {
      const reasons = checkTour(metrics(km, statedKm));
      expect(reasons.length > 0).toBe(sparse);
      if (sparse) expect(reasons[0]).toContain("Länge");
    });
  }

  test("kmDelta boundary, both signs", () => {
    const L = LIMITS.tour.maxKmDelta;
    expect(checkTour({ ...metrics(100, 100), kmDelta: L })).toBeEmpty();
    expect(checkTour({ ...metrics(100, 100), kmDelta: -L })).toBeEmpty();
    expect(
      checkTour({ ...metrics(100, 100), kmDelta: L + 0.001 }),
    ).toHaveLength(1);
    expect(
      checkTour({ ...metrics(100, 100), kmDelta: -L - 0.001 }),
    ).toHaveLength(1);
  });

  test("waypoint distance boundary at both ends", () => {
    const L = LIMITS.tour.maxWaypointDist;
    expect(
      checkTour({ ...metrics(120, 120), startDist: L, endDist: L }),
    ).toBeEmpty();
    expect(
      checkTour({ ...metrics(120, 120), startDist: L + 0.001 }).join(" "),
    ).toContain("ersten Wegpunkt");
    expect(
      checkTour({ ...metrics(120, 120), endDist: L + 0.001 }).join(" "),
    ).toContain("letzten Wegpunkt");
  });

  test("tour.check widens a tour limit", () => {
    const long = metrics(63.5, 52);
    expect(checkTour(long)).not.toBeEmpty();
    expect(
      checkTour(long, {
        maxKmDelta: 0.25,
        note: "Variante über Passo Campolongo",
      }),
    ).toBeEmpty();
  });
});

describe("metrics", () => {
  const summit = { lat: 45.1, lon: 6.5 };
  const from = { lat: 45, lon: 6.5 };
  const geom: [number, number][] = [
    [45, 6.5],
    [45.05, 6.5],
    [45.1, 6.5],
  ];

  test("length sums the polyline", () => {
    expect(length(geom)).toBeCloseTo(11.12, 1);
  });

  test("ascentMetrics measures the ends against the intended points", () => {
    const m = ascentMetrics(geom, from, summit);
    expect(m.km).toBeCloseTo(11.12, 1);
    expect(m.startDist).toBe(0);
    expect(m.endDist).toBe(0);
    expect(m.topDelta).toBeNull();
  });

  test("withProfile puts the peak where the highest sample is", () => {
    const profile: ElevationProfile = {
      km: 10,
      elevationGain: 1000,
      start: 1000,
      top: 2000,
      avgGradient: 10,
      dist: [0, 5, 10],
      ele: [1000, 2000, 1900],
    };
    const m = withProfile(ascentMetrics(geom, from, summit), profile, 1990);
    expect(m.topDelta).toBe(10);
    expect(m.peakAt).toBe(0.5);
    expect(m.gain).toBe(1000);
  });

  test("tourMetrics measures against the curated distance", () => {
    const m = tourMetrics(geom, [from, summit], 10);
    expect(m.statedKm).toBe(10);
    expect(m.kmDelta).toBeCloseTo(0.112, 2);
  });
});

describe("geometryHash", () => {
  test("is stable for the same geometry", () => {
    const geom: [number, number][] = [
      [45, 6.5],
      [45.1, 6.6],
    ];
    expect(geometryHash(geom)).toBe(geometryHash([...geom]));
  });

  test("changes when the road changes", () => {
    expect(geometryHash([[45, 6.5]])).not.toBe(geometryHash([[45, 6.6]]));
  });
});

describe("checkSummit", () => {
  test("accepts DEM noise up to the limit", () => {
    expect(checkSummit(2642 + LIMITS.summit.maxDelta, 2642)).toBeEmpty();
    expect(checkSummit(2642 + LIMITS.summit.maxDelta + 1, 2642)).toHaveLength(
      1,
    );
  });

  test("reports a pass coordinate on the wrong summit", () => {
    expect(checkSummit(1200, 2642).join(" ")).toContain("-1442 m");
  });
});
