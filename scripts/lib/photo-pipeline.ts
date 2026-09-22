/**
 * What `data:photos` chooses, and the run that carries it out.
 *
 * `photo-rank.ts` scores one Commons answer and `blur.ts` turns one thumbnail
 * into a placeholder; both are deep and tested. The decisions around them were
 * not: who is asked at all, when a second request by name is worth making, how
 * far around a point Commons is asked to look, what a tour shows when it has
 * no entry of its own, and which stored placeholder has to be fetched again
 * all lived in the script, where nothing could put them in front of a table of
 * cases.
 *
 * They are here now, as functions over an explicit state – the previous
 * `photos.json` goes in, the next one comes out. Nothing is mutated on the
 * way: a tour borrows its passes' photo objects and two neighbouring passes
 * share a file, so a placeholder written into one record used to appear in
 * another by accident rather than by decision.
 *
 * `runPhotos` is the executing half, the way `runPipeline` is for the build:
 * it does the talking through a `Transport` and hands the state to `save` as
 * each entity arrives, because an interrupted run must not throw away an hour
 * of requests.
 */
import { BLUR_WIDTH, PHOTO_LIMIT, thumbUrl } from "../../lib/photos";
import { entityKey } from "../../lib/route-key";
import type { LatLon, Pass, Photo, Tour, Town } from "../../lib/types";
import { blurUri, storedBlur } from "./blur";
import { commons } from "./hosts";
import type { Page } from "./hosts";
import { best, NEAR_BONUS, rank } from "./photo-rank";
import { QuotaExhaustedError, RateLimitedError } from "./transport";
import type { Transport } from "./transport";

/** Everything `data:photos` has written so far, keyed by `entityKey`. */
export type StoredPhotos = Record<string, Photo[]>;

/** The hand-maintained side: everything that can carry photos. */
export interface PhotoCurated {
  passes: Pass[];
  tours: Tour[];
  towns: Town[];
}

export interface PhotoFlags {
  /** `--only stelvio`: restrict the run to matching slugs. */
  only?: string;
  /** `--blur`: every placeholder again, without asking Commons for photos. */
  reblur: boolean;
  /** `--refresh`: ask Commons again for entities that already have photos. */
  refresh: boolean;
}

/**
 * How far around a pass point or town centre Commons is asked to look. A town
 * is a place with an extent; a pass is a point on a road, and a photo taken a
 * kilometre further down the valley is a photo of something else.
 */
export const RADIUS_M = { pass: 2000, town: 2500 };

/** One place Commons can be asked about, with everything the asking needs. */
export interface PlaceJob extends LatLon {
  key: string;
  name: string;
  radius: number;
}

/** Whether a slug or a key is one this run is restricted to. */
const wanted = (what: string, flags: PhotoFlags) =>
  flags.only === undefined || what.includes(flags.only);

/**
 * The places this run asks Commons about: the ones with no photos yet, or all
 * of them with `--refresh`. Incremental by default, so a rerun after adding
 * one pass costs one request – and none at all when only the placeholders are
 * being redone.
 */
export const placeJobs = (
  curated: PhotoCurated,
  stored: StoredPhotos,
  flags: PhotoFlags,
): PlaceJob[] =>
  flags.reblur
    ? []
    : [
        ...curated.passes.map((p) => ({ ...p, kind: "pass" as const })),
        ...curated.towns.map((t) => ({ ...t, kind: "town" as const })),
      ]
        .filter((p) => wanted(p.slug, flags))
        .map((p) => ({
          key: entityKey(p.kind, p.slug),
          lat: p.lat,
          lon: p.lon,
          name: p.name,
          radius: RADIUS_M[p.kind],
        }))
        .filter((job) => flags.refresh || !stored[job.key]);

/** The two questions Commons answers about a place. */
export interface Ask {
  /** Bitmap files whose name or description mentions the place. */
  byName: (name: string) => Promise<Page[]>;
  /** Files carrying a coordinate within `radius` metres of the point. */
  nearby: (at: LatLon, radius: number) => Promise<Page[]>;
}

/**
 * The photos of one place, best first.
 *
 * The geosearch is the first question and usually the only one. A geosearch
 * that comes back nearly empty means the photos of this place were never given
 * a coordinate, not that there are none – so the name search follows, and only
 * then, because it is a second request for every place and its hits are worse:
 * a file that merely mentions the name can stand anywhere, which is exactly
 * what `NEAR_BONUS` pays for, so the penalty takes that payment back.
 */
export const photosFor = async (
  place: PlaceJob,
  ask: Ask,
): Promise<Photo[]> => {
  const found = rank(await ask.nearby(place, place.radius), place.name);
  if (found.length < PHOTO_LIMIT)
    found.push(
      ...rank(await ask.byName(place.name), place.name).map((r) => ({
        ...r,
        score: r.score - NEAR_BONUS,
      })),
    );
  return best(found, PHOTO_LIMIT);
};

/** The state with one entity's photos taken in; an entity with none is dropped. */
export const withPhotos = (
  stored: StoredPhotos,
  key: string,
  photos: Photo[],
): StoredPhotos =>
  photos.length === 0
    ? Object.fromEntries(Object.entries(stored).filter(([k]) => k !== key))
    : { ...stored, [key]: photos };

/**
 * The tours' entries, derived from what the passes have. A tour is a line, not
 * a place, and has no Commons entry of its own: it borrows the leading photo
 * of each of its passes, in riding order – which also makes the strip a
 * preview of what the day looks like.
 */
export const borrowed = (
  stored: StoredPhotos,
  tours: Tour[],
  flags: PhotoFlags,
): StoredPhotos => {
  let next = stored;
  for (const tour of tours) {
    if (!wanted(tour.slug, flags)) continue;
    const from = next;
    next = withPhotos(
      next,
      entityKey("tour", tour.slug),
      tour.passes
        .map((slug) => from[entityKey("pass", slug)]?.[0])
        .filter((p): p is Photo => Boolean(p))
        .slice(0, PHOTO_LIMIT),
    );
  }
  return next;
};

/**
 * What one photo's placeholder still needs: nothing, its own bytes re-encoded,
 * or the 20-px rendering fetched again.
 */
export type BlurJob =
  | { act: "fetch"; url: string }
  | { act: "recode"; bytes: Uint8Array; type: string }
  | null;

/** What a placeholder is stored as; anything else predates the re-encoding step. */
const WEBP = "image/webp";

/**
 * Whether a stored placeholder is still the one we want, and from where the
 * one we want would come.
 *
 * A placeholder that is already WebP of the right width is done, and this is
 * the answer for every photo on a run that has nothing to do – read off the
 * record, so such a run decodes no picture at all. One in another format was
 * written before the re-encoding step existed and holds the picture already:
 * it is upgraded from its own bytes and costs no request. A placeholder of the
 * wrong *width* holds too few pixels to become the right one, however it is
 * encoded, so it is fetched again like a missing one. `--blur` fetches
 * regardless, which is what it is for.
 */
export const blurJob = (photo: Photo, reblur: boolean): BlurJob => {
  const stored = photo.blur ? storedBlur(photo.blur) : null;
  if (!reblur && stored?.type === WEBP && stored.width === BLUR_WIDTH)
    return null;
  if (!reblur && stored?.width === BLUR_WIDTH)
    return { act: "recode", bytes: stored.bytes, type: stored.type };
  const url = thumbUrl(photo.src, BLUR_WIDTH);
  // Not a thumbnail URL we may rewrite – the panel falls back to its own
  // surface, which is what it did before there were placeholders at all.
  return url ? { act: "fetch", url } : null;
};

export interface PhotoRunOptions {
  curated: PhotoCurated;
  flags: PhotoFlags;
  log: (line: string) => void;
  /** Called with the next state whenever an entity is done. */
  save: (photos: StoredPhotos) => Promise<void>;
  /** The state the run starts from; it is never written into. */
  state: StoredPhotos;
  transport: Transport;
  /** A photo that ends up without a placeholder – cosmetic, never fatal. */
  warn: (line: string) => void;
}

export interface PhotoReport {
  /** Places Commons was asked about, of `todo` many. */
  asked: number;
  /** The state as the run left it. */
  photos: StoredPhotos;
  /** Why the run gave up early – null when it worked through its list. */
  stopped: string | null;
  todo: number;
}

/**
 * One run: ask about the places that have no photos, let the tours borrow, and
 * fill in every placeholder that is missing or out of date – the last of which
 * also catches the entries a run that stopped early never reached.
 *
 * If a host keeps saying 429 the run stops and reports how many places are
 * left rather than hammering: what it had is already on disk, and the next run
 * picks up there.
 */
export const runPhotos = async ({
  curated,
  flags,
  log,
  save,
  state,
  transport,
  warn,
}: PhotoRunOptions): Promise<PhotoReport> => {
  const ask: Ask = {
    byName: (name) => commons.search(transport, name),
    nearby: (at, radius) => commons.geosearch(transport, at, radius),
  };

  /**
   * The smallest standard width of one file, as a data URI. Keyed by the
   * thumbnail URL because a tour borrows its passes' photos and a pass can
   * share a file with its neighbour: one file is fetched once per run.
   */
  const fetched = new Map<string, string | null>();
  const thumbnail = async (url: string): Promise<string | null> => {
    const cached = fetched.get(url);
    if (cached !== undefined) return cached;
    let blur: string | null = null;
    try {
      const { bytes, type } = await commons.thumbnail(transport, url);
      blur = await blurUri(bytes, type);
      if (!blur) warn(`  ohne Vorschau: ${url} (${type}, zu groß)`);
    } catch (error) {
      // A missing placeholder is a cosmetic loss, never a reason to drop a
      // photo or to end a run that has already spent its API budget.
      warn(`  ohne Vorschau: ${url} (${(error as Error).message})`);
    }
    fetched.set(url, blur);
    return blur;
  };

  /** The same photos with their placeholders, as new records. */
  const withBlur = async (photos: Photo[]): Promise<Photo[]> => {
    const out: Photo[] = [];
    for (const photo of photos) {
      const job = blurJob(photo, flags.reblur);
      const blur = job
        ? job.act === "fetch"
          ? await thumbnail(job.url)
          : await blurUri(job.bytes, job.type)
        : null;
      out.push(blur ? { ...photo, blur } : photo);
    }
    return out;
  };

  let photos = state;
  const todo = placeJobs(curated, photos, flags);
  let asked = 0;
  let stopped: string | null = null;
  for (const place of todo) {
    let found: Photo[];
    try {
      found = await photosFor(place, ask);
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
    asked += 1;
    photos = withPhotos(photos, place.key, await withBlur(found));
    await save(photos);
    log(`${found.length > 0 ? "✓" : "–"} ${place.key} (${found.length})`);
  }

  photos = borrowed(photos, curated.tours, flags);

  // Everything that still has no placeholder: entries written before the field
  // existed, ones in an older format or width, and the ones a run that stopped
  // early never reached. Saved per entity for the same reason the search is.
  for (const [key, list] of Object.entries(photos)) {
    if (!(wanted(key, flags) && list.some((p) => blurJob(p, flags.reblur))))
      continue;
    photos = { ...photos, [key]: await withBlur(list) };
    await save(photos);
  }
  await save(photos);
  return { asked, photos, stopped, todo: todo.length };
};
