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

export const Ascent = z.strictObject({
  /** Starting point of the classic cycling ascent. */
  from: LatLon,
  /** Display name, e.g. "Valloire (Nord)". */
  label: z.string().min(1),
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
} as const;
