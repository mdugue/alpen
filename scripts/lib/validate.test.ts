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
  checkRoad,
  checkSummit,
  checkTour,
  geometryHash,
  inputsHash,
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
  "col-de-la-colombiere:0": {
    m: {
      endDist: 0.156,
      gain: 931,
      km: 11.66,
      peakAt: 1,
      startDist: 0.009,
      topDelta: -343,
    },
    trips: ["Profilhöhe"],
  },
  "col-de-la-colombiere:1": {
    m: {
      endDist: 0.156,
      gain: 1536,
      km: 35.39,
      peakAt: 0.345,
      startDist: 0.003,
      topDelta: 21,
    },
    trips: ["höchster Punkt"],
  },
  "col-des-champs:0": {
    m: {
      endDist: 0.027,
      gain: 592,
      km: 5.32,
      peakAt: 1,
      startDist: 0.002,
      topDelta: -357,
    },
    trips: ["Profilhöhe"],
  },
  "col-des-champs:1": {
    m: {
      endDist: 0.027,
      gain: 1451,
      km: 25.9,
      peakAt: 0.645,
      startDist: 0.116,
      topDelta: 7,
    },
    trips: ["höchster Punkt"],
  },
  "col-du-mont-cenis:1": {
    m: {
      endDist: 0.019,
      gain: 6274,
      km: 341.44,
      peakAt: 0.505,
      startDist: 0.025,
      topDelta: 642,
    },
    trips: ["Länge", "Profilhöhe", "höchster Punkt", "Anstieg"],
  },
  "colle-di-sampeyre:0": {
    m: {
      endDist: 0.005,
      gain: 2042,
      km: 66.33,
      peakAt: 1,
      startDist: 0.008,
      topDelta: 12,
    },
    trips: ["Länge"],
  },
  "grosse-scheidegg:0": {
    m: {
      endDist: 0.019,
      gain: 1731,
      km: 60.44,
      peakAt: 1,
      startDist: 0.013,
      topDelta: -4,
    },
    trips: ["Länge"],
  },
  "kitzbueheler-horn:0": {
    m: {
      endDist: 0.056,
      gain: 1056,
      km: 12.92,
      peakAt: 0.769,
      startDist: 0.002,
      topDelta: -400,
    },
    trips: ["Profilhöhe"],
  },
  "monte-zoncolan:0": {
    m: {
      endDist: 0.084,
      gain: 1179,
      km: 8.32,
      peakAt: 1,
      startDist: 0.002,
      topDelta: -123,
    },
    trips: ["Profilhöhe"],
  },
  "rossfeld-panoramastrasse:0": {
    m: {
      endDist: 0.12,
      gain: 319,
      km: 6.1,
      peakAt: 0.988,
      startDist: 0.01,
      topDelta: -857,
    },
    trips: ["Profilhöhe"],
  },
  "timmelsjoch:0": {
    m: {
      endDist: 0.135,
      gain: 1420,
      km: 22.2,
      peakAt: 0.996,
      startDist: 0.005,
      topDelta: -179,
    },
    trips: ["Profilhöhe"],
  },
};

/** Ascents that are right and have to stay right when a limit is retuned. */
const KNOWN_GOOD: Record<string, AscentMetrics> = {
  "alpe-d-huez:0": {
    endDist: 0.021,
    gain: 1403,
    km: 15.12,
    peakAt: 0.974,
    startDist: 0.002,
    topDelta: -23,
  },
  "col-d-izoard:1": {
    endDist: 0.002,
    gain: 1953,
    km: 30.28,
    peakAt: 0.995,
    startDist: 0.001,
    topDelta: 12,
  },
  // The false positive that moved `minPeakAt` from 0.85 to 0.75: a 6 km climb
  // whose highest sample sits at 81 % of the distance, and which is correct.
  "grimselpass:1": {
    endDist: 0.006,
    gain: 988,
    km: 6.01,
    peakAt: 0.806,
    startDist: 0.013,
    topDelta: 44,
  },
};

const GOOD: AscentMetrics = {
  endDist: 0.1,
  gain: 1200,
  km: 20,
  peakAt: 0.98,
  startDist: 0.1,
  topDelta: 10,
};

/** The one reason each field produces, so a boundary test can name it. */
const REASON = {
  endDist: "Ende",
  gain: "Anstieg",
  km: "Länge",
  peakAt: "höchster Punkt",
  startDist: "Start",
  topDelta: "Profilhöhe",
} as const;

const tourMetricsOf = (km: number, statedKm: number): TourMetrics => ({
  endDist: 0.1,
  km,
  kmDelta: +((km - statedKm) / statedKm).toFixed(3),
  startDist: 0.1,
  statedKm,
});

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
      gain: null,
      peakAt: null,
      topDelta: null,
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
    "andermatt-drei-paesse-runde": [121.1, 120],
    "gavia-mortirolo-runde": [131.7, 130],
    "la-marmotte": [196.3, 174],
    "maratona-dles-dolomites-lang": [163.2, 138],
    "oetztaler-radmarathon": [227.4, 227],
    "route-des-grandes-alpes": [760, 700],
    sellaronda: [63.5, 52],
    "stilfserjoch-umbrail-runde": [65.8, 70],
    "vrsic-predil-runde": [95.9, 105],
  };
  for (const [slug, [km, statedKm]] of Object.entries(routed)) {
    const sparse =
      slug === "sellaronda" || slug === "maratona-dles-dolomites-lang";
    test(`${sparse ? "rejects" : "accepts"} ${slug}`, () => {
      const reasons = checkTour(tourMetricsOf(km, statedKm));
      expect(reasons.length > 0).toBe(sparse);
      if (sparse) expect(reasons[0]).toContain("Länge");
    });
  }

  test("kmDelta boundary, both signs", () => {
    const L = LIMITS.tour.maxKmDelta;
    expect(checkTour({ ...tourMetricsOf(100, 100), kmDelta: L })).toBeEmpty();
    expect(checkTour({ ...tourMetricsOf(100, 100), kmDelta: -L })).toBeEmpty();
    expect(
      checkTour({ ...tourMetricsOf(100, 100), kmDelta: L + 0.001 }),
    ).toHaveLength(1);
    expect(
      checkTour({ ...tourMetricsOf(100, 100), kmDelta: -L - 0.001 }),
    ).toHaveLength(1);
  });

  test("waypoint distance boundary at both ends", () => {
    const L = LIMITS.tour.maxWaypointDist;
    expect(
      checkTour({ ...tourMetricsOf(120, 120), endDist: L, startDist: L }),
    ).toBeEmpty();
    expect(
      checkTour({ ...tourMetricsOf(120, 120), startDist: L + 0.001 }).join(" "),
    ).toContain("ersten Wegpunkt");
    expect(
      checkTour({ ...tourMetricsOf(120, 120), endDist: L + 0.001 }).join(" "),
    ).toContain("letzten Wegpunkt");
  });

  test("tour.check widens a tour limit", () => {
    const long = tourMetricsOf(63.5, 52);
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
      avgGradient: 10,
      dist: [0, 5, 10],
      ele: [1000, 2000, 1900],
      elevationGain: 1000,
      km: 10,
      maxKmGradient: 20,
      start: 1000,
      top: 2000,
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

describe("inputsHash", () => {
  const from = { lat: 47.226, lon: 12.826 };
  const summit = { lat: 47.081, lon: 12.831 };
  const base = () => inputsHash({ elevation: 2571, from, summit });

  test("is stable for equal inputs, whatever the key order", () => {
    expect(base()).toBe(inputsHash({ elevation: 2571, from, summit }));
  });

  test("changes with a moved coordinate or a changed elevation", () => {
    expect(
      inputsHash({
        elevation: 2571,
        from,
        summit: { lat: 47.0836, lon: 12.8428 },
      }),
    ).not.toBe(base());
    expect(inputsHash({ elevation: 2504, from, summit })).not.toBe(base());
  });

  test("a check counts by its limits, not by its note", () => {
    const widened = inputsHash(
      { elevation: 2571, from, summit },
      { maxEndDist: 0.8, note: "a" },
    );
    expect(widened).not.toBe(base());
    expect(widened).toBe(
      inputsHash(
        { elevation: 2571, from, summit },
        { maxEndDist: 0.8, note: "b" },
      ),
    );
  });
});

describe("checkRoad", () => {
  test("unmeasured is not a finding, none within reach is", () => {
    const notYetMeasured: { roadDist?: number | null } = {};
    expect(checkRoad(notYetMeasured.roadDist)).toEqual([]);
    expect(checkRoad(null)).toHaveLength(1);
  });

  test("the Großglockner point at 1 km is caught, a point at 40 m is fine", () => {
    expect(checkRoad(0.98)[0]).toContain("980 m");
    expect(checkRoad(0.04)).toEqual([]);
  });
});
