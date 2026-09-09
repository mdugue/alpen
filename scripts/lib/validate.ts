/**
 * The route quality gate: measure a routed geometry, then judge it.
 *
 * Measuring and judging are deliberately separate. `ascentMetrics()` and
 * `tourMetrics()` only ever produce numbers; `checkAscent()` and `checkTour()`
 * compare those numbers against `LIMITS`. That split is what makes the
 * thresholds tunable: every stored route keeps its metrics, so re-judging the
 * whole dataset with a different limit is a local computation over JSON and
 * costs no API calls at all (see `bun run data:check --explain`).
 *
 * Pure functions, no I/O, no imports from the app – so the unit tests of
 * plan 10 can feed them the known-bad fixtures directly.
 */
import type {
  AscentCheck,
  AscentMetrics,
  ElevationProfile,
  LatLon,
  RouteGeometry,
  TourCheck,
  TourMetrics,
} from "../../lib/types";

/** Great-circle distance in km. */
export const haversine = (
  a: readonly [number, number],
  b: readonly [number, number],
) => {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const at = (p: LatLon): [number, number] => [p.lat, p.lon];
const round = (n: number, digits: number) => +n.toFixed(digits);
const fmtKm = (n: number) =>
  n < 1 ? `${Math.round(n * 1000)} m` : `${round(n, 1)} km`;
/** Drops `note` and any undefined key so the spread does not erase a default. */
const strip = (c?: AscentCheck | TourCheck) =>
  Object.fromEntries(
    Object.entries(c ?? {}).filter(([k, v]) => k !== "note" && v !== undefined),
  );

/** Length of a polyline in km. */
export const length = (geom: RouteGeometry) => {
  let km = 0;
  for (let i = 1; i < geom.length; i += 1)
    km += haversine(geom[i - 1]!, geom[i]!);
  return km;
};

/**
 * Default thresholds. Calibrated against the 88 routes stored before the gate
 * existed: every limit sits clear of the routes that are demonstrably right and
 * clear of the ones that are demonstrably wrong, rather than on a round number.
 * A single ascent or tour may widen one of them via its `check` – with a note.
 */
export const LIMITS = {
  ascent: {
    /** …and end at the summit marker. */
    maxEndDist: 0.5,
    /** A single ascent that gains more than this is routed over something else. */
    maxGain: 3000,
    /** Longest plausible single alpine ascent. */
    maxKm: 60,
    /** The route has to start where the ascent says it starts. */
    maxStartDist: 2,
    /** |profile top − pass.elevation|. Copernicus DEM noise is well inside this. */
    maxTopDelta: 80,
    /**
     * The highest sample belongs at the end of a climb, not in the middle.
     * Fitted to the gap in the existing data: the worst genuine failure sits at
     * 0.65, the tightest correct ascent (Grimselpass ab Gletsch, 6 km) at 0.81.
     */
    minPeakAt: 0.75,
  },
  /** DEM height at the pass coordinate vs. the stated `pass.elevation`. */
  summit: { maxDelta: 80 },
  tour: {
    /**
     * Relative deviation from the hand-maintained `tour.km`. Those figures come
     * from the events themselves (Marmotte 174 km, Ötztaler 227 km …), which is
     * a far better yardstick than a ratio against the straight waypoint legs –
     * that ratio depends on how densely a tour happens to be sampled, not on
     * whether the route is right.
     *
     * Fitted by routing all nine tours: seven land within ±7 % of their stated
     * distance, the two whose waypoints are too sparse to pin the loop down at
     * +29 % and +37 %. 0.15 sits in that gap.
     */
    maxKmDelta: 0.15,
    /** Distance from the route ends to the first/last waypoint. */
    maxWaypointDist: 2,
  },
} as const;

/** Geometry-only measurement, available before a profile is paid for. */
export const ascentMetrics = (
  geom: RouteGeometry,
  from: LatLon,
  summit: LatLon,
): AscentMetrics => ({
  endDist: round(haversine(geom.at(-1)!, at(summit)), 3),
  gain: null,
  km: round(length(geom), 2),
  peakAt: null,
  startDist: round(haversine(geom[0]!, at(from)), 3),
  topDelta: null,
});

/** Fills in the three profile metrics once the elevation samples exist. */
export const withProfile = (
  m: AscentMetrics,
  profile: ElevationProfile,
  elevation: number,
): AscentMetrics => {
  const total = profile.dist.at(-1) ?? 0;
  let peak = 0;
  for (let i = 1; i < profile.ele.length; i += 1)
    if (profile.ele[i]! > profile.ele[peak]!) peak = i;
  return {
    ...m,
    gain: profile.elevationGain,
    peakAt: total > 0 ? round(profile.dist[peak]! / total, 3) : 1,
    topDelta: profile.top - elevation,
  };
};

export const tourMetrics = (
  geom: RouteGeometry,
  waypoints: LatLon[],
  statedKm: number,
): TourMetrics => {
  const km = length(geom);
  return {
    endDist: round(haversine(geom.at(-1)!, at(waypoints.at(-1)!)), 3),
    km: round(km, 2),
    kmDelta: round(statedKm > 0 ? (km - statedKm) / statedKm : Infinity, 3),
    startDist: round(haversine(geom[0]!, at(waypoints[0]!)), 3),
    statedKm,
  };
};

/**
 * Reasons this ascent fails, as short German sentences carrying the measured
 * value – `data:check` prints them and a human has to be able to tell a routing
 * problem from a coordinate problem without opening anything else.
 */
export const checkAscent = (
  m: AscentMetrics,
  check?: AscentCheck,
): string[] => {
  const l = { ...LIMITS.ascent, ...strip(check) };
  const out: string[] = [];
  if (m.km > l.maxKm) out.push(`Länge ${m.km} km > ${l.maxKm} km`);
  if (m.startDist > l.maxStartDist)
    out.push(
      `Start ${fmtKm(m.startDist)} vom Auffahrtsbeginn entfernt > ${fmtKm(l.maxStartDist)}`,
    );
  if (m.endDist > l.maxEndDist)
    out.push(
      `Ende ${fmtKm(m.endDist)} vom Passpunkt entfernt > ${fmtKm(l.maxEndDist)}`,
    );
  if (m.topDelta !== null && Math.abs(m.topDelta) > l.maxTopDelta)
    out.push(
      `Profilhöhe weicht ${m.topDelta > 0 ? "+" : ""}${m.topDelta} m ab > ${l.maxTopDelta} m`,
    );
  if (m.peakAt !== null && m.peakAt < l.minPeakAt)
    out.push(
      `höchster Punkt bei ${Math.round(m.peakAt * 100)} % der Strecke < ${Math.round(l.minPeakAt * 100)} %`,
    );
  if (m.gain !== null && m.gain > l.maxGain)
    out.push(`Anstieg ${m.gain} Hm > ${l.maxGain} Hm`);
  return out;
};

export const checkTour = (m: TourMetrics, check?: TourCheck): string[] => {
  const l = { ...LIMITS.tour, ...strip(check) };
  const out: string[] = [];
  if (Math.abs(m.kmDelta) > l.maxKmDelta)
    out.push(
      `Länge ${m.km} km weicht ${m.kmDelta > 0 ? "+" : ""}${Math.round(m.kmDelta * 100)} % ` +
        `von den angegebenen ${m.statedKm} km ab > ${Math.round(l.maxKmDelta * 100)} %`,
    );
  if (m.startDist > l.maxWaypointDist)
    out.push(
      `Start ${fmtKm(m.startDist)} vom ersten Wegpunkt entfernt > ${fmtKm(l.maxWaypointDist)}`,
    );
  if (m.endDist > l.maxWaypointDist)
    out.push(
      `Ende ${fmtKm(m.endDist)} vom letzten Wegpunkt entfernt > ${fmtKm(l.maxWaypointDist)}`,
    );
  return out;
};

/** DEM height at the pass coordinate vs. the stated elevation. */
export const checkSummit = (dem: number, elevation: number): string[] => {
  const d = Math.round(dem - elevation);
  return Math.abs(d) > LIMITS.summit.maxDelta
    ? [
        `DEM-Höhe am Passpunkt weicht ${d > 0 ? "+" : ""}${d} m ab > ${LIMITS.summit.maxDelta} m`,
      ]
    : [];
};

/**
 * Identity of a geometry, so a retry can say "the router returned exactly the
 * same thing" – which means the fix belongs in `data/passes.json`, not here.
 * The hash is also what makes a cached profile reusable.
 *
 * Bun's hash is not promised to be stable across Bun versions. Both uses
 * degrade harmlessly if it ever changes: a stale hash reads as "the geometry
 * moved", which costs one re-fetched profile and never a wrong route.
 */
export const geometryHash = (geom: RouteGeometry) =>
  Bun.hash(
    geom.map(([lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join(";"),
  ).toString(16);

/**
 * Identity of what a route is asked for: the ascent's start and summit with
 * its elevation and `check`, or a tour's waypoints, stated length and `check`.
 * A rejection stores it so the next build can tell "the curator changed
 * something, try again" from "nothing changed, the answer would be the same" –
 * without that, a rejected key is either retried on every run (and, for an
 * OSRM route that ORS refuses, loops between the two routers) or never.
 * Key order is fixed here, so a reformatted `data/*.json` does not read as a
 * change; `check.note` is left out because it changes no limit.
 */
export const inputsHash = (
  parts: Record<string, unknown>,
  check?: AscentCheck | TourCheck,
) =>
  Bun.hash(
    JSON.stringify(
      Object.fromEntries(
        Object.entries({ ...parts, check: strip(check) }).toSorted(([a], [b]) =>
          a.localeCompare(b),
        ),
      ),
    ),
  ).toString(16);
