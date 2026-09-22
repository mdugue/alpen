#!/usr/bin/env bun
/**
 * Precomputation of the detail-panel photos.
 *
 *   bun run data:photos                    # fill the gaps
 *   bun run data:photos --refresh          # ask Commons again for everything
 *   bun run data:photos --only stelvio     # restrict to matching slugs
 *   bun run data:photos --blur             # only the placeholders, again
 *
 * Writes `data/generated/photos.json`: per pass, town and tour a handful of
 * Wikimedia Commons photos with the author, licence and file page their
 * licences oblige us to print (`lib/photos.ts`). Nothing is fetched at runtime
 * and no binary enters the repo – only the thumbnail URLs on Wikimedia's CDN,
 * plus the one thing that has to be there before the CDN answers: a 20-px-wide
 * rendering of each photo, inlined as a data URI so the panel opens on the
 * photo's colours rather than on an empty box. Half a kilobyte each, and it is
 * a binary only in the sense that base64 is – the alternative, a placeholder
 * fetched at runtime, would lose the race it exists to win.
 *
 * There is no editorial step. Commons is asked for what stands within a few
 * hundred metres of the pass point, the obvious non-photographs are filtered
 * out by name and format, and what is left is ranked by how well the file name
 * matches the entity and how close it was found. A picture of the pass under a
 * metre of snow is a fair answer to "what does it look like up there" and stays
 * in; the rank only has to keep the road signs and the maps out.
 *
 * Incremental by default: an entity that already has photos is skipped, so a
 * rerun after adding one pass costs one request. `--refresh` overrides that.
 *
 * Rate limit. The Commons API and its file CDN are two hosts of the transport
 * (`scripts/lib/transport.ts`): serial, paced, and backing off when one of
 * them answers 429 anyway. If the API keeps saying 429 the run stops and
 * reports how many entities are left rather than hammering – what it had is
 * already on disk, and the next run picks up there. Every entity is written as
 * it arrives for the same reason: an interrupted run must not throw away an
 * hour of requests.
 */
import { BLUR_WIDTH, PHOTO_LIMIT, thumbUrl } from "../lib/photos";
import { entityKey } from "../lib/route-key";
import type { DataFileName } from "../lib/schema";
import type { Photo } from "../lib/types";
import { blurUri, blurWidth } from "./lib/blur";
import { readData, writeData } from "./lib/data-files";
import type { Data } from "./lib/data-files";
import { commons } from "./lib/hosts";
import { best, NEAR_BONUS, rank } from "./lib/photo-rank";
import {
  liveTransport,
  QuotaExhaustedError,
  RateLimitedError,
} from "./lib/transport";

const read = async <K extends DataFileName>(file: K): Promise<Data<K>> => {
  const { data, problems } = await readData(file);
  if (!data)
    throw new Error(`${file} ist unbrauchbar:\n  ${problems.join("\n  ")}`);
  return data;
};
const passes = await read("passes.json");
const tours = await read("tours.json");
const towns = await read("towns.json");

const REFRESH = process.argv.includes("--refresh");
/** Fetch every placeholder again, without asking Commons for the photos. */
const REBLUR = process.argv.includes("--blur");
const ONLY = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : undefined;
/** How far around a pass point or town centre Commons is asked to look. */
const RADIUS_M = { pass: 2000, town: 2500 };
const transport = liveTransport();

// ── Commons API ──────────────────────────────────────────────────────────────

/** Everything Commons has within `radius` of the point, best first. */
const nearby = async (
  at: { lat: number; lon: number },
  radius: number,
  name: string,
) => rank(await commons.geosearch(transport, at, radius), name);

/** The same by name, for the places whose photos carry no coordinate. */
const byName = async (name: string) =>
  rank(await commons.search(transport, name), name).map((r) => ({
    ...r,
    score: r.score - NEAR_BONUS,
  }));

const forPlace = async (
  at: { lat: number; lon: number },
  radius: number,
  name: string,
) => {
  const found = await nearby(at, radius, name);
  // A geosearch that comes back nearly empty means the photos of this place
  // were never given a coordinate, not that there are none.
  if (found.length < PHOTO_LIMIT) found.push(...(await byName(name)));
  return best(found, PHOTO_LIMIT);
};

// ── Placeholders ─────────────────────────────────────────────────────────────

/**
 * The smallest standard width of the same file, as a data URI. Keyed by `src`
 * because a tour borrows its passes' photo objects and a pass can share a file
 * with its neighbour: one file is fetched once per run.
 */
const blurCache = new Map<string, string | null>();

const blurFor = async (src: string): Promise<string | undefined> => {
  const cached = blurCache.get(src);
  if (cached !== undefined) return cached ?? undefined;

  const url = thumbUrl(src, BLUR_WIDTH);
  // Not a thumbnail URL we may rewrite – the panel falls back to its own
  // surface, which is what it did before there were placeholders at all.
  if (!url) {
    blurCache.set(src, null);
    return undefined;
  }

  let blur: string | null = null;
  try {
    const { bytes, type } = await commons.thumbnail(transport, url);
    blur = await blurUri(bytes, type);
    if (!blur) console.warn(`  ohne Vorschau: ${url} (${type}, zu groß)`);
  } catch (error) {
    // A missing placeholder is a cosmetic loss, never a reason to drop a photo
    // or to end a run that has already spent its API budget.
    console.warn(`  ohne Vorschau: ${url} (${(error as Error).message})`);
  }
  blurCache.set(src, blur);
  return blur ?? undefined;
};

/**
 * The placeholder of one photo, from whatever is cheapest. A placeholder that
 * is already WebP is done. One in another format was written before the
 * re-encoding step existed and holds the picture already – it is upgraded from
 * its own bytes, which costs no request at all. Only a photo with none has to
 * ask Wikimedia.
 */
const WEBP_URI = "data:image/webp;";

/**
 * Anything that is not already a WebP placeholder of the width we want –
 * missing, an older format, or an older width.
 */
const needsBlur = async (photo: Photo) => {
  if (!photo.blur?.startsWith(WEBP_URI)) return true;
  return (await blurWidth(photo.blur)) !== BLUR_WIDTH;
};

/** `Array.some` cannot await, and the width check has to. */
const someNeedsBlur = async (photos: Photo[]) => {
  for (const photo of photos) if (await needsBlur(photo)) return true;
  return false;
};

const fillBlur = async (photos: Photo[]) => {
  for (const photo of photos) {
    if (!(REBLUR || (await needsBlur(photo)))) continue;
    // Upgrading in place only works when the stored picture is already the
    // width we want and merely the wrong format – then its own bytes are the
    // ones to re-encode, and the run costs no request. A placeholder of the
    // wrong *width* holds too few pixels to become the right one, however it
    // is encoded, so it falls through and is fetched again.
    const stored = photo.blur ? await blurWidth(photo.blur) : null;
    if (photo.blur && !REBLUR && stored === BLUR_WIDTH) {
      const [head, body] = photo.blur.split(",");
      const type = head?.slice("data:".length, head.indexOf(";")) ?? "";
      const again = await blurUri(
        new Uint8Array(Buffer.from(body ?? "", "base64")),
        type,
      );
      if (again) photo.blur = again;
      continue;
    }
    const blur = await blurFor(photo.src);
    if (blur) photo.blur = blur;
  }
};

// ── Run ──────────────────────────────────────────────────────────────────────

const wanted = (slug: string) => !ONLY || slug.includes(ONLY);

/** Validated and laid out by the one writer, like every other file in `data/`. */
const save = (photos: Map<string, Photo[]>) =>
  writeData("generated/photos.json", Object.fromEntries(photos));

const main = async () => {
  const photos = new Map<string, Photo[]>(
    Object.entries(await read("generated/photos.json")),
  );

  const places = [
    ...passes.map((p) => ({ ...p, kind: "pass" as const })),
    ...towns.map((t) => ({ ...t, kind: "town" as const })),
  ];
  const todo = REBLUR
    ? []
    : places.filter(
        (p) =>
          wanted(p.slug) && (REFRESH || !photos.has(entityKey(p.kind, p.slug))),
      );

  let done = 0;
  let stopped: string | null = null;
  for (const place of todo) {
    const key = entityKey(place.kind, place.slug);
    let found: Photo[];
    try {
      found = await forPlace(place, RADIUS_M[place.kind], place.name);
    } catch (error) {
      if (
        !(
          error instanceof RateLimitedError ||
          error instanceof QuotaExhaustedError
        )
      )
        throw error;
      stopped = error.message;
      break;
    }
    done += 1;
    await fillBlur(found);
    if (found.length > 0) photos.set(key, found);
    else photos.delete(key);
    await save(photos);
    console.log(`${found.length > 0 ? "✓" : "–"} ${key} (${found.length})`);
  }

  // A tour is a line, not a place, and has no Commons entry of its own. It
  // borrows the leading photo of each of its passes, in riding order – which
  // also makes the strip a preview of what the day looks like.
  for (const tour of tours) {
    if (!wanted(tour.slug)) continue;
    const borrowed = tour.passes
      .map((slug) => photos.get(entityKey("pass", slug))?.[0])
      .filter((p): p is Photo => Boolean(p))
      .slice(0, PHOTO_LIMIT);
    const key = entityKey("tour", tour.slug);
    if (borrowed.length > 0) photos.set(key, borrowed);
    else photos.delete(key);
  }

  // Everything that still has no placeholder: entries written before this
  // field existed, and the ones a run that stopped early never reached. Saved
  // per entity for the same reason the search is – an interrupted backfill
  // keeps what it already fetched.
  for (const [key, list] of photos) {
    // Not only "has none": a placeholder in another format is one the
    // re-encoding step had not been written yet when it was fetched, and the
    // upgrade is local, so skipping those would leave them JPEG for good.
    if (!(wanted(key) && (REBLUR || (await someNeedsBlur(list))))) continue;
    await fillBlur(list);
    await save(photos);
  }
  await save(photos);

  const all = [...photos.values()].flat();
  const withBlur = all.filter((p) => p.blur).length;
  console.log(
    `\n${photos.size} Einträge, ${all.length} Fotos, ${done} von ${todo.length} abgefragt, ` +
      `${withBlur} mit Vorschau.`,
  );
  if (stopped)
    console.warn(
      `${stopped} – ${todo.length - done} offen, "bun run data:photos" später erneut ausführen.`,
    );
};

await main();
