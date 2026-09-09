#!/usr/bin/env bun
/**
 * Precomputation of the detail-panel photos.
 *
 *   bun run data:photos                    # fill the gaps
 *   bun run data:photos --refresh          # ask Commons again for everything
 *   bun run data:photos --only stelvio     # restrict to matching slugs
 *
 * Writes `data/generated/photos.json`: per pass, town and tour a handful of
 * Wikimedia Commons photos with the author, licence and file page their
 * licences oblige us to print (`lib/photos.ts`). Nothing is fetched at runtime
 * and no binary enters the repo – only the thumbnail URLs on Wikimedia's CDN.
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
import { PHOTO_LIMIT, PHOTO_WIDTH, photoKey } from "../lib/photos";
import { FILES } from "../lib/schema";
import type { Photo, Photos } from "../lib/types";
import { best, NEAR_BONUS, rank } from "./lib/photo-rank";
import type { Page } from "./lib/photo-rank";

const OUT = new URL("../data/generated/photos.json", import.meta.url);
const API = "https://commons.wikimedia.org/w/api.php";
const UA =
  "alpenpaesse-data-build/1.0 (https://github.com/mdugue/alpen; mail@manuel.fyi)";
const REFRESH = process.argv.includes("--refresh");
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
const RETRIES = 5;
const BACKOFF_MS = 10_000;

// ── Commons API ──────────────────────────────────────────────────────────────

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
  const todo = places.filter(
    (p) => wanted(p.slug) && (REFRESH || !photos.has(photoKey(p.kind, p.slug))),
  );

  let done = 0;
  let stopped: string | null = null;
  for (const place of todo) {
    const key = photoKey(place.kind, place.slug);
    let found: Photo[];
    try {
      found = await forPlace(place, RADIUS_M[place.kind], place.name);
    } catch (error) {
      if (!(error instanceof RateLimitedError)) throw error;
      stopped = error.message;
      break;
    }
    done += 1;
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
      .map((slug) => photos.get(photoKey("pass", slug))?.[0])
      .filter((p): p is Photo => Boolean(p))
      .slice(0, PHOTO_LIMIT);
    const key = photoKey("tour", tour.slug);
    if (borrowed.length > 0) photos.set(key, borrowed);
    else photos.delete(key);
  }
  await save(photos);

  const total = [...photos.values()].reduce((n, p) => n + p.length, 0);
  console.log(
    `\n${photos.size} Einträge, ${total} Fotos, ${done} von ${todo.length} abgefragt.`,
  );
  if (stopped)
    console.warn(
      `${stopped} – ${todo.length - done} offen, "bun run data:photos" später erneut ausführen.`,
    );
};

await main();
