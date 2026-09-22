/**
 * Photos come from Wikimedia Commons and are precomputed into
 * `data/generated/photos.json` by `scripts/build-photos.ts`; this module holds
 * what the script, the data layer and the panel have to agree on. Client-safe
 * and dependency-free; `photos.json` is keyed by `entityKey` (`lib/route-key.ts`).
 *
 * Only the metadata lives in the repo. The files themselves stay on Wikimedia's
 * CDN and the browser loads them from `Photo.src` – the one place where an
 * asset is not served from this origin, and the reason is that mirroring a few
 * hundred photos would put ~25 MB of binaries into a repository whose largest
 * file today is a 3 MB JSON.
 */

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

/**
 * The widths Wikimedia's thumbnail handler renders. Since T414805 a direct
 * request for anything else is answered with a 400 that names this list, so a
 * URL composed here has to land on one of them – which is also why `src` is
 * stored as the API returned it (`thumb` in `scripts/lib/photo-rank.ts`)
 * rather than built from `PHOTO_WIDTH`.
 */
export const THUMB_WIDTHS = [
  20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840,
] as const;

/**
 * The same file at another standard width, or `undefined` when `src` is not a
 * thumbnail URL whose last segment starts with `<width>px-` – the original
 * (a file smaller than what was asked for) and the rewritten names Commons
 * gives non-bitmap sources (`lossy-page1-…`) are left alone rather than
 * guessed at.
 */
export const thumbUrl = (src: string, width: number): string | undefined => {
  const cut = src.lastIndexOf("/");
  const name = src.slice(cut + 1);
  const prefix = /^(?<px>\d+)px-/u.exec(name);
  const stored = Number(prefix?.groups?.px);
  // Never upscale: Commons renders no width above the stored one either.
  if (!prefix || !Number.isFinite(stored) || width > stored) return undefined;
  return `${src.slice(0, cut + 1)}${width}px-${name.slice(prefix[0].length)}`;
};

/**
 * What the carousel offers the browser. The panel is 352–400 px wide, so a 1×
 * screen draws the stored 960 into a third of its pixels; 500 covers it and
 * 250 covers a 1× phone in portrait. The stored width stays in the list as the
 * 2× case, so nothing that used to be downloaded became unavailable.
 */
const SRCSET_WIDTHS = [250, 500];

/** How wide the photo is drawn – the two panel widths in `explorer.tsx`. */
export const PHOTO_SIZES =
  "(width >= 80rem) 400px, (width >= 64rem) 352px, 100vw";

/**
 * `srcset` for one photo, or `undefined` where the URL cannot be rewritten and
 * the single `src` has to do. Only widths below the stored one are added, so
 * the browser can go smaller but never asks for something Commons would reject.
 */
export const photoSrcSet = (photo: {
  src: string;
  width: number;
}): string | undefined => {
  const smaller = SRCSET_WIDTHS.map((w) => [w, thumbUrl(photo.src, w)] as const)
    .filter(([w, url]) => url !== undefined && w < photo.width)
    .map(([w, url]) => `${url} ${w}w`);
  if (smaller.length === 0) return undefined;
  return [...smaller, `${photo.src} ${photo.width}w`].join(", ");
};

/**
 * Width of the placeholder baked into `Photo.blur`, a rung of `THUMB_WIDTHS`.
 * 20 px was the smallest Wikimedia renders and cost ~220 bytes as a base64
 * WebP, but drawn twenty times that it is colour blobs; 40 px holds four
 * times the pixels for ~475, which is the difference between a stand-in that
 * shows the photo's composition and one that shows its average. 60 px doubles
 * the bytes again for far less: the picture is about to be blurred, so detail
 * past this point is spent on something nobody sees. Small enough either way
 * to travel inside the detail file it belongs to, which is the whole point –
 * a placeholder that needs a request of its own places second in the race it
 * was supposed to win, so it is precomputed and never generated on demand.
 */
export const BLUR_WIDTH = 40;
