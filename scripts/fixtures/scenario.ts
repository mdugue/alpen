/**
 * What `scripts/pipeline.test.ts` runs the build on: two passes, one tour and
 * the state a previous run left behind.
 *
 * The coordinates are real – the Col du Galibier with its two sides, the Col
 * du Lautaret below it and the Sellaronda – and so are the geometries the
 * recorded answers carry, subsampled from `data/generated/routes.json`. The
 * entries are fixtures of their own rather than the curated data itself, so a
 * pass gained or a coordinate corrected in `data/passes.json` does not rewrite
 * this test's expectations.
 *
 * The scenario is chosen for the three paths a live run reaches only by
 * accident:
 *
 * - **Valloire** is the whole happy path: routed, judged, and a profile paid
 *   for and judged again.
 * - **Lautaret** is the keep/restore path. An OSRM route is stored and passes;
 *   `--upgrade-osrm` asks ORS, whose answer stops 2 km below the summit. The
 *   rejection is recorded *next to* the stored route, which stays on the map
 *   with its profile – without that rule an upgrade pass turns a passing route
 *   into a gap and the two routers loop forever.
 * - **fixtur-lautaret** is a plain rejection: no route stored, the candidate
 *   ends 2.3 km short, and its measured values land in `rejected.json` so a
 *   changed limit can re-judge it offline. ORS's second graph is asked about
 *   it, and about the Lautaret side, and stops just as short.
 * - **Briançon** is the second graph's path: the road-cycling answer goes
 *   round by Susa, Mont Cenis and the Galibier, the everyday graph takes the
 *   road – its geometry subsampled from `col-du-lautaret:1` – and the route
 *   is stored with the graph that answered it.
 */
import { profileDistances, profileStats } from "../../lib/profile";
import type {
  ClimateYear,
  ElevationProfile,
  Pass,
  RouteGeometry,
  Tour,
} from "../../lib/types";
import type { Curated, Flags, Stored } from "../lib/decide";
import { ascentInputs } from "../lib/validate";

/** Stamped onto everything the run writes, so the assertions are dates. */
export const TODAY = "2026-02-01";

/** The stored OSRM route of the Lautaret side, which a failing candidate must not evict. */
const LAUTARET_ROUTE: RouteGeometry = [
  [45.03398, 6.40533],
  [45.03898, 6.40069],
  [45.03735, 6.39652],
  [45.04198, 6.3992],
  [45.04875, 6.39477],
  [45.05235, 6.39027],
  [45.05314, 6.40239],
  [45.05714, 6.40805],
  [45.06057, 6.41159],
  [45.0615, 6.40589],
  [45.06226, 6.41159],
  [45.06399, 6.40799],
];

/** A profile for a stored geometry: a straight ramp over its own distances. */
const ramp = (
  geom: RouteGeometry,
  from: number,
  to: number,
): ElevationProfile => {
  const dist = profileDistances(geom);
  const ele = dist.map((_, i) =>
    Math.round(from + ((to - from) * i) / (dist.length - 1)),
  );
  return {
    ...profileStats(dist, ele),
    dist,
    ele,
    elevationGain: to - from,
    start: ele[0]!,
    top: ele.at(-1)!,
  };
};

/** No data in any half-month: enough to keep the climate pipeline out of the run. */
const NO_CLIMATE: ClimateYear = Array.from({ length: 24 }, () => null);

const galibier: Pass = {
  ascents: [
    { from: { lat: 45.165, lon: 6.43 }, label: "Valloire" },
    { from: { lat: 45.034, lon: 6.405 }, label: "Lautaret" },
  ],
  beauty: 5,
  classicAscent: "Valloire",
  country: "FR",
  difficulty: 5,
  elevation: 2642,
  fame: 5,
  lat: 45.064,
  lon: 6.408,
  name: "Fixtur-Galibier",
  note: "",
  region: "Westalpen",
  season: null,
  slug: "fixtur-galibier",
  surface: "asphalt",
  traffic: 3,
  type: "pass",
};

const lautaret: Pass = {
  ascents: [
    { from: { lat: 45.06399, lon: 6.40799 }, label: "Galibier" },
    { from: { lat: 44.897, lon: 6.636 }, label: "Briançon" },
  ],
  beauty: 3,
  classicAscent: "Galibier",
  country: "FR",
  difficulty: 2,
  elevation: 2058,
  fame: 3,
  lat: 45.034,
  lon: 6.405,
  name: "Fixtur-Lautaret",
  note: "",
  region: "Westalpen",
  season: null,
  slug: "fixtur-lautaret",
  surface: "asphalt",
  traffic: 4,
  type: "pass",
};

const runde: Tour = {
  color: "#c2410c",
  description: "",
  elevationGain: 1700,
  /** What the subsampled loop measures, so the tour passes on its length. */
  km: 35,
  name: "Fixtur-Runde",
  note: "",
  passes: ["fixtur-galibier"],
  season: null,
  slug: "fixtur-runde",
  surface: "asphalt",
  waypoints: [
    { lat: 46.549, lon: 11.874 },
    { lat: 46.519, lon: 11.874 },
    { lat: 46.497, lon: 11.875 },
    { lat: 46.488, lon: 11.813 },
    { lat: 46.496, lon: 11.787 },
    { lat: 46.509, lon: 11.76 },
    { lat: 46.548, lon: 11.81 },
    { lat: 46.549, lon: 11.874 },
  ],
};

export const curated: Curated = {
  passes: [galibier, lautaret],
  tours: [runde],
};

/** The keys the three rides and the tour are stored under, named for their path. */
export const KEYS = {
  /** Valloire: routed, judged, profiled. */
  accepted: "fixtur-galibier:0",
  /** Lautaret: the stored route survives its failing candidate. */
  kept: "fixtur-galibier:1",
  /** The ride down to the Lautaret: nothing stored, nothing kept. */
  rejected: "fixtur-lautaret:0",
  /** Briançon: the road-cycling graph goes round, the everyday graph takes the road. */
  secondGraph: "fixtur-lautaret:1",
  tour: "tour:fixtur-runde",
} as const;

/**
 * `--upgrade-osrm` with a road-cycling key: the one run in which a stored
 * route and a fresh candidate for the same key exist at once.
 */
export const flags: Flags = {
  only: undefined,
  ors: true,
  retryRejected: false,
  upgradeOsrm: true,
};

/**
 * What an earlier run left: the Lautaret side routed by the car profile and
 * its profile paid for, climate series for both passes, and no summit heights
 * at all – so the run starts with the two cheap batches that decide which
 * ascents may be routed.
 */
export const seed = (): Stored => ({
  climates: { "fixtur-galibier": NO_CLIMATE, "fixtur-lautaret": NO_CLIMATE },
  meta: {
    [KEYS.kept]: {
      fetchedAt: "2026-01-02",
      inputs: ascentInputs(
        false,
        galibier,
        galibier.ascents[1]!,
        "cycling-road",
      ),
      source: "osrm",
    },
  },
  profiles: { [KEYS.kept]: ramp(LAUTARET_ROUTE, 2058, 2642) },
  rejected: {},
  routes: { [KEYS.kept]: LAUTARET_ROUTE },
  summits: {},
});
