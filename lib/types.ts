/** Halbmonats-Zeitpunkt: 1 = Anfang Januar, 1.5 = Ende Januar … 12.5 = Ende Dezember. */
export type Period = number;

export type Status = "open" | "risky" | "closed";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Ascent {
  /** Startort der klassischen Rad-Auffahrt. */
  from: LatLon;
  /** Anzeigename, z. B. "Valloire (Nord)". */
  label: string;
}

export interface PassSeason {
  /** Typische Öffnung als Period. */
  opens: Period;
  /** Typische Wintersperre als Period. */
  closes: Period;
  /** Bewirtschaftete Mautstraße – wird geräumt, kein Höhenabschlag. */
  maintained?: boolean;
}

export interface Pass {
  slug: string;
  name: string;
  /** ISO-artiges Kürzel, ggf. mehrere: "IT", "CH/IT". */
  country: string;
  region: "Westalpen" | "Zentralalpen" | "Ostalpen" | "Dolomiten" | string;
  lat: number;
  lon: number;
  elevation: number;
  /** Redaktionelle Kurzbeschreibung der klassischen Auffahrt. */
  classicAscent: string;
  /** Redaktionelle 1–5-Skalen, siehe docs/scales.md. */
  beauty: number;
  fame: number;
  difficulty: number;
  traffic: number;
  /** null = ganzjährig geräumt. */
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
  /** Pass-Slugs, aus denen sich der Status ableitet. */
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
  /** Warum der Ort für Rennradfahrer interessant ist. */
  why: string;
}

/** Ergebnis von scripts/build-data.ts. */
export type RouteGeometry = [lat: number, lon: number][];

export interface ElevationProfile {
  km: number;
  elevationGain: number;
  start: number;
  top: number;
  avgGradient: number;
  /** Kumulierte Distanz je Stützpunkt in km. */
  dist: number[];
  /** Höhe je Stützpunkt in m. */
  ele: number[];
}

export interface ClimateBucket {
  /** Ø Tageshöchstwert in °C. */
  tmax: number;
  /** Ø Tagestiefstwert in °C. */
  tmin: number;
  /** Anteil der Tage mit Schneefall ≥ 1 cm, in Prozent. */
  snowPct: number;
  /** Anteil der Tage mit Frost (Tmin < 0 °C), in Prozent. */
  frostPct: number;
  /** Anteil der Tage mit Niederschlag ≥ 1 mm, in Prozent. */
  wetPct: number;
}

/** 24 Halbmonate, Index 0 = Anfang Januar. null = keine Daten. */
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
