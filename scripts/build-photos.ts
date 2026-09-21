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
 * Rate limit. The Commons API asks for a descriptive User-Agent and moderate
 * serial use; requests are serial with `GAP_MS` in between and back off when it
 * answers 429 anyway. If it keeps saying 429 the run stops and reports how many
 * entities are left rather than hammering – what it had is already on disk, and
 * the next run picks up there. Every entity is written as it arrives for the
 * same reason: an interrupted run must not throw away an hour of requests.
 */
import passes from "../data/passes.json" with { type: "json" };
import tours from "../data/tours.json" with { type: "json" };
import towns from "../data/towns.json" with { type: "json" };
import { BLUR_WIDTH, PHOTO_LIMIT, PHOTO_WIDTH, thumbUrl } from "../lib/photos";
import { entityKey } from "../lib/route-key";
import { FILES } from "../lib/schema";
import type { Photo, Photos } from "../lib/types";
import { blurUri, blurWidth } from "./lib/blur";
import { best, NEAR_BONUS, rank } from "./lib/photo-rank";
import type { Page } from "./lib/photo-rank";

const OUT = new URL("../data/generated/photos.json", import.meta.url);
const API = "https://commons.wikimedia.org/w/api.php";
const UA =
  "alpenpaesse-data-build/1.0 (https://github.com/mdugue/alpen; mail@manuel.fyi)";
const REFRESH = process.argv.includes("--refresh");
/** Fetch every placeholder again, without asking Commons for the photos. */
const REBLUR = process.argv.includes("--blur");
const ONLY = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : undefined;
/** How far around a pass point or town centre Commons is asked to look. */
const RADIUS_M = { pass: 2000, town: 2500 };
/**
 * Gap between requests. The whole run is ~120 of them, so three seconds costs
 * six minutes even from cold – and Commons' budget for an anonymous client is
 * small enough that one per second walks into a 429 whose Retry-After is
 * longer than the gap it saved.
 */
const GAP_MS = 3000;
/**
 * Gap between placeholder requests. These go to the file CDN rather than to
 * the API, which is a different budget and a far cheaper request – but there
 * are up to six per entity and ~1 500 in a first run, and a 20-px width nobody
 * has asked for before has to be rendered on demand, so the CDN answers a
 * sustained burst with 429 like anything else. Serial, paced, and the pace
 * gives way: `slowDown` doubles the gap every time a 429 comes back and the
 * gap never goes down again within a run, because the run is what provoked it.
 * Starting low and yielding beats guessing a number that is polite for every
 * time of day.
 */
const BLUR_GAP_MS = 400;
const BLUR_GAP_MAX_MS = 5000;
/** Answers in a row without a 429 before the gap is allowed back down. */
const BLUR_CALM = 25;
const RETRIES = 5;
const BACKOFF_MS = 10_000;

// ── Commons API ──────────────────────────────────────────────────────────────

/**
 * Being told to slow down is the only measurement of "too fast" there is, so
 * it is the one the pace follows. Declared before `request`, which reports it.
 *
 * It recovers, which the first version of this did not: a handful of 429s in
 * the first minutes doubled the gap to the ceiling and left it there, so a
 * short burst of pushback set the pace for the whole hour that followed. Now
 * a stretch of answers with no complaint in it halves the gap back down, to
 * the starting value and no further. Backing off stays instant – one 429
 * doubles it again – and only the apology is gradual.
 */
let blurGap = BLUR_GAP_MS;
let sinceThrottled = 0;
const slowDown = () => {
  blurGap = Math.min(blurGap * 2, BLUR_GAP_MAX_MS);
  sinceThrottled = 0;
};
const wentWell = () => {
  sinceThrottled += 1;
  if (sinceThrottled < BLUR_CALM) return;
  sinceThrottled = 0;
  blurGap = Math.max(blurGap / 2, BLUR_GAP_MS);
};

/** A rate limit that outlasts the backoff ends the run; it does not fail it. */
class RateLimitedError extends Error {
  name = "RateLimitedError";
}

/**
 * Commons answers a burst with 429 and names how long to wait. Retrying is
 * worth it, but only a few times, and never faster than the header asks.
 */
const request = async (url: URL): Promise<Response> => {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res;
    if (res.status === 429) slowDown();
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable) throw new Error(`Commons ${res.status} – ${url}`);
    if (attempt >= RETRIES)
      throw new RateLimitedError(
        `Commons antwortet weiterhin mit ${res.status} (${RETRIES} Versuche)`,
      );
    const after = Number(res.headers.get("retry-after"));
    const pause =
      Number.isFinite(after) && after > 0
        ? after * 1000
        : BACKOFF_MS * 2 ** attempt;
    console.warn(`  ${res.status}, ${Math.round(pause / 1000)} s Pause`);
    await Bun.sleep(pause);
  }
};

let nextAt = 0;
const api = async (params: Record<string, string>): Promise<Page[]> => {
  const wait = nextAt - Date.now();
  if (wait > 0) await Bun.sleep(wait);
  nextAt = Date.now() + GAP_MS;

  const url = new URL(API);
  for (const [k, v] of Object.entries({
    action: "query",
    format: "json",
    formatversion: "2",
    iiextmetadatafilter: "Artist|Credit|LicenseShortName|LicenseUrl",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: String(PHOTO_WIDTH),
    prop: "imageinfo",
    ...params,
  }))
    url.searchParams.set(k, v);

  const res = await request(url);
  const body = (await res.json()) as { query?: { pages?: Page[] } };
  return body.query?.pages ?? [];
};

/** Everything Commons has within `radius` of the point, best first. */
const nearby = async (
  at: { lat: number; lon: number },
  radius: number,
  name: string,
) =>
  rank(
    await api({
      generator: "geosearch",
      ggscoord: `${at.lat}|${at.lon}`,
      ggslimit: "50",
      ggsnamespace: "6",
      ggsradius: String(radius),
    }),
    name,
  );

/** The same by name, for the places whose photos carry no coordinate. */
const byName = async (name: string) =>
  rank(
    await api({
      generator: "search",
      gsrlimit: "30",
      gsrnamespace: "6",
      gsrsearch: `filetype:bitmap ${name}`,
    }),
    name,
  ).map((r) => ({ ...r, score: r.score - NEAR_BONUS }));

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
let nextBlurAt = 0;

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

  const wait = nextBlurAt - Date.now();
  if (wait > 0) await Bun.sleep(wait);
  nextBlurAt = Date.now() + blurGap;

  let blur: string | null = null;
  try {
    const res = await request(new URL(url));
    wentWell();
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    blur = await blurUri(new Uint8Array(await res.arrayBuffer()), type);
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

/**
 * One sorted key per line, compact value – the same layout the other generated
 * files use, so a diff shows which entity changed rather than the whole file.
 */
const save = async (photos: Map<string, Photo[]>) => {
  const result = FILES["generated/photos.json"].safeParse(
    Object.fromEntries(photos),
  );
  if (!result.success) {
    const [issue] = result.error.issues;
    throw new Error(`photos.json: ${issue?.path.join(".")}: ${issue?.message}`);
  }
  await Bun.write(
    OUT,
    `{\n${[...photos.keys()]
      .toSorted()
      .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(photos.get(k))}`)
      .join(",\n")}\n}\n`,
  );
};

const main = async () => {
  const file = Bun.file(OUT);
  const photos = new Map<string, Photo[]>(
    Object.entries(
      (await file.exists()) ? ((await file.json()) as Photos) : {},
    ),
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
      if (!(error instanceof RateLimitedError)) throw error;
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
