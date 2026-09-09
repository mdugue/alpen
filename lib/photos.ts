import type { EntityKind } from "@/lib/app-state";

/**
 * Photos come from Wikimedia Commons and are precomputed into
 * `data/generated/photos.json` by `scripts/build-photos.ts`; this module holds
 * what the script, the data layer and the panel have to agree on. Client-safe:
 * no dependencies beyond a type.
 *
 * Only the metadata lives in the repo. The files themselves stay on Wikimedia's
 * CDN and the browser loads them from `Photo.src` – the one place where an
 * asset is not served from this origin, and the reason is that mirroring a few
 * hundred photos would put ~25 MB of binaries into a repository whose largest
 * file today is a 3 MB JSON.
 */

/** Key of `photos.json`, the same shape as `nearbyKey` in `lib/nearby.ts`. */
export const photoKey = (kind: EntityKind, slug: string) => `${kind}:${slug}`;

/**
 * Width asked of Commons for the stored thumbnail. The detail panel is around
 * 400 px wide, so this covers a 2× display and nothing beyond it. Commons
 * renders only a fixed set of widths and rounds the request up to the next one
 * (800 lands on 960), which is why the stored URL is the one the API answers
 * with rather than one composed here – anything else is a 400.
 */
export const PHOTO_WIDTH = 800;

/** How many photos one entity keeps – enough to swipe, small enough to ship. */
export const PHOTO_LIMIT = 6;
