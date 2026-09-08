import type { z } from "zod";

import type * as S from "@/lib/schema";

/**
 * All data types are inferred from the zod schemas in `lib/schema.ts`; this
 * module only re-exports them under their established names so that
 * components can import types without pulling zod into the client bundle.
 */

/** Half-month point in time: 1 = early January, 1.5 = late January … 12.5 = late December. */
export type Period = z.infer<typeof S.Period>;

export type Status = z.infer<typeof S.Status>;
export type LatLon = z.infer<typeof S.LatLon>;
export type AscentCheck = z.infer<typeof S.AscentCheck>;
export type TourCheck = z.infer<typeof S.TourCheck>;
export type Ascent = z.infer<typeof S.Ascent>;
export type PassSeason = z.infer<typeof S.PassSeason>;
export type Region = z.infer<typeof S.Region>;
export type Country = z.infer<typeof S.Country>;
export type Pass = z.infer<typeof S.Pass>;
export type Tour = z.infer<typeof S.Tour>;
export type Town = z.infer<typeof S.Town>;

/** Output of scripts/build-data.ts. */
export type RouteGeometry = z.infer<typeof S.RouteGeometry>;
export type ElevationProfile = z.infer<typeof S.ElevationProfile>;
export type ClimateBucket = z.infer<typeof S.ClimateBucket>;
/** 24 half-months, index 0 = early January. null = no data. */
export type ClimateYear = z.infer<typeof S.ClimateYear>;
export type WeatherDay = z.infer<typeof S.WeatherDay>;

/** The route quality gate, see scripts/lib/validate.ts. */
export type RouteSource = z.infer<typeof S.RouteSource>;
export type RouteMeta = z.infer<typeof S.RouteMeta>;
export type AscentMetrics = z.infer<typeof S.AscentMetrics>;
export type TourMetrics = z.infer<typeof S.TourMetrics>;
export type RouteMetrics = z.infer<typeof S.RouteMetrics>;
export type RouteRejection = z.infer<typeof S.RouteRejection>;
