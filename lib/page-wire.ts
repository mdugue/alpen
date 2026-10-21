import type { PageData } from "@/lib/page-data";
import { GRADE_ORDER, REASON_ORDER, statusOf } from "@/lib/status";
import type { Year, YearCell, Years } from "@/lib/status";
import type { ClimateBucket } from "@/lib/types";

/**
 * The page data as it travels: the same value as `PageData`, with its two
 * largest parts packed.
 *
 * Every prerendered route carries the explorer's payload – the layout's RSC
 * segment, the route's full payload and the postponed state of its weather
 * hole each hold a copy – so its size is paid once per page and language, and
 * the page count grows with the data. At 1,800 pages the build wrote 4 MB per
 * page and ran out of memory on Vercel. Half of the payload was the graded
 * year: 24 objects per pass, each spelling out `"grade"`, `"status"`,
 * `"reasons"` and `"snowy"`, and the climate series spelling out six field
 * names in each of its 24 buckets.
 *
 * Packed, a cell is a string of a few characters and a bucket one tuple. The server packs
 * (`getPageData`, lib/data.ts), the explorer unpacks once
 * (`components/explorer.tsx`), and every reader past it sees the `PageData`
 * it always did. `lib/page-wire.test.ts` holds the round trip against the
 * real data.
 */
export interface PageWire extends Omit<PageData, "climate" | "years"> {
  climate: Record<string, WireClimateYear>;
  years: { passes: Record<string, WireYear>; tours: Record<string, WireYear> };
}

/**
 * One year: its 24 cells as one string, a short code per half-month
 * (`packCell`) separated by spaces, and the best window. A tour's cells name
 * the members that hold them back; those lists travel beside the string, keyed by the half-month's index – an empty list stays
 * an empty list, because `tourText` reads it differently from a missing one.
 */
interface WireYear {
  cells: string;
  best: Year["best"];
  limiting?: Record<number, string[]>;
}

/*
 * A cell's string: the grade's initial, a `*` for a snowy half-month, and one
 * character per reason – its place in `REASON_ORDER` in base 36 – so a cell
 * reads `b`, `g*` or `c*01`. The status is not stored: it follows from the
 * grade (`statusOf`), and the reasons come back in ladder order, which is the
 * order a cell keeps them in.
 */
const CELL_SEPARATOR = " ";
const SNOWY = "*";
const RADIX = 36;

const packCell = (cell: YearCell): string =>
  cell.grade[0]! +
  (cell.snowy ? SNOWY : "") +
  cell.reasons.map((r) => REASON_ORDER.indexOf(r).toString(RADIX)).join("");

const unpackCell = (code: string): YearCell => {
  const grade = GRADE_ORDER.find((g) => code.startsWith(g[0]!))!;
  const snowy = code[1] === SNOWY;
  return {
    grade,
    reasons: Array.from(
      code.slice(snowy ? 2 : 1),
      (c) => REASON_ORDER[Number.parseInt(c, RADIX)]!,
    ),
    snowy,
    status: statusOf(grade),
  };
};

const packYear = ({ best, cells }: Year): WireYear => {
  const limiting: Record<number, string[]> = {};
  for (const [i, cell] of cells.entries())
    if (cell.limiting) limiting[i] = cell.limiting;
  return {
    best,
    cells: cells.map(packCell).join(CELL_SEPARATOR),
    ...(Object.keys(limiting).length > 0 && { limiting }),
  };
};

const unpackYear = ({ best, cells, limiting }: WireYear): Year => ({
  best,
  cells: cells.split(CELL_SEPARATOR).map((code, i) => {
    const cell = unpackCell(code);
    const names = limiting?.[i];
    return names ? { ...cell, limiting: names } : cell;
  }),
});

/**
 * One climate bucket as a tuple, in the order of `BUCKET_FIELDS`; the snow
 * cover, which a series may not carry yet, comes last and is left off when
 * it is missing.
 */
type WireBucket =
  | [number, number, number, number, number]
  | [number, number, number, number, number, number];
type WireClimateYear = (WireBucket | null)[];

const BUCKET_FIELDS = [
  "frostPct",
  "snowPct",
  "tmax",
  "tmin",
  "wetPct",
  "coverPct",
] as const satisfies (keyof ClimateBucket)[];

const packBucket = (b: ClimateBucket | null): WireBucket | null =>
  b &&
  (b.coverPct === undefined
    ? [b.frostPct, b.snowPct, b.tmax, b.tmin, b.wetPct]
    : [b.frostPct, b.snowPct, b.tmax, b.tmin, b.wetPct, b.coverPct]);

const unpackBucket = (t: WireBucket | null): ClimateBucket | null =>
  t &&
  (Object.fromEntries(
    t.map((value, i) => [BUCKET_FIELDS[i], value]),
  ) as ClimateBucket);

const mapValues = <A, B>(
  record: Record<string, A>,
  f: (value: A) => B,
): Record<string, B> =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [k, f(v)]));

/** What the server hands the client: `PageData` with the year and the climate packed. */
export const packPage = ({ climate, years, ...rest }: PageData): PageWire => ({
  ...rest,
  climate: mapValues(climate, (year) => year.map(packBucket)),
  years: {
    passes: mapValues(years.passes, packYear),
    tours: mapValues(years.tours, packYear),
  },
});

/** The `PageData` the explorer reads, from what the page carried. */
export const unpackPage = ({
  climate,
  years,
  ...rest
}: PageWire): PageData => ({
  ...rest,
  climate: mapValues(climate, (year) => year.map(unpackBucket)),
  years: {
    passes: mapValues(years.passes, unpackYear),
    tours: mapValues(years.tours, unpackYear),
  } satisfies Years,
});
