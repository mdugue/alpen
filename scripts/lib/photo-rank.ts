/**
 * Picking the photos of a place out of what Commons has nearby.
 *
 * Separate from `scripts/build-photos.ts` for the same reason the route gate is
 * separate from the router: this half is a pure function of an API answer, so
 * the rules can be tuned and tested against fixtures without spending a single
 * request. The script does the talking, this module does the choosing.
 *
 * There is no editorial step behind it. Commons puts everything that carries a
 * coordinate into the same haystack, and around a pass that is largely road
 * signs, ski piste plans, maps and coats of arms. The rules only have to keep
 * those out and put the photo that names the place first; a summit under a
 * metre of snow is a fair answer to "what does it look like up there".
 *
 * Pure functions, no I/O, no imports from the app.
 */
import type { Photo } from "../../lib/types";

/** The parts of one `imageinfo` entry that the choice depends on. */
export interface ImageInfo {
  descriptionurl: string;
  extmetadata?: Record<string, { value?: string } | undefined>;
  height: number;
  mime: string;
  /** The thumbnail Commons rendered for the requested width, if any. */
  thumburl?: string;
  url: string;
  width: number;
}

/** One page of an `action=query` answer, in the order the API returned it. */
export interface Page {
  imageinfo?: ImageInfo[];
  title: string;
}

export interface Ranked {
  photo: Photo;
  score: number;
}

/** Below this a file cannot fill a panel-wide photo on a 2× screen. */
export const MIN_WIDTH = 1200;
export const MIN_HEIGHT = 700;
/** Wider than this and a 16:9 crop shows a stripe of nothing. */
export const MAX_RATIO = 5;

const AREA_CAP = 12;
const NAME_BONUS = 40;
/** How much being the first geosearch hit is worth over being the last. */
export const NEAR_BONUS = 20;

/** Commons descriptions are wiki HTML; an attribution line has to be text. */
export const plain = (html?: string) =>
  (html ?? "")
    .replaceAll(/<[^>]*>/gu, " ")
    .replaceAll(/&[a-z]+;|&#\d+;/giu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, 80)
    .trim();

/** `File:Col_du_Galibier_3.jpg` → `Col du Galibier 3`. */
export const fileName = (title: string) =>
  title
    .replace(/^File:/u, "")
    .replace(/\.[a-z0-9]+$/iu, "")
    .replaceAll("_", " ")
    .trim();

/** Comparable form of a name: no diacritics, no punctuation, lower case. */
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, " ")
    .trim();

/** What a photo of a place is not – recognisable by its file name. */
const NOT_A_VIEW =
  /\b(?:karte|map|mapa|carte|mappa|plan|diagram|schema|grafik|graph|chart|logo|wappen|coat of arms|blason|stemma|escudo|seal|flag|flagge|drapeau|bandiera|panneau|schild|sign|signpost|stamp|briefmarke|profil|profile|poster|banner|icon|scan|dokument|urkunde|tabelle|table|topographic|orthophoto|satellite|lidar|dem)\b/u;

/** Big enough, a photograph, and not one of the things above. */
export const usable = (page: Page, info: ImageInfo) =>
  (info.mime === "image/jpeg" || info.mime === "image/png") &&
  info.width >= MIN_WIDTH &&
  info.height >= MIN_HEIGHT &&
  info.width / info.height <= MAX_RATIO &&
  !NOT_A_VIEW.test(fold(fileName(page.title)));

/**
 * Rank within one entity: the file name naming the place is the strongest
 * signal, then how close Commons found it (its result order), then size and
 * orientation as tie-breakers.
 */
export const score = (
  page: Page,
  info: ImageInfo,
  name: string,
  order: number,
) => {
  const title = fold(fileName(page.title));
  const named = fold(name);
  const tokens = named.split(" ").filter((t) => t.length > 3);
  const hit = title.includes(named)
    ? 1
    : tokens.filter((t) => title.includes(t)).length / (tokens.length || 1);

  return (
    hit * NAME_BONUS +
    Math.max(0, NEAR_BONUS - order) +
    Math.min(AREA_CAP, (info.width * info.height) / 1e6) +
    (info.width > info.height ? 10 : 0)
  );
};

/**
 * The URL is the thumbnail the API picked, never one composed here: Commons
 * renders only a fixed set of widths and answers anything else with a 400, and
 * which of them it lands on is its decision. The real width is therefore read
 * back out of the URL rather than taken from the request; a file smaller than
 * the requested width comes back as the original and keeps its own size.
 */
export const thumb = (info: ImageInfo) => {
  const src = (info.thumburl ?? info.url).split("?")[0] ?? info.url;
  const width = Number(/\/(?<px>\d+)px-/u.exec(src)?.groups?.px ?? info.width);
  return {
    height: Math.round((info.height * width) / info.width),
    src,
    width,
  };
};

/** Everything the licence obliges us to print, next to the URL. */
export const toPhoto = (page: Page, info: ImageInfo): Photo | null => {
  const title = fileName(page.title);
  if (!title) return null;
  const licenseUrl = plain(info.extmetadata?.LicenseUrl?.value);

  return {
    artist:
      plain(info.extmetadata?.Artist?.value) ||
      plain(info.extmetadata?.Credit?.value),
    ...thumb(info),
    // Never silently unlicensed: where Commons states none, the file page does.
    license:
      plain(info.extmetadata?.LicenseShortName?.value) || "siehe Dateiseite",
    ...(licenseUrl.startsWith("http") ? { licenseUrl } : {}),
    page: info.descriptionurl,
    title,
  };
};

/** Every usable page of one answer, scored against the entity's name. */
export const rank = (pages: Page[], name: string): Ranked[] => {
  const out: Ranked[] = [];
  for (const [order, page] of pages.entries()) {
    const info = page.imageinfo?.[0];
    if (!info || !usable(page, info)) continue;
    const photo = toPhoto(page, info);
    if (photo) out.push({ photo, score: score(page, info, name, order) });
  }
  return out;
};

/** The best `limit` of several answers, each file at most once. */
export const best = (found: Ranked[], limit: number): Photo[] => {
  const seen = new Set<string>();
  const out: Photo[] = [];
  for (const { photo } of found.toSorted((a, b) => b.score - a.score)) {
    if (seen.has(photo.src)) continue;
    seen.add(photo.src);
    out.push(photo);
    if (out.length === limit) break;
  }
  return out;
};
