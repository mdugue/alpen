import { z } from "zod";

import { COUNTRIES, REGIONS } from "@/lib/regions";

/**
 * Single source of truth for the shape of everything in `data/`. The types in
 * `lib/types.ts` are inferred from these schemas, `scripts/check-data.ts` and
 * `lib/data.ts` parse the files with them, `scripts/build-data.ts` validates
 * fetched results before writing, and `scripts/emit-json-schema.ts` turns
 * them into `data/schema/*.schema.json` for editor completion.
 *
 * Only server and script code may import this module: zod must not reach the
 * client bundle. Components import the types from `lib/types.ts` instead.
 */

export const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Slug: nur a-z, 0-9 und Bindestriche");

/** Half-month point in time: 1 = early January, 1.5 = late January … 12.5 = late December. */
export const Period = z
  .number()
  .refine(
    (t) => Number.isInteger(t * 2) && t >= 1 && t <= 12.5,
    "Halbmonat: 1, 1.5, … 12.5",
  );

export const Status = z.enum(["open", "risky", "closed"]);

export const Rating = z.int().min(1).max(5);

export const LatLon = z.strictObject({
  lat: z.number().min(43).max(49),
  lon: z.number().min(4).max(16),
});

/**
 * Per-entry exception to the route quality gate (`scripts/lib/validate.ts`),
 * for the ascents and tours that legitimately break a default limit – an ascent
 * that ends at a mountain restaurant below the summit marker, say. Ascents and
 * tours have different limits, so each kind lists only the limits its validator
 * reads; a limit that would be silently ignored cannot be written down. `note`
 * is mandatory and at least one limit has to be named: an exception nobody can
 * explain, or one that widens nothing, is a bug that has been silenced.
 */
const atLeastOneLimit = (o: Record<string, unknown>) =>
  Object.keys(o).some((k) => k !== "note");

export const AscentCheck = z
  .strictObject({
    maxKm: z.number().positive().optional(),
    maxStartDist: z.number().positive().optional(),
    maxEndDist: z.number().positive().optional(),
    maxTopDelta: z.number().positive().optional(),
    minPeakAt: z.number().min(0).max(1).optional(),
    maxGain: z.number().positive().optional(),
    /** Why this ascent legitimately breaks the default limit. */
    note: z.string().min(1, "check ohne Begründung (note)"),
  })
  .refine(atLeastOneLimit, "check nennt keine Grenze");

export const TourCheck = z
  .strictObject({
    maxKmDelta: z.number().positive().optional(),
    maxWaypointDist: z.number().positive().optional(),
    /** Why this tour legitimately breaks the default limit. */
    note: z.string().min(1, "check ohne Begründung (note)"),
  })
  .refine(atLeastOneLimit, "check nennt keine Grenze");

export const Ascent = z.strictObject({
  /** Starting point of the classic cycling ascent. */
  from: LatLon,
  /** Display name, e.g. "Valloire (Nord)". */
  label: z.string().min(1),
  /** Widens a route-gate limit for this ascent alone, see `AscentCheck`. */
  check: AscentCheck.optional(),
});

export const PassSeason = z
  .object({
    /** Typical opening as a Period. */
    opens: Period,
    /** Typical winter closure as a Period. */
    closes: Period,
    /** Managed toll road – it is cleared, no altitude penalty. */
    maintained: z.boolean().optional(),
  })
  .refine((s) => s.opens < s.closes, "Saisonfenster verdreht");

export const Region = z.enum(REGIONS);
export const Country = z.enum(COUNTRIES);

export const Pass = z.strictObject({
  slug: Slug,
  name: z.string().min(2),
  /** Other spellings people search for: "Stilfser Joch", "Grossglockner". */
  aliases: z.array(z.string().min(2)).optional(),
  /** ISO-like code, possibly several: "IT", "CH/IT". */
  country: z
    .string()
    .regex(/^[A-Z]{2}(?:\/[A-Z]{2})?$/u, 'Land: "IT" oder "CH/IT"')
    .refine(
      (c) => c.split("/").every((x) => COUNTRIES.includes(x as never)),
      `Land: eines von ${COUNTRIES.join(", ")}`,
    ),
  region: Region,
  lat: LatLon.shape.lat,
  lon: LatLon.shape.lon,
  elevation: z.int().min(300).max(3500),
  /** Editorial short description of the classic ascent. */
  classicAscent: z.string(),
  /** Editorial 1–5 scales, see docs/scales.md. */
  beauty: Rating,
  fame: Rating,
  difficulty: Rating,
  traffic: Rating,
  /** null = cleared all year round. */
  season: PassSeason.nullable(),
  note: z.string(),
  ascents: z.array(Ascent),
});

export const Tour = z.strictObject({
  slug: Slug,
  name: z.string().min(2),
  color: z.string().regex(/^#[0-9a-f]{6}$/u, "Farbe: #rrggbb"),
  km: z.number().positive(),
  elevationGain: z.number().nonnegative(),
  /** Pass slugs from which the status is derived. */
  passes: z.array(Slug).min(1),
  season: z.string(),
  description: z.string(),
  waypoints: z.array(LatLon).min(2),
  /** Widens a route-gate limit for this tour alone, see `TourCheck`. */
  check: TourCheck.optional(),
});

export const Town = z.strictObject({
  slug: Slug,
  name: z.string().min(2),
  country: Country,
  lat: LatLon.shape.lat,
  lon: LatLon.shape.lon,
  /** Why the town is interesting for road cyclists. */
  why: z.string(),
});

export const Passes = z.array(Pass);
export const Tours = z.array(Tour);
export const Towns = z.array(Town);

// ── Output of scripts/build-data.ts ──────────────────────────────────────────

/** Road geometry as [lat, lon] pairs. */
export const RouteGeometry = z.array(z.tuple([z.number(), z.number()])).min(2);

export const ElevationProfile = z
  .object({
    km: z.number().nonnegative(),
    elevationGain: z.number().nonnegative(),
    start: z.number(),
    top: z.number(),
    avgGradient: z.number(),
    /** Steepest full kilometre in percent (see `steepestKm` in lib/profile.ts). */
    maxKmGradient: z.number(),
    /** Cumulative distance per sample point in km. */
    dist: z.array(z.number()),
    /** Elevation per sample point in m. */
    ele: z.array(z.number()),
  })
  .refine((p) => p.dist.length === p.ele.length, "dist und ele ungleich lang");

export const ClimateBucket = z.strictObject({
  /** Mean daily maximum in °C. */
  tmax: z.number(),
  /** Mean daily minimum in °C. */
  tmin: z.number(),
  /** Share of days with snowfall ≥ 1 cm, in percent. */
  snowPct: z.number().min(0).max(100),
  /** Share of days with frost (Tmin < 0 °C), in percent. */
  frostPct: z.number().min(0).max(100),
  /** Share of days with precipitation ≥ 1 mm, in percent. */
  wetPct: z.number().min(0).max(100),
});

/** 24 half-months, index 0 = early January. null = no data. */
export const ClimateYear = z.array(ClimateBucket.nullable()).length(24);

/** Key: `${passSlug}:${index}` or `tour:${tourSlug}`. */
export const Routes = z.record(z.string(), RouteGeometry);
/** Key: `${passSlug}:${index}`. */
export const Profiles = z.record(z.string(), ElevationProfile);
/** Key: pass slug. */
export const Climate = z.record(Slug, ClimateYear);

// ── The route quality gate (scripts/lib/validate.ts) ─────────────────────────

/** Which router produced a route. Entries without meta count as `"osrm"`. */
export const RouteSource = z.enum(["ors", "osrm"]);

/** One entry of `routes-meta.json`: provenance only, the metrics are recomputed. */
export const RouteMeta = z.strictObject({
  source: RouteSource,
  /** ISO date of the run that stored the geometry. */
  fetchedAt: z.iso.date(),
});

/** What the gate measured for one ascent. `null` before a profile exists. */
export const AscentMetrics = z.strictObject({
  km: z.number().nonnegative(),
  startDist: z.number().nonnegative(),
  endDist: z.number().nonnegative(),
  topDelta: z.number().nullable(),
  peakAt: z.number().nullable(),
  gain: z.number().nullable(),
});

export const TourMetrics = z.strictObject({
  km: z.number().nonnegative(),
  /** The curated `tour.km` this was measured against. */
  statedKm: z.number().positive(),
  /** Signed relative deviation from `statedKm`. */
  kmDelta: z.number(),
  startDist: z.number().nonnegative(),
  endDist: z.number().nonnegative(),
});

export const RouteMetrics = z.union([AscentMetrics, TourMetrics]);

/**
 * One entry of `rejected.json`. It keeps the measured values rather than the
 * geometry, because re-judging them against a changed limit is what tuning
 * needs and costs nothing; the geometry itself is free to fetch again. The
 * elevation profile *is* kept, because that one costs 100 Open-Meteo calls –
 * so changing a threshold and retrying spends no quota at all.
 */
export const RouteRejection = z.strictObject({
  /** Why it failed, as the sentences `data:check` prints. */
  reasons: z.array(z.string().min(1)).min(1),
  metrics: RouteMetrics,
  source: RouteSource,
  /** Identity of the rejected geometry; an unchanged hash on a retry means the
   *  router is not the problem, the coordinates are. */
  hash: z.string().min(1),
  /** ISO date this key was first rejected – its age is the signal that a human
   *  has to fix a coordinate rather than wait for a better route. */
  firstSeen: z.iso.date(),
  lastSeen: z.iso.date(),
  /** Cached so a retry after a threshold change costs no Open-Meteo calls. */
  profile: ElevationProfile.optional(),
});

/** Key: as `routes.json`. */
export const RoutesMeta = z.record(z.string(), RouteMeta);
/** Key: as `routes.json`. */
export const Rejected = z.record(z.string(), RouteRejection);
/** Key: pass slug → DEM height at the pass coordinate in m. */
export const Summits = z.record(Slug, z.number());

/** One day of the Open-Meteo forecast served by `app/api/weather/[slug]`. */
export const WeatherDay = z.strictObject({
  date: z.string(),
  tmin: z.number(),
  tmax: z.number(),
  precipitation: z.number(),
  snowfall: z.number(),
  windMax: z.number(),
  weatherCode: z.number(),
});

/** Which schema validates which file; used by check-data and emit-json-schema. */
export const FILES = {
  "passes.json": Passes,
  "tours.json": Tours,
  "towns.json": Towns,
  "generated/routes.json": Routes,
  "generated/profiles.json": Profiles,
  "generated/climate.json": Climate,
  "generated/routes-meta.json": RoutesMeta,
  "generated/rejected.json": Rejected,
  "generated/summits.json": Summits,
} as const;
