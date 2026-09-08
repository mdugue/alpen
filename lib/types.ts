/** Half-month point in time: 1 = early January, 1.5 = late January … 12.5 = late December. */
export type Period = number;

export type Status = "open" | "risky" | "closed";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Ascent {
  /** Starting point of the classic cycling ascent. */
  from: LatLon;
  /** Display name, e.g. "Valloire (Nord)". */
  label: string;
  /** Widens one route-gate limit for this ascent alone, see `RouteCheck`. */
  check?: RouteCheck;
}

/**
 * Per-entry exception to the route quality gate (`scripts/lib/validate.ts`),
 * for the ascents and tours that legitimately break a default limit – an ascent
 * that ends at a mountain restaurant below the summit marker, say. `note` is
 * mandatory: an exception nobody can explain is a bug that has been silenced.
 */
export interface RouteCheck {
  maxKm?: number;
  maxStartDist?: number;
  maxEndDist?: number;
  maxTopDelta?: number;
  minPeakAt?: number;
  maxGain?: number;
  maxKmDelta?: number;
  maxWaypointDist?: number;
  /** Why this entry legitimately breaks the default limit. */
  note: string;
}

export interface PassSeason {
  /** Typical opening as a Period. */
  opens: Period;
  /** Typical winter closure as a Period. */
  closes: Period;
  /** Managed toll road – it is cleared, no altitude penalty. */
  maintained?: boolean;
}

export interface Pass {
  slug: string;
  name: string;
  /** ISO-like code, possibly several: "IT", "CH/IT". */
  country: string;
  region: "Westalpen" | "Zentralalpen" | "Ostalpen" | "Dolomiten" | string;
  lat: number;
  lon: number;
  elevation: number;
  /** Editorial short description of the classic ascent. */
  classicAscent: string;
  /** Editorial 1–5 scales, see docs/scales.md. */
  beauty: number;
  fame: number;
  difficulty: number;
  traffic: number;
  /** null = cleared all year round. */
  season: PassSeason | null;
  note: string;
  ascents: Ascent[];
}

export interface Tour {
  slug: string;
  name: string;
  color: string;
  km: number;
  elevationGain: number;
  /** Pass slugs from which the status is derived. */
  passes: string[];
  season: string;
  description: string;
  waypoints: LatLon[];
  /** Widens one route-gate limit for this tour alone, see `RouteCheck`. */
  check?: RouteCheck;
}

export interface Town {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** Why the town is interesting for road cyclists. */
  why: string;
}

/** Output of scripts/build-data.ts. */
export type RouteGeometry = [lat: number, lon: number][];

/** Which router produced a route. Entries without meta count as `"osrm"`. */
export type RouteSource = "ors" | "osrm";

/** One entry of `routes-meta.json`: provenance only, the metrics are recomputed. */
export interface RouteMeta {
  source: RouteSource;
  /** ISO date of the run that stored the geometry. */
  fetchedAt: string;
}

/** What the gate measured for one ascent. `null` before a profile exists. */
export interface AscentMetrics {
  km: number;
  startDist: number;
  endDist: number;
  topDelta: number | null;
  peakAt: number | null;
  gain: number | null;
}

export interface TourMetrics {
  km: number;
  /** The curated `tour.km` this was measured against. */
  statedKm: number;
  /** Signed relative deviation from `statedKm`. */
  kmDelta: number;
  startDist: number;
  endDist: number;
}

export type RouteMetrics = AscentMetrics | TourMetrics;

/**
 * One entry of `rejected.json`. It keeps the measured values rather than the
 * geometry, because re-judging them against a changed limit is what tuning
 * needs and costs nothing; the geometry itself is free to fetch again. The
 * elevation profile *is* kept, because that one costs 100 Open-Meteo calls –
 * so changing a threshold and retrying spends no quota at all.
 */
export interface RouteRejection {
  /** Why it failed, as the sentences `data:check` prints. */
  reasons: string[];
  metrics: RouteMetrics;
  source: RouteSource;
  /** Identity of the rejected geometry; an unchanged hash on a retry means the
   *  router is not the problem, the coordinates are. */
  hash: string;
  /** ISO date this key was first rejected – its age is the signal that a human
   *  has to fix a coordinate rather than wait for a better route. */
  firstSeen: string;
  lastSeen: string;
  /** Cached so a retry after a threshold change costs no Open-Meteo calls. */
  profile?: ElevationProfile;
}

export interface ElevationProfile {
  km: number;
  elevationGain: number;
  start: number;
  top: number;
  avgGradient: number;
  /** Cumulative distance per sample point in km. */
  dist: number[];
  /** Elevation per sample point in m. */
  ele: number[];
}

export interface ClimateBucket {
  /** Mean daily maximum in °C. */
  tmax: number;
  /** Mean daily minimum in °C. */
  tmin: number;
  /** Share of days with snowfall ≥ 1 cm, in percent. */
  snowPct: number;
  /** Share of days with frost (Tmin < 0 °C), in percent. */
  frostPct: number;
  /** Share of days with precipitation ≥ 1 mm, in percent. */
  wetPct: number;
}

/** 24 half-months, index 0 = early January. null = no data. */
export type ClimateYear = (ClimateBucket | null)[];

export interface WeatherDay {
  date: string;
  tmin: number;
  tmax: number;
  precipitation: number;
  snowfall: number;
  windMax: number;
  weatherCode: number;
}
