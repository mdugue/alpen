import { createHash } from "node:crypto";
import { mkdir, readdir, rm } from "node:fs/promises";

/**
 * The files `public/` is filled with before every `dev` and `build`, and the
 * one rule they all follow: the name carries a hash of the content, so the
 * file is immutable and may be cached for a year.
 *
 * That rule used to be spelled six times – the sha256-and-eight-hex in
 * `lib/map-assets.ts` and `lib/detail-assets.ts`, a prune pattern beside each,
 * and the two cache-header patterns in `next.config.ts` – and the three
 * spellings have to describe the same set of names or the header promises
 * immutability to something the next run may replace under the same name.
 * Here they are one value: `name` writes it, `prune` recognises it and
 * `cachePattern` is what `next.config.ts` caches, all built from the same
 * `stem` and extension.
 *
 * Never imported by client code – it needs `node:crypto` and `node:fs`.
 * Relative imports only, like its two callers: `next.config.ts` loads them
 * outside the bundler, where the "@/" alias is not resolved.
 */

/** One file a build script hands over, ready to be written. */
export interface DerivedFile {
  /** `routes.a1b2c3d4.geojson`, from `name` – or a fixed name, for a style. */
  name: string;
  body: string;
}

/** What differs between two directories of derived files. */
export interface DerivedSpec {
  /** Under `public/`, and thus the URL prefix. */
  dir: string;
  /** Without the dot. */
  ext: string;
  /** What the cache rule binds the varying part of the name to. */
  param: string;
  /**
   * The part before the hash, as a regular expression source – read both by
   * the prune pattern and by the cache rule, which is what keeps the two from
   * describing different sets of names.
   */
  stem: string;
}

/**
 * The body of a derived file, with every object's keys in one fixed order.
 *
 * The name is a hash of the body, and both sides of that promise build the
 * body themselves: the script writes the file, `lib/data.ts` derives the name
 * it expects. A plain `JSON.stringify` makes the hash depend on the order the
 * keys happen to be in, which is a property of *who built the object*, not of
 * what it says – so the same data reached by two paths hashed differently and
 * the page asked for a file the script had never written. It was the reader
 * that changed (`scripts/lib/data-files.ts` hands back what the file says,
 * where a `zod` parse hands back a copy in the schema's key order), but the
 * fragility was here, and an invariant that only holds while every caller
 * takes the same route is not one.
 *
 * Sorting is done in a replacer rather than over a deep copy: `JSON.stringify`
 * walks whatever the replacer returns, so one pass sorts every level and the
 * arrays – the coordinate lists, which are most of the bytes – are handed
 * straight through.
 */
export const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).toSorted(([a], [b]) =>
            a < b ? -1 : 1,
          ),
        )
      : v,
  );

/**
 * Eight hex digits. Enough that two versions of one file never collide in
 * practice, short enough that a name stays readable in a build log.
 */
const HASH_DIGITS = 8;
const HASH = `[0-9a-f]{${HASH_DIGITS}}`;

/** One directory of content-hashed files, as the three sides that must agree. */
export interface DerivedDir {
  /** The path rule `next.config.ts` gives a year of immutability to. */
  cachePattern: string;
  dir: string;
  /** `<stem>.<hash of body>.<ext>`. */
  name: (stem: string, body: string) => string;
  /** The names of this shape – what a build script writes and prunes. */
  prune: RegExp;
  /** Where the browser asks for it. */
  url: (name: string) => string;
}

export const derivedDir = ({
  dir,
  ext,
  param,
  stem,
}: DerivedSpec): DerivedDir => ({
  cachePattern: `/${dir}/:${param}(${stem}).:hash(${HASH}).${ext}`,
  dir,
  name: (part, body) =>
    `${part}.${createHash("sha256").update(body).digest("hex").slice(0, HASH_DIGITS)}.${ext}`,
  prune: new RegExp(`^(?:${stem})\\.${HASH}\\.${ext}$`, "u"),
  url: (name) => `/${dir}/${name}`,
});

/**
 * Makes the directory, writes the files and – for a caller that produces the
 * whole set of one shape – removes what an earlier run left of it, so a stale
 * hash cannot linger next to the current one. Anything the pattern does not
 * match is left alone: `public/map` also holds the two basemap styles and the
 * committed glyphs, and neither is written by the script that prunes.
 */
export const writeDerived = async ({
  files,
  out,
  prune,
}: {
  files: readonly DerivedFile[];
  out: URL;
  /** Absent for a caller that writes only part of what lives in `out`. */
  prune?: RegExp;
}): Promise<void> => {
  await mkdir(out, { recursive: true });
  if (prune) {
    const keep = new Set(files.map((f) => f.name));
    const there = await readdir(out);
    await Promise.all(
      there
        .filter((name) => prune.test(name) && !keep.has(name))
        .map((name) => rm(new URL(name, out))),
    );
  }
  await Promise.all(files.map((f) => Bun.write(new URL(f.name, out), f.body)));
};
