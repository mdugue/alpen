import { createHash } from "node:crypto";

import type { EntityKind } from "@/lib/app-state";
import type {
  Pass,
  Photo,
  Photos,
  ProfileWithCoords,
  Tour,
  Town,
} from "@/lib/types";

// Relative on purpose, same as in `lib/map-assets.ts`: this module is imported
// by `next.config.ts` and by a Bun script outside the bundler, where the "@/"
// alias is not resolved for transitive imports. Type-only imports are erased
// and may keep the alias.
import { photoKey } from "./photos";
import { ascentKey } from "./route-key";

/**
 * What the detail panel needs about *one* entity, as a static file per entity –
 * the sequel to `lib/map-assets.ts`, which took the route geometry out of the
 * page (docs/plans/01-map-data-out-of-payload.md), for the two datasets that
 * were left: the elevation profiles and the Commons photos.
 *
 * Measured on the prerendered page, per prop and gzipped: profiles 297 KB,
 * photos 77 KB, everything else together 94 KB. Both are read by exactly one
 * component, for exactly one entity at a time, and the app is about choosing a
 * destination – overview first, route-level detail last. Shipping all 201
 * passes' profiles so that a visitor can look at one is the same mistake plan
 * 01 fixed for the geometry, one layer up.
 *
 * So the page carries one URL per entity and the panel fetches the file for
 * what is selected. The name holds a content hash, which makes the file
 * immutable (`next.config.ts` caches it for a year), so looking at the same
 * pass twice, or on the next visit, costs nothing. There is no manifest to
 * keep in sync: `scripts/build-detail-assets.ts` writes the files and
 * `lib/data.ts` derives the same names from the same content.
 *
 * The climate series stays a prop. It is not detail: `buildPassRows` and
 * `facetCount` read a pass's half-month out of it on every keystroke, so a
 * climate that arrives late would mean a sidebar that counts wrong for a
 * moment – and at 42 KB gzipped it is not what makes the page heavy.
 *
 * Never imported by client code – it needs `node:crypto`. Components take the
 * `DetailAssets` type only, which is a map of URLs.
 */

/** What the panel reads once an entity is selected. */
export interface DetailData {
  /**
   * The profiles of this pass's ascents, keyed as `routes.json`
   * (`ascentKey`). Absent for a tour or a town: neither draws a profile.
   */
  profiles?: Record<string, ProfileWithCoords>;
  photos: Photo[];
}

/**
 * Per `${kind}:${slug}` – the key `photoKey` and `nearbyKey` already use – the
 * URL of that entity's file. An entity with nothing to show is absent rather
 * than pointing at an empty file, so the panel makes no request for it.
 */
export type DetailAssets = Record<string, string>;

/** Where the files live under `public/`, and thus their URL prefix. */
export const DETAIL_ASSET_DIR = "detail";

/** What the script writes and prunes, and what `next.config.ts` caches for a year. */
export const ASSET_NAME = /^[a-z]+-[a-z0-9-]+\.[0-9a-f]{8}\.json$/u;

export interface DetailFile {
  /** `pass-stilfser-joch.a1b2c3d4.json` – 8 hex digits of SHA-256 of `body`. */
  name: string;
  body: string;
}

/**
 * The file name of one entity. A dash rather than the key's colon: a colon is
 * not a legal file name character on Windows, and `public/` is checked out on
 * whatever machine runs `dev`.
 */
const fileName = (kind: EntityKind, slug: string, body: string) =>
  `${kind}-${slug}.${createHash("sha256").update(body).digest("hex").slice(0, 8)}.json`;

const file = (
  kind: EntityKind,
  slug: string,
  data: DetailData,
): DetailFile | null => {
  // Nothing to show: no file, no URL, and so no request from the panel.
  if (data.photos.length === 0 && !data.profiles) return null;
  const body = JSON.stringify(data);
  return { body, name: fileName(kind, slug, body) };
};

/**
 * One file per pass, tour and town, plus the map from entity key to URL that
 * the page hands the client.
 *
 * `profiles` are the ones with sample coordinates (`getProfiles`' old shape):
 * the panel draws the profile and the map puts the cursor on the road, and
 * both read the same object.
 */
export const detailAssets = (
  passes: readonly Pass[],
  tours: readonly Tour[],
  towns: readonly Town[],
  profiles: Record<string, ProfileWithCoords>,
  photos: Photos,
): { files: DetailFile[]; assets: DetailAssets } => {
  const files: DetailFile[] = [];
  const assets: DetailAssets = {};

  const add = (kind: EntityKind, slug: string, data: DetailData) => {
    const f = file(kind, slug, data);
    if (!f) return;
    files.push(f);
    assets[photoKey(kind, slug)] = `/${DETAIL_ASSET_DIR}/${f.name}`;
  };

  for (const pass of passes) {
    const own: Record<string, ProfileWithCoords> = {};
    for (const [i] of pass.ascents.entries()) {
      const key = ascentKey(pass.slug, i);
      const profile = profiles[key];
      if (profile) own[key] = profile;
    }
    add("pass", pass.slug, {
      photos: photos[photoKey("pass", pass.slug)] ?? [],
      ...(Object.keys(own).length ? { profiles: own } : {}),
    });
  }
  for (const tour of tours)
    add("tour", tour.slug, {
      photos: photos[photoKey("tour", tour.slug)] ?? [],
    });
  for (const town of towns)
    add("town", town.slug, {
      photos: photos[photoKey("town", town.slug)] ?? [],
    });

  return { assets, files };
};
