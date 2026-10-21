import type { PageData } from "@/lib/page-data";
import { GRADE_ORDER, REASON_ORDER, statusOf } from "@/lib/status";
import type { Grade, StatusReason, Year, YearCell, Years } from "@/lib/status";
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
 * order a cell keeps them in. Each of those assumptions is checked where the
 * cell is packed, on the server, so a ladder or a grade that outgrows the
 * code fails the build rather than painting a pass with someone else's
 * colour.
 */
const CELL_SEPARATOR = " ";
const SNOWY = "*";
const RADIX = 36;

const reasonCode = (reason: StatusReason): string => {
  const i = REASON_ORDER.indexOf(reason);
  if (i === -1 || i >= RADIX)
    throw new Error(`Grund ${reason} hat keinen Code (REASON_ORDER)`);
  return i.toString(RADIX);
};

const gradeOfCode = (code: string): Grade => {
  const grades = GRADE_ORDER.filter((g) => code.startsWith(g[0]!));
  if (grades.length !== 1)
    throw new Error(`Zelle "${code}" nennt keine eindeutige Note`);
  return grades[0]!;
};

const packCell = (cell: YearCell): string => {
  if (cell.status !== statusOf(cell.grade))
    throw new Error(`Zelle mit ${cell.status} und Note ${cell.grade}`);
  const code =
    cell.grade[0]! +
    (cell.snowy ? SNOWY : "") +
    cell.reasons.map(reasonCode).join("");
  if (gradeOfCode(code) !== cell.grade)
    throw new Error(`Note ${cell.grade} nicht eindeutig kodiert`);
  return code;
};

const unpackCell = (code: string): YearCell => {
  const grade = gradeOfCode(code);
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
 * One climate bucket as a tuple, in the order of `BUCKET_FIELDS`. Only the
 * last field may be missing – the snow cover, which a series may not carry
 * yet – and a tuple leaves it off rather than holding a hole.
 */
type WireBucket = number[];
type WireClimateYear = (WireBucket | null)[];

/**
 * Each field's place in the tuple. A record rather than a list, so a field
 * added to the schema and not given a place is a type error, not a value lost
 * on the wire.
 */
const BUCKET_PLACE: Record<keyof ClimateBucket, number> = {
  coverPct: 5,
  frostPct: 0,
  snowPct: 1,
  tmax: 2,
  tmin: 3,
  wetPct: 4,
};
const BUCKET_FIELDS = (
  Object.keys(BUCKET_PLACE) as (keyof ClimateBucket)[]
).toSorted((a, b) => BUCKET_PLACE[a] - BUCKET_PLACE[b]);

const packBucket = (b: ClimateBucket | null): WireBucket | null => {
  if (!b) return null;
  const values = BUCKET_FIELDS.map((field) => b[field]);
  const last = values.at(-1) === undefined ? values.length - 1 : values.length;
  const tuple = values.slice(0, last);
  if (tuple.includes(undefined))
    throw new Error("Nur das letzte Feld eines Klima-Eimers darf fehlen");
  return tuple as number[];
};

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
