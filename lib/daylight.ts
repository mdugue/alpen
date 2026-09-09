import type { Period } from "@/lib/types";

/**
 * Sunrise, sunset and day length from latitude, longitude and date – the
 * NOAA sunrise equation, accurate to a minute or two, which is all a
 * half-month resolution can use. Pure astronomy: no data file, no API.
 *
 * The status heuristic reads `dayLength` ("kurze Tage"), the panel shows the
 * clock times. Times are UTC `Date`s; `clockTime` formats them in
 * Europe/Berlin, the one time zone the app reckons in (docs/data-model.md).
 */

const RAD = Math.PI / 180;
/** Zenith at sunrise and sunset, refraction and the solar disc included. */
const ZENITH = 90.833;

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  /** In hours. */
  dayLength: number;
}

const dayOfYear = (d: Date): number =>
  Math.floor(
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
      Date.UTC(d.getUTCFullYear(), 0, 0)) /
      86_400_000,
  );

const daysInYear = (d: Date): number =>
  (Date.UTC(d.getUTCFullYear() + 1, 0, 1) -
    Date.UTC(d.getUTCFullYear(), 0, 1)) /
  86_400_000;

/** Solar declination (rad) and the equation of time (minutes) for a date. */
const solar = (d: Date) => {
  const g =
    ((2 * Math.PI) / daysInYear(d)) *
    (dayOfYear(d) - 1 + (d.getUTCHours() - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const declination =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  return { declination, eqTime };
};

/** Half the arc the sun is above the horizon, in degrees; 0 or 180 beyond the polar circles. */
const hourAngle = (lat: number, declination: number): number => {
  const cosH =
    Math.cos(ZENITH * RAD) / (Math.cos(lat * RAD) * Math.cos(declination)) -
    Math.tan(lat * RAD) * Math.tan(declination);
  return Math.acos(Math.min(1, Math.max(-1, cosH))) / RAD;
};

/** Sunrise and sunset (UTC) and the day length for the calendar day of `date` (UTC). */
export const sunTimes = (lat: number, lon: number, date: Date): SunTimes => {
  const noon = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
  );
  const { declination, eqTime } = solar(noon);
  const ha = hourAngle(lat, declination);
  const midnight = noon.getTime() - 12 * 3_600_000;
  const minutes = (sign: 1 | -1) => 720 - 4 * (lon + sign * ha) - eqTime;
  return {
    dayLength: (8 * ha) / 60,
    sunrise: new Date(midnight + minutes(1) * 60_000),
    sunset: new Date(midnight + minutes(-1) * 60_000),
  };
};

/**
 * The day that stands for a half-month: the 8th for "Anfang", the 23rd for
 * "Ende" – the middle of each. The year matters only for leap days and the
 * clock times around the DST switch; the current one is the honest default.
 */
export const periodDate = (
  t: Period,
  year = new Date().getUTCFullYear(),
): Date => new Date(Date.UTC(year, Math.floor(t) - 1, t % 1 ? 23 : 8, 12));

/** Hours of daylight at a latitude in the middle of a half-month. */
export const dayLength = (lat: number, t: Period): number =>
  sunTimes(lat, 0, periodDate(t)).dayLength;

/** "17:10" in Europe/Berlin – the clock the app reckons in. */
export const clockTime = (d: Date, timeZone = "Europe/Berlin"): string =>
  new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(d);
