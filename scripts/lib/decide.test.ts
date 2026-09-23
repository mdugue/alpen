import { describe, expect, test } from "bun:test";

import type {
  AscentMetrics,
  ElevationProfile,
  Pass,
  RouteGeometry,
  RouteRejection,
  Summit,
  Tour,
} from "../../lib/types";
import {
  afterDecline,
  afterGate,
  decideProfile,
  decideRoute,
  plan,
  routeJobs,
  storedFor,
} from "./decide";
import type { Flags, Judged, Stored } from "./decide";
import { ascentInputs } from "./validate";

const pass = (over: Partial<Pass> = {}): Pass => ({
  ascents: [
    { from: { lat: 46.5, lon: 10 }, label: "Prato" },
    { from: { lat: 46.6, lon: 10.2 }, label: "Bormio" },
  ],
  beauty: 5,
  classicAscent: "",
  country: "IT",
  difficulty: 5,
  elevation: 2757,
  fame: 5,
  lat: 46.53,
  lon: 10.45,
  name: "Stilfser Joch",
  note: "",
  region: "Ostalpen",
  season: null,
  slug: "stilfser-joch",
  surface: "asphalt",
  traffic: 3,
  type: "pass",
  ...over,
});

const balcony = pass({
  ascents: [
    {
      from: { lat: 46.1, lon: 11 },
      km: 20,
      label: "Ost",
      to: { lat: 46.2, lon: 11.2 },
    },
  ],
  elevation: 1200,
  name: "Altopiano",
  slug: "altopiano",
  type: "balcony",
});

const tour = (over: Partial<Tour> = {}): Tour => ({
  color: "#ff0000",
  description: "",
  elevationGain: 4000,
  km: 174,
  name: "Marmotte",
  note: "",
  passes: ["stilfser-joch"],
  season: null,
  slug: "marmotte",
  surface: "asphalt",
  waypoints: [
    { lat: 45, lon: 6 },
    { lat: 45.2, lon: 6.2 },
  ],
  ...over,
});

const empty = (): Stored => ({
  climates: {},
  meta: {},
  profiles: {},
  rejected: {},
  routes: {},
  summits: {},
});

const flags = (over: Partial<Flags> = {}): Flags => ({
  ors: false,
  retryRejected: false,
  upgradeOsrm: false,
  ...over,
});

/** A marker the gate is happy with: the DEM agrees and a road is right there. */
const goodSummit = (p: Pass): Summit => ({
  dem: p.elevation,
  lat: p.lat,
  lon: p.lon,
  roadDist: 0.01,
});

const geom: RouteGeometry = [
  [46.5, 10],
  [46.53, 10.45],
];
const profile = (): ElevationProfile => ({
  avgGradient: 7,
  dist: [0, 10],
  ele: [1200, 2757],
  elevationGain: 1557,
  km: 10,
  maxKmGradient: 9,
  start: 1200,
  top: 2757,
});
const passingMetrics: AscentMetrics = {
  endDist: 0.01,
  gain: 1500,
  km: 20,
  peakAt: 0.99,
  startDist: 0.01,
  topDelta: 5,
};
const failingMetrics: AscentMetrics = { ...passingMetrics, km: 400 };

const jobs = (passes: Pass[] = [pass()], tours: Tour[] = []) =>
  routeJobs(passes, tours);
const first = () => jobs()[0]!;

const rejection = (over: Partial<RouteRejection>): RouteRejection => ({
  firstSeen: "2026-01-01",
  hash: "abc",
  inputs: "x",
  lastSeen: "2026-01-02",
  metrics: failingMetrics,
  reasons: ["Länge 400 km > 60 km"],
  source: "ors",
  ...over,
});

describe("routeJobs", () => {
  test("one job per ascent, one per tour, keyed as the files are", () => {
    const all = jobs([pass(), balcony], [tour()]);
    expect(all.map((j) => j.key)).toEqual([
      "stilfser-joch:0",
      "stilfser-joch:1",
      "altopiano:0",
      "tour:marmotte",
    ]);
    expect(all.map((j) => j.kind)).toEqual([
      "ascent",
      "ascent",
      "traverse",
      "tour",
    ]);
  });

  test("a climb is routed to the marker, a traverse between its curated ends", () => {
    const [climb, , traverse] = jobs([pass(), balcony]);
    expect(climb!.waypoints).toEqual([
      { lat: 46.5, lon: 10 },
      { lat: 46.53, lon: 10.45 },
    ]);
    expect(traverse!.waypoints).toEqual([
      { lat: 46.1, lon: 11 },
      { lat: 46.2, lon: 11.2 },
    ]);
  });
});

describe("decideRoute", () => {
  const p = pass();
  const job = first();
  const withSummit = (over: Partial<Stored> = {}): Stored => ({
    ...empty(),
    summits: { [p.slug]: goodSummit(p) },
    ...over,
  });

  test("nothing stored: fetch, nothing to replace or upgrade", () => {
    expect(decideRoute(job, withSummit(), flags())).toEqual({
      act: "fetch",
      replace: false,
      upgrade: false,
    });
  });

  test("a stored route for today's question: keep", () => {
    const stored = withSummit({
      meta: {
        [job.key]: {
          fetchedAt: "2026-01-01",
          inputs: job.inputs,
          source: "ors",
        },
      },
      routes: { [job.key]: geom },
    });
    expect(decideRoute(job, stored, flags())).toEqual({ act: "keep" });
  });

  test("a moved coordinate makes the stored route as pending as a missing one", () => {
    const stored = withSummit({
      meta: {
        [job.key]: {
          fetchedAt: "2026-01-01",
          inputs: "von-gestern",
          source: "ors",
        },
      },
      routes: { [job.key]: geom },
    });
    expect(decideRoute(job, stored, flags())).toEqual({
      act: "fetch",
      replace: true,
      upgrade: false,
    });
  });

  test("an OSRM route is upgraded only when asked, and only with a key", () => {
    const stored = withSummit({
      meta: {
        [job.key]: {
          fetchedAt: "2026-01-01",
          inputs: job.inputs,
          source: "osrm",
        },
      },
      routes: { [job.key]: geom },
    });
    expect(decideRoute(job, stored, flags({ upgradeOsrm: true })).act).toBe(
      "keep",
    );
    expect(
      decideRoute(job, stored, flags({ ors: true, upgradeOsrm: true })),
    ).toEqual({ act: "fetch", replace: false, upgrade: true });
  });

  test("ORS has refused this road: no upgrade until --retry-rejected", () => {
    const stored = withSummit({
      meta: {
        [job.key]: {
          fetchedAt: "2026-01-01",
          inputs: job.inputs,
          orsDeclined: true,
          source: "osrm",
        },
      },
      routes: { [job.key]: geom },
    });
    const f = flags({ ors: true, upgradeOsrm: true });
    expect(decideRoute(job, stored, f).act).toBe("keep");
    expect(decideRoute(job, stored, { ...f, retryRejected: true }).act).toBe(
      "fetch",
    );
  });

  test("a rejection whose inputs and limits stand is not asked again", () => {
    const stored = withSummit({
      rejected: { [job.key]: rejection({ inputs: job.inputs }) },
    });
    const verdict = decideRoute(job, stored, flags());
    expect(verdict.act).toBe("skip");
    expect(verdict.act === "skip" && verdict.why).toContain("2026-01-01");
  });

  test("a rejection is retried when the curator moved something", () => {
    const stored = withSummit({
      rejected: { [job.key]: rejection({ inputs: "von-gestern" }) },
    });
    expect(decideRoute(job, stored, flags())).toEqual({
      act: "retry",
      replace: false,
      upgrade: false,
    });
  });

  test("…and when its stored metrics would pass the current limits", () => {
    const stored = withSummit({
      rejected: {
        [job.key]: rejection({ inputs: job.inputs, metrics: passingMetrics }),
      },
    });
    expect(decideRoute(job, stored, flags()).act).toBe("retry");
  });

  test("--retry-rejected asks regardless", () => {
    const stored = withSummit({
      rejected: { [job.key]: rejection({ inputs: job.inputs }) },
    });
    expect(decideRoute(job, stored, flags({ retryRejected: true })).act).toBe(
      "retry",
    );
  });

  test("a marker that fails its own checks blocks every ride of that road", () => {
    const stored: Stored = {
      ...empty(),
      summits: { [p.slug]: { ...goodSummit(p), dem: p.elevation - 900 } },
    };
    const verdict = decideRoute(job, stored, flags());
    expect(verdict.act).toBe("blocked");
    expect(verdict.act === "blocked" && verdict.why).toContain("DEM-Höhe");
  });

  test("a marker that has not been measured yet blocks nothing", () => {
    expect(decideRoute(job, empty(), flags()).act).toBe("fetch");
  });
});

describe("decideProfile", () => {
  const p = pass();
  const job = first();
  const base = (over: Partial<Stored> = {}): Stored => ({
    ...empty(),
    summits: { [p.slug]: goodSummit(p) },
    ...over,
  });
  const decide = (stored: Stored, f = flags()) =>
    decideProfile(job, stored, f, decideRoute(job, stored, f)).act;

  test("a tour earns no profile", () => {
    const tourJob = routeJobs([], [tour()])[0]!;
    const stored = empty();
    expect(
      decideProfile(
        tourJob,
        stored,
        flags(),
        decideRoute(tourJob, stored, flags()),
      ).act,
    ).toBe("keep");
  });

  test("nothing is paid for behind a blocked marker", () => {
    const stored = base({
      profiles: {},
      routes: { [job.key]: geom },
      summits: { [p.slug]: { ...goodSummit(p), roadDist: 5 } },
    });
    expect(decide(stored)).toBe("blocked");
  });

  test("a key the routing owns this run is left to the routing", () => {
    expect(decide(base())).toBe("routing");
  });

  test("no geometry, nothing to sample", () => {
    const stored = base({
      rejected: { [job.key]: rejection({ inputs: job.inputs }) },
    });
    expect(decide(stored)).toBe("missing");
  });

  test("a stored route without a profile is paid for", () => {
    const stored = base({
      meta: {
        [job.key]: {
          fetchedAt: "2026-01-01",
          inputs: job.inputs,
          source: "ors",
        },
      },
      routes: { [job.key]: geom },
    });
    expect(decide(stored)).toBe("fetch");
    expect(decide({ ...stored, profiles: { [job.key]: profile() } })).toBe(
      "keep",
    );
  });

  test("a provisional car-profile route waits for its upgrade", () => {
    const stored = base({
      meta: {
        [job.key]: {
          fetchedAt: "2026-01-01",
          inputs: job.inputs,
          source: "osrm",
        },
      },
      routes: { [job.key]: geom },
    });
    expect(decide(stored, flags({ ors: true }))).toBe("deferred");
    // Once ORS has been asked and the gate refused its answer, the car route
    // is as final as it gets and earns its profile.
    expect(
      decide(
        {
          ...stored,
          rejected: { [job.key]: rejection({ inputs: job.inputs }) },
        },
        flags({ ors: true }),
      ),
    ).toBe("fetch");
  });
});

describe("plan", () => {
  const p = pass();
  const other = pass({ name: "Gavia", slug: "passo-gavia" });
  const curated = { passes: [p, other], tours: [tour()] };
  const stored = (): Stored => ({
    ...empty(),
    summits: { [other.slug]: goodSummit(other), [p.slug]: goodSummit(p) },
  });

  test("--only filters every counter, not just the routes", () => {
    const all = plan(curated, stored(), flags());
    expect(all.counts.routes).toBe(5);
    expect(all.counts.climate).toBe(2);
    expect(all.counts.summits).toBe(0);

    const only = plan(curated, stored(), flags({ only: "passo-gavia" }));
    expect(only.counts.routes).toBe(2);
    expect(only.counts.climate).toBe(1);
    expect(only.routes.map(({ job }) => job.key)).toEqual([
      "passo-gavia:0",
      "passo-gavia:1",
    ]);
  });

  test("--pending is the sum the report is rendered from", () => {
    const { counts } = plan(curated, stored(), flags());
    expect(counts.pending).toBe(
      counts.routes + counts.profiles + counts.climate + counts.summits + 0,
    );
  });

  test("a marker that was never measured is a summit job, not a blocked road", () => {
    const { counts } = plan(curated, empty(), flags());
    expect(counts.summits).toBe(2);
    expect(counts.blocked).toBe(0);
  });

  test("a rejection next to a stored route is counted as kept", () => {
    const job = routeJobs([p], [])[0]!;
    const { counts } = plan(
      curated,
      {
        ...stored(),
        rejected: { [job.key]: rejection({ inputs: job.inputs }) },
        routes: { [job.key]: geom },
      },
      flags(),
    );
    expect(counts.kept).toBe(1);
    expect(counts.rejected).toBe(1);
  });
});

describe("afterGate", () => {
  const p = pass();
  const job = first();
  const judged = (over: Partial<Judged> = {}): Judged => ({
    geom,
    hash: "neu",
    metrics: passingMetrics,
    orsDeclined: false,
    reasons: [],
    source: "ors",
    today: "2026-09-22",
    ...over,
  });

  test("an accepted route is stored with what it was fetched for", () => {
    const next = afterGate(job, empty(), judged());
    expect(next.routes).toEqual({ [job.key]: geom });
    expect(next.meta).toEqual({
      [job.key]: {
        fetchedAt: "2026-09-22",
        inputs: job.inputs,
        source: "ors",
      },
    });
    expect(next.rejected).toEqual({});
    expect(next.profiles).toBeUndefined();
  });

  test("ORS refusing the road is recorded with the car route", () => {
    const next = afterGate(
      job,
      empty(),
      judged({ orsDeclined: true, source: "osrm" }),
    );
    expect(next.meta?.[job.key]?.orsDeclined).toBe(true);
  });

  test("a replaced geometry drops the profile of the road it replaced", () => {
    const before: Stored = {
      ...empty(),
      profiles: { [job.key]: profile() },
      routes: { [job.key]: geom },
    };
    expect(afterGate(job, before, judged()).profiles).toEqual({});
    // …but not when the profile that was just paid for belongs to it.
    expect(
      afterGate(job, before, judged({ profile: profile() })).profiles,
    ).toEqual({ [job.key]: profile() });
  });

  test("a refused candidate takes the key out and keeps the first date", () => {
    const before: Stored = {
      ...empty(),
      meta: {
        [job.key]: {
          fetchedAt: "2026-01-01",
          inputs: job.inputs,
          source: "ors",
        },
      },
      profiles: { [job.key]: profile() },
      rejected: {
        [job.key]: rejection({ firstSeen: "2026-05-05", hash: "alt" }),
      },
      routes: { [job.key]: geom },
    };
    const next = afterGate(
      job,
      before,
      judged({ metrics: failingMetrics, reasons: ["Länge 400 km > 60 km"] }),
    );
    expect(next.routes).toEqual({});
    expect(next.profiles).toEqual({});
    expect(next.meta).toEqual({});
    expect(next.rejected?.[job.key]).toMatchObject({
      firstSeen: "2026-05-05",
      hash: "neu",
      inputs: job.inputs,
      lastSeen: "2026-09-22",
      reasons: ["Länge 400 km > 60 km"],
    });
  });

  test("a cached profile survives only for the very geometry it was measured on", () => {
    const cached = profile();
    const before: Stored = {
      ...empty(),
      rejected: { [job.key]: rejection({ hash: "neu", profile: cached }) },
    };
    // Same geometry: the 100 Open-Meteo calls are not spent twice.
    expect(
      afterGate(job, before, judged({ reasons: ["kaputt"] })).rejected?.[
        job.key
      ]?.profile,
    ).toEqual(cached);
    // Another geometry: the cache belongs to a road this is not.
    expect(
      afterGate(job, before, judged({ hash: "anders", reasons: ["kaputt"] }))
        .rejected?.[job.key]?.profile,
    ).toBeUndefined();
  });

  /**
   * The path that no stored rejection exercises: an ORS candidate that fails
   * where an OSRM route is already on the map. Without it an upgrade pass
   * turns a passing route into a gap, the next run falls back to OSRM, and the
   * pair loops for ever.
   */
  test("a failing upgrade candidate never evicts the route it would replace", () => {
    const kept = profile();
    const before: Stored = {
      ...empty(),
      meta: {
        [job.key]: {
          fetchedAt: "2026-01-01",
          inputs: job.inputs,
          source: "osrm",
        },
      },
      profiles: { [job.key]: kept },
      routes: { [job.key]: geom },
      summits: { [p.slug]: goodSummit(p) },
    };
    const keep = storedFor(job, before, true, false);
    expect(keep).toEqual({
      geom,
      meta: before.meta[job.key],
      profile: kept,
    });
    const next = afterGate(
      job,
      before,
      judged({
        keep,
        metrics: failingMetrics,
        reasons: ["Länge 400 km > 60 km"],
      }),
    );
    expect(next.routes).toEqual({ [job.key]: geom });
    expect(next.meta).toEqual(before.meta);
    expect(next.profiles).toEqual({ [job.key]: kept });
    expect(next.rejected?.[job.key]?.source).toBe("ors");
  });

  test("a stale stored route is not a route to fall back on", () => {
    const before: Stored = {
      ...empty(),
      routes: { [job.key]: geom },
    };
    expect(storedFor(job, before, true, true)).toBeUndefined();
    // Nor is one that is only being re-judged: it *is* the stored route.
    expect(storedFor(job, before, false, false)).toBeUndefined();
  });
});

describe("afterDecline", () => {
  const job = first();
  const stored: Stored = {
    ...empty(),
    meta: {
      [job.key]: {
        fetchedAt: "2026-01-01",
        inputs: job.inputs,
        source: "osrm",
      },
    },
  };

  test("records the refusal once and says nothing the second time", () => {
    const next = afterDecline(job, stored, true);
    expect(next?.meta?.[job.key]?.orsDeclined).toBe(true);
    expect(afterDecline(job, { ...stored, ...next }, true)).toBeNull();
  });

  test("clears it again when ORS answers after all", () => {
    const declined = { ...stored, ...afterDecline(job, stored, true) };
    expect(
      afterDecline(job, declined, false)?.meta?.[job.key],
    ).not.toHaveProperty("orsDeclined");
  });
});

describe("the routing profile (plan 27)", () => {
  test("follows the surface, and only a mountain profile enters the inputs", () => {
    const paved = routeJobs([pass()], [])[0]!;
    const gravel = routeJobs([pass({ surface: "gravel" })], [])[0]!;
    expect(paved.profile).toBe("cycling-road");
    expect(gravel.profile).toBe("cycling-mountain");
    // A road stored before the surface existed keeps its hash: every one of
    // them was asked with the road profile.
    expect(paved.inputs).toBe(
      ascentInputs(false, pass(), pass().ascents[0]!, "cycling-road"),
    );
    expect(gravel.inputs).not.toBe(paved.inputs);
    expect(routeJobs([], [tour({ surface: "mixed" })])[0]!.profile).toBe(
      "cycling-mountain",
    );
  });
});
