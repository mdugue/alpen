import type { PageBundle } from "@/lib/page-data";
import { indexBySlug, PERIODS } from "@/lib/status";
import type { Grade, Year, YearCell, Years } from "@/lib/status";
import type { Pass, Period, Tour, Town } from "@/lib/types";

/**
 * The little world the unit tests are set in: a handful of passes on one line
 * of latitude, the towns between them and a tour along them.
 *
 * It lives here rather than in one of the test files because four of them need
 * the same shapes – the reach module, the panel model and the three kind
 * modules – and a fixture copied four times is four fixtures that drift.
 * Everything is placed by distance in km so a test can say what it means:
 * one degree of longitude at 46° N is about 77,3 km.
 */

const KM_PER_DEGREE = 77.3;

export const ORIGIN = { lat: 46, lon: 10 };

/** A pass `km` east of `ORIGIN`. */
export const makePass = (
  slug: string,
  km: number,
  extra: Partial<Pass> = {},
): Pass =>
  ({
    ascents: [{ from: ORIGIN, label: `${slug} Südrampe` }],
    beauty: 3,
    classicAscent: "von Süden",
    country: "IT",
    difficulty: 3,
    elevation: 2000,
    fame: 3,
    lat: 46,
    lon: 10 + km / KM_PER_DEGREE,
    name: slug,
    note: `Notiz zu ${slug}.`,
    region: "Zentralalpen",
    season: { closes: 10.5, opens: 6 },
    slug,
    traffic: 3,
    type: "pass",
    ...extra,
  }) as unknown as Pass;

/** A town `km` east of `ORIGIN`. */
export const makeTown = (
  slug: string,
  km: number,
  extra: Partial<Town> = {},
): Town =>
  ({
    country: "IT",
    lat: 46,
    lon: 10 + km / KM_PER_DEGREE,
    name: slug,
    slug,
    tags: [],
    why: `Warum ${slug}.`,
    ...extra,
  }) as unknown as Town;

export const makeTour = (
  slug: string,
  passes: string[],
  extra: Partial<Tour> = {},
): Tour => ({
  color: "#ff0000",
  description: `Beschreibung ${slug}.`,
  elevationGain: 2400,
  km: 90,
  name: slug,
  passes,
  season: "Juli bis September",
  slug,
  waypoints: [ORIGIN, { lat: 46.1, lon: 10.1 }],
  ...extra,
});

export const cellOf = (grade: Grade): YearCell => ({
  grade,
  reasons: [],
  snowy: false,
  status:
    grade === "closed" ? "closed" : grade === "limited" ? "risky" : "open",
});

/** A flat year at one grade – enough for everything that reads a strip. */
const yearOf = (grade: Grade): Year => ({
  best: null,
  cells: PERIODS.map(() => cellOf(grade)),
});

export const yearsOf = (
  passes: [string, Grade][],
  tours: [string, Grade][] = [],
): Years => ({
  passes: Object.fromEntries(passes.map(([slug, g]) => [slug, yearOf(g)])),
  tours: Object.fromEntries(tours.map(([slug, g]) => [slug, yearOf(g)])),
});

export const PERIOD: Period = PERIODS[12]!;

/** A page bundle with nothing fetched and nothing derived but the index. */
export const bundleOf = (
  passes: Pass[],
  tours: Tour[],
  towns: Town[],
  years: Years,
  extra: Partial<PageBundle> = {},
): PageBundle => ({
  assets: {
    passBounds: {},
    routesUrl: "/map/routes.00000000.geojson",
    tourBounds: {},
    toursUrl: "/map/tours.00000000.geojson",
  },
  climate: {},
  detail: {},
  nearbyTours: {},
  passIndex: indexBySlug(passes),
  passes,
  tours,
  townReach: {},
  towns,
  valleys: {},
  years,
  ...extra,
});
