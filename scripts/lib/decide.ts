/**
 * What a build has to do, decided before anything is asked.
 *
 * Every rule about *when* a route is fetched, a rejection retried, a profile
 * paid for or an ascent held back lives here, as a function of two values: the
 * curated data and what is already stored. Nothing in this module reads a
 * file, a clock or an environment variable, so each rule can be put in front
 * of a table of cases and the answer read off – which is the point, because
 * the subtlest of them (a failing upgrade candidate that must not evict the
 * route it was meant to replace) is reachable in production only through a
 * live run on a road one router refuses.
 *
 * `plan()` applies them all and is the single source of the three renderings
 * the pipeline shows: `data:build --status`, `data:build --pending` and the
 * report a run prints at both ends. `data:check` calls the same function, so
 * what it tells the curator about a key is what the next build will actually
 * do with it, rather than a second derivation that can disagree.
 */
import { isTraverse, isUnpaved } from "../../lib/regions";
import { ascentKey, tourKey } from "../../lib/route-key";
import type {
  AscentCheck,
  ClimateYear,
  ElevationProfile,
  LatLon,
  Pass,
  RouteGeometry,
  RouteMeta,
  RouteMetrics,
  RouteRejection,
  RouteSource,
  Summit,
  Tour,
  TourCheck,
  TourMetrics,
} from "../../lib/types";
import { ARCHIVE_DAILY } from "./climate";
import {
  ascentInputs,
  ascentMetrics,
  checkRoadAscent,
  checkTour,
  profileOf,
  suspectPoint,
  tourInputs,
  tourMetrics,
} from "./validate";
import type { Finding, Marker, RoutingProfile } from "./validate";

/** Everything `data:build` has written so far, as one value. */
export interface Stored {
  climates: Record<string, ClimateYear>;
  meta: Record<string, RouteMeta>;
  profiles: Record<string, ElevationProfile>;
  rejected: Record<string, RouteRejection>;
  routes: Record<string, RouteGeometry>;
  summits: Record<string, Summit>;
}

/** The hand-maintained side of the question. */
export interface Curated {
  passes: Pass[];
  tours: Tour[];
}

export interface Flags {
  /** Restrict the run to keys containing this, e.g. `--only col-du-galibier`. */
  only?: string;
  /**
   * A road-cycling key is configured. Not a flag of the command line but of
   * the environment, and it belongs here because it is what makes a stored
   * car-profile route provisional: without ORS there is nothing better to
   * come, and the profile is paid for straight away.
   */
  ors: boolean;
  /** `--retry-rejected`: ask again for every rejected key, whatever it says. */
  retryRejected: boolean;
  /** `--upgrade-osrm`: re-route the stored car-profile routes. */
  upgradeOsrm: boolean;
}

/**
 * One route to fetch, measure and judge. `ascent` is a climb to a road's own
 * marker, `traverse` one ride along a road that has no summit to aim at
 * (`plateau`, `balcony`, `valley`) – measured against the tour limits, but
 * belonging to a road and therefore earning a profile like any ascent. `tour`
 * is a loop of `tours.json`.
 */
export type RouteJob = {
  /** What the route is asked for, see `inputsHash`. */
  inputs: string;
  key: string;
  label: string;
  /** The router's graph, from the road's surface (`profileOf`). */
  profile: RoutingProfile;
  waypoints: LatLon[];
} & (
  | {
      check?: AscentCheck;
      from: LatLon;
      kind: "ascent";
      marker: Marker;
    }
  | {
      check?: TourCheck;
      from: LatLon;
      kind: "traverse";
      marker: Marker;
      statedKm: number;
      to: LatLon;
    }
  | { check?: TourCheck; kind: "tour"; statedKm: number }
);

/** A job that belongs to a road, so it has a marker and earns a profile. */
export const ofRoad = (
  j: RouteJob,
): j is RouteJob & { kind: "ascent" | "traverse"; marker: Marker } =>
  j.kind !== "tour";

const markerOf = (p: Pass): Marker => ({
  elevation: p.elevation,
  lat: p.lat,
  lon: p.lon,
  slug: p.slug,
  type: p.type,
});

/** Every route the curated data asks for, in the order a run works through them. */
export const routeJobs = (passes: Pass[], tours: Tour[]): RouteJob[] => [
  ...passes.flatMap((p) => {
    const marker = markerOf(p);
    const summit = { lat: p.lat, lon: p.lon };
    const profile = profileOf(p.surface);
    return p.ascents.map((a, i): RouteJob => {
      const key = ascentKey(p.slug, i);
      const label = `${p.name} ab ${a.label}`;
      // A traverse is routed between its two curated ends and judged against
      // its stated length; a climb is routed to the marker (`roadMetrics`).
      if (isTraverse(p.type))
        return {
          check: a.check,
          from: a.from,
          inputs: ascentInputs(true, p, a, profile),
          key,
          kind: "traverse",
          label,
          marker,
          profile,
          statedKm: a.km ?? 0,
          to: a.to ?? summit,
          waypoints: [a.from, a.to ?? summit],
        };
      return {
        check: a.check,
        from: a.from,
        inputs: ascentInputs(false, p, a, profile),
        key,
        kind: "ascent",
        label,
        marker,
        profile,
        waypoints: [a.from, summit],
      };
    });
  }),
  ...tours.map((t): RouteJob => {
    const profile = profileOf(t.surface);
    return {
      check: t.check,
      inputs: tourInputs(t, profile),
      key: tourKey(t.slug),
      kind: "tour",
      label: `Tour ${t.name}`,
      profile,
      statedKm: t.km,
      waypoints: t.waypoints,
    };
  }),
];

/** Measure a geometry; the profile fields stay null until one has been fetched. */
export const measure = (job: RouteJob, geom: RouteGeometry): RouteMetrics =>
  job.kind === "ascent"
    ? ascentMetrics(geom, job.from, {
        lat: job.marker.lat,
        lon: job.marker.lon,
      })
    : tourMetrics(geom, job.waypoints, job.statedKm);

/** Judge what `measure` measured, against the limits that measurement belongs to. */
export const judge = (job: RouteJob, m: RouteMetrics): string[] =>
  job.kind === "tour"
    ? checkTour(m as TourMetrics, job.check)
    : checkRoadAscent(job.kind === "traverse", m, job.check);

// ── The rules ────────────────────────────────────────────────────────────────

/**
 * The pass point is not where its elevation says, or not on a road. The
 * summit checks hold for every type: a marker has a stated height and has to
 * sit on a road, whatever kind of road it is. Only a measured failure counts –
 * an entry that has not been read at this coordinate yet is not a fault, and
 * the same run measures it a few steps earlier.
 */
export const markerFinding = (job: RouteJob, stored: Stored): Finding | null =>
  ofRoad(job)
    ? suspectPoint(job.marker, stored.summits[job.marker.slug])
    : null;

const blockedBy = (finding: Finding | null) =>
  finding?.reasons.filter((r) => r.blocks) ?? [];

/**
 * Re-routing a stored OSRM route also invalidates its profile, and a profile
 * is 100 Open-Meteo calls – upgrading everything at once costs more than
 * filling every gap. So the upgrade is a deliberate second campaign behind
 * `--upgrade-osrm`; until it has run, `data:check` warns about each car-profile
 * route it finds.
 */
export const upgradable = (job: RouteJob, stored: Stored, flags: Flags) =>
  stored.routes[job.key] !== undefined &&
  flags.ors &&
  (stored.meta[job.key]?.source ?? "osrm") === "osrm" &&
  // ORS has been asked about this road and said it does not carry it. Asking
  // again on every upgrade pass buys the same 404; `--retry-rejected` is the
  // way back in, for when ORS' own graph has moved.
  (flags.retryRejected || !stored.meta[job.key]?.orsDeclined);

/**
 * An OSRM route ORS has not been asked about yet. Once ORS has answered and
 * the gate refused that answer (the key is in rejected.json next to the
 * stored route), the OSRM route is as final as it gets and earns its profile.
 */
export const provisional = (job: RouteJob, stored: Stored, flags: Flags) =>
  upgradable(job, stored, flags) && !(job.key in stored.rejected);

/**
 * A stored route was fetched for a question – the ascent's start, the marker,
 * the `check` – and `meta.inputs` records which one. When the curator moves a
 * coordinate, the stored geometry still ends where the old marker was: only
 * `data:check` saw it, as an error no command could clear (Umbrailpass,
 * September 2026, 750 m short of its moved pass point). So a hash that no
 * longer matches makes a route as pending as a missing one.
 */
export const staleRoute = (job: RouteJob, stored: Stored) =>
  stored.routes[job.key] !== undefined &&
  stored.meta[job.key]?.inputs !== job.inputs;

/**
 * A rejection is retried when it could come out differently: the curator
 * changed the inputs, or the stored metrics pass the current limits (a limit
 * was changed, or a `check` was set). Otherwise the router would give the same
 * answer, and asking again only rewrites `lastSeen`.
 */
export const retryDue = (job: RouteJob, stored: Stored, flags: Flags) => {
  const r = stored.rejected[job.key];
  if (!r) return false;
  if (flags.retryRejected) return true;
  if (r.inputs !== job.inputs) return true;
  return judge(job, r.metrics).length === 0;
};

/** What a run does with one route key. */
export type RouteVerdict =
  /**
   * Ask the router. `fetch` is a gap or a question that changed, `retry` a
   * rejection whose outcome could be different today; `replace` says the
   * stored route answers nobody's question any more and must not be fallen
   * back on, `upgrade` that a passing route is already stored.
   */
  | { act: "fetch" | "retry"; replace: boolean; upgrade: boolean }
  /** The stored route answers today's question. */
  | { act: "keep" }
  /** Rejected, and nothing has moved – asking again repeats the rejection. */
  | { act: "skip"; why: string }
  /** The marker fails its own checks; every ride of that road waits for it. */
  | { act: "blocked"; why: string };

export const decideRoute = (
  job: RouteJob,
  stored: Stored,
  flags: Flags,
): RouteVerdict => {
  const blocks = blockedBy(markerFinding(job, stored));
  if (blocks.length)
    return { act: "blocked", why: blocks.map((r) => r.text).join("; ") };
  const rejection = stored.rejected[job.key];
  const retry = rejection !== undefined && retryDue(job, stored, flags);
  if (rejection && !retry)
    return {
      act: "skip",
      why: `abgewiesen seit ${rejection.firstSeen}, Eingaben und Grenzen unverändert`,
    };
  const replace = staleRoute(job, stored);
  const hasRoute = stored.routes[job.key] !== undefined;
  const needed =
    !hasRoute ||
    replace ||
    (flags.upgradeOsrm && upgradable(job, stored, flags));
  return needed
    ? { act: retry ? "retry" : "fetch", replace, upgrade: hasRoute && !replace }
    : { act: "keep" };
};

/** What a run does with one key's elevation profile. */
export type ProfileVerdict =
  /** Pay for the elevation samples. */
  | { act: "fetch" }
  /** It has one already, or it is a tour, which earns none. */
  | { act: "keep" }
  /** The routing pipeline owns this key this run and hands the profile on. */
  | { act: "routing" }
  /** No geometry to sample yet. */
  | { act: "missing" }
  /** The marker fails its own checks, so nothing is paid for this road. */
  | { act: "blocked"; why: string }
  /** A provisional car-profile route: the geometry is not final yet. */
  | { act: "deferred" };

export const decideProfile = (
  job: RouteJob,
  stored: Stored,
  flags: Flags,
  route: RouteVerdict,
): ProfileVerdict => {
  if (!ofRoad(job)) return { act: "keep" };
  if (route.act === "blocked") return { act: "blocked", why: route.why };
  // Two pipelines never work on one key at once: a key the routing is about to
  // re-fetch gets its profile from that pipeline, on the new geometry.
  if (route.act === "fetch" || route.act === "retry") return { act: "routing" };
  if (stored.routes[job.key] === undefined) return { act: "missing" };
  if (stored.profiles[job.key]) return { act: "keep" };
  return provisional(job, stored, flags)
    ? { act: "deferred" }
    : { act: "fetch" };
};

// ── The plan ─────────────────────────────────────────────────────────────────

export interface Decided<V> {
  job: RouteJob;
  verdict: V;
}

/** Every number the report, `--status` and `--pending` are rendered from. */
export interface Counts {
  /** Rides held back by their marker. */
  blocked: number;
  climate: number;
  /** Rejections that sit next to a stored route, which stays on the map. */
  kept: number;
  /** Profiles this run would pay for, including those of the routes it fetches. */
  newProfiles: number;
  /** The one number `--pending` prints. */
  pending: number;
  profiles: number;
  rejected: number;
  /** Markers whose road distance is still unmeasured, plus the ones just moved. */
  roads: number;
  routes: number;
  /** Stored routes fetched for a question that has since changed. */
  stale: number;
  summits: number;
  /** Stored car-profile routes ORS has not been asked about. */
  upgradable: number;
}

export interface Plan {
  climate: Pass[];
  counts: Counts;
  /** Markers that fail their own checks, with what is wrong with them. */
  findings: { finding: Finding; pass: Pass }[];
  profiles: Decided<ProfileVerdict>[];
  roads: Pass[];
  routes: Decided<RouteVerdict>[];
  summits: Pass[];
}

/**
 * A series is asked for when there is none – or when the road is unpaved,
 * the stored series predates the snow cover (plan 27) and the archive is
 * asked for it now (`asksCover`, off `ARCHIVE_DAILY`): the cover is the rung
 * that closes such a road, and a series without it never would. Until the
 * request carries the variable, asking again would cost ~260 calls for the
 * same answer. A paved road keeps its series; it never reads the cover.
 */
export const lacksClimate = (
  pass: Pick<Pass, "slug" | "surface">,
  climates: Record<string, ClimateYear>,
  asksCover = ARCHIVE_DAILY.includes("snow_depth_mean"),
): boolean => {
  const series = climates[pass.slug];
  if (!series) return true;
  return (
    asksCover &&
    isUnpaved(pass.surface) &&
    series.every((b) => b?.coverPct === undefined)
  );
};

/** An unpaved road whose stored series carries no snow cover (plan 27). */
export const lacksCover = (
  pass: Pick<Pass, "slug" | "surface">,
  climates: Record<string, ClimateYear>,
): boolean =>
  isUnpaved(pass.surface) &&
  (climates[pass.slug]?.every((b) => b?.coverPct === undefined) ?? false);

/** The DEM height was read at the coordinate the entry carries today. */
const measuredAt = (p: Pass, s: Summit | undefined) =>
  s !== undefined && s.lat === p.lat && s.lon === p.lon;

export const plan = (curated: Curated, stored: Stored, flags: Flags): Plan => {
  const wanted = (key: string) =>
    flags.only === undefined || key.includes(flags.only);
  const jobs = routeJobs(curated.passes, curated.tours).filter((j) =>
    wanted(j.key),
  );
  const routes = jobs.map((job) => ({
    job,
    verdict: decideRoute(job, stored, flags),
  }));
  const profiles = routes.map(({ job, verdict }) => ({
    job,
    verdict: decideProfile(job, stored, flags, verdict),
  }));
  const passes = curated.passes.filter((p) => wanted(p.slug));
  const climate = passes.filter((p) => lacksClimate(p, stored.climates));
  /** Missing, or measured at a coordinate that has since moved. */
  const summits = passes.filter((p) => !measuredAt(p, stored.summits[p.slug]));
  /** Entries that still lack the road distance (predate the check, or just fetched). */
  const roads = passes.filter(
    (p) =>
      measuredAt(p, stored.summits[p.slug]) &&
      stored.summits[p.slug]?.roadDist === undefined,
  );
  const findings = passes.flatMap((p) => {
    const finding = suspectPoint(markerOf(p), stored.summits[p.slug]);
    return finding ? [{ finding, pass: p }] : [];
  });

  const fetching = routes.filter(
    ({ verdict }) => verdict.act === "fetch" || verdict.act === "retry",
  );
  const paying = profiles.filter(({ verdict }) => verdict.act === "fetch");
  const rejectedKeys = Object.keys(stored.rejected).filter(wanted);
  const counts: Counts = {
    blocked: routes.filter(({ verdict }) => verdict.act === "blocked").length,
    climate: climate.length,
    kept: rejectedKeys.filter((k) => stored.routes[k]).length,
    // A newly routed ride needs a profile too, and that is what actually costs.
    newProfiles:
      paying.length + fetching.filter(({ job }) => ofRoad(job)).length,
    pending: 0,
    profiles: paying.length,
    rejected: rejectedKeys.length,
    roads: roads.length + summits.length,
    routes: fetching.length,
    stale: jobs.filter((j) => staleRoute(j, stored)).length,
    summits: summits.length,
    upgradable: jobs.filter((j) => provisional(j, stored, flags)).length,
  };
  counts.pending =
    counts.routes +
    counts.profiles +
    counts.climate +
    counts.summits +
    roads.length;
  return { climate, counts, findings, profiles, roads, routes, summits };
};

// ── The gate's outcome, as a value ───────────────────────────────────────────

/**
 * What a candidate would replace: the stored route, its meta and its profile,
 * so a failing candidate can put them back. Nothing to keep when the geometry
 * is only being re-judged (it *is* the stored route), and nothing when the
 * stored route is stale – that one answers a question nobody asks any more.
 */
export interface Kept {
  geom: RouteGeometry;
  meta?: RouteMeta;
  profile?: ElevationProfile;
}

export const storedFor = (
  job: RouteJob,
  stored: Stored,
  /** False when the geometry came out of routes.json and is only being judged. */
  fetched: boolean,
  replace: boolean,
): Kept | undefined => {
  const geom = stored.routes[job.key];
  return fetched && !replace && geom
    ? { geom, meta: stored.meta[job.key], profile: stored.profiles[job.key] }
    : undefined;
};

/** What the gate saw of one candidate, once it has been measured and judged. */
export interface Judged {
  /** A profile from an earlier rejection of this very geometry, if there is one. */
  cachedProfile?: ElevationProfile;
  geom: RouteGeometry;
  hash: string;
  /** What this candidate would replace, from `storedFor`. */
  keep?: Kept;
  metrics: RouteMetrics;
  /** ORS has no answer for this road; recorded so nothing asks again in vain. */
  orsDeclined: boolean;
  /** The candidate's own profile, once one has been paid for. */
  profile?: ElevationProfile;
  /** Why it failed; empty means it passed. */
  reasons: string[];
  source: RouteSource;
  /** ISO date of this run. */
  today: string;
}

const without = <T>(record: Record<string, T>, key: string) => {
  const { [key]: _gone, ...rest } = record;
  return rest;
};

/**
 * The records the gate's verdict leaves behind, as a value rather than as six
 * functions writing into six module-scope objects.
 *
 * Two rules keep the gate from eating its own work, and both are here. A
 * rejected candidate never evicts a stored route: when ORS's answer for a
 * stored OSRM route fails the checks, the rejection is recorded next to the
 * route (`keep`) and the OSRM route stays on the map – otherwise an upgrade
 * pass turns a passing route into a gap, the next run falls back to OSRM, and
 * the pair loops forever. And a rejection caches the candidate's profile,
 * because that is the only expensive part: a retry after a threshold change
 * then costs nothing. The cache is only ever kept for the very geometry it was
 * measured on – a stored route's profile, or one from an earlier candidate
 * with another hash, would be reused for the wrong road.
 */
export const afterGate = (
  job: RouteJob,
  stored: Stored,
  judged: Judged,
): Partial<Stored> => {
  const { key } = job;
  if (judged.reasons.length) {
    const before = stored.rejected[key];
    const unchanged = before?.hash === judged.hash;
    const cached = judged.profile ?? (unchanged ? before?.profile : undefined);
    const rejected = {
      ...stored.rejected,
      [key]: {
        firstSeen: before?.firstSeen ?? judged.today,
        hash: judged.hash,
        inputs: job.inputs,
        lastSeen: judged.today,
        metrics: judged.metrics,
        reasons: judged.reasons,
        source: judged.source,
        ...(cached ? { profile: cached } : {}),
      },
    };
    const { keep } = judged;
    if (!keep)
      return {
        meta: without(stored.meta, key),
        profiles: without(stored.profiles, key),
        rejected,
        routes: without(stored.routes, key),
      };
    return {
      meta: keep.meta
        ? { ...stored.meta, [key]: keep.meta }
        : without(stored.meta, key),
      profiles: keep.profile
        ? { ...stored.profiles, [key]: keep.profile }
        : without(stored.profiles, key),
      rejected,
      routes: { ...stored.routes, [key]: keep.geom },
    };
  }

  const next: Partial<Stored> = {
    meta: {
      ...stored.meta,
      [key]: {
        fetchedAt: judged.today,
        inputs: job.inputs,
        source: judged.source,
        ...(judged.orsDeclined ? { orsDeclined: true as const } : {}),
      },
    },
    rejected: without(stored.rejected, key),
    routes: { ...stored.routes, [key]: judged.geom },
  };
  if (judged.profile)
    return { ...next, profiles: { ...stored.profiles, [key]: judged.profile } };
  // The geometry was just replaced, so a stored profile belongs to a road that
  // is no longer there. It goes before anything is fetched, otherwise a run
  // that runs out of Open-Meteo budget leaves the old road's profile behind.
  return !(judged.keep || judged.cachedProfile) && stored.profiles[key]
    ? { ...next, profiles: without(stored.profiles, key) }
    : next;
};

/**
 * ORS was asked again and refused the road again, so the stored car-profile
 * route is as good as this key gets. Recorded on the spot: without it every
 * `data:check` asks for an upgrade that cannot come and every `--upgrade-osrm`
 * re-asks ORS about five roads it has been refusing since the first run.
 * `null` when the record already says so.
 */
export const afterDecline = (
  job: RouteJob,
  stored: Stored,
  declined: boolean,
): Partial<Stored> | null => {
  const m = stored.meta[job.key];
  if (!m || (m.orsDeclined ?? false) === declined) return null;
  return {
    meta: {
      ...stored.meta,
      [job.key]: declined
        ? { ...m, orsDeclined: true }
        : { fetchedAt: m.fetchedAt, inputs: m.inputs, source: m.source },
    },
  };
};
