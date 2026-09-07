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
