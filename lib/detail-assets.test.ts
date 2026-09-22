import { describe, expect, test } from "bun:test";

import {
  DETAIL_ASSET_DIR,
  DETAIL_FILES,
  detailAssets,
} from "@/lib/detail-assets";
import type { DetailData } from "@/lib/detail-assets";
import { entityKey } from "@/lib/route-key";
import type {
  Pass,
  Photo,
  Photos,
  ProfileWithCoords,
  Tour,
  Town,
} from "@/lib/types";

const pass = {
  ascents: [
    { from: { lat: 46, lon: 9 }, label: "Nord" },
    { from: { lat: 46.2, lon: 9 }, label: "Süd" },
  ],
  name: "Testpass",
  slug: "testpass",
} as Pass;
const tour = { name: "Testrunde", slug: "testrunde" } as Tour;
const town = { name: "Testort", slug: "testort" } as Town;

const profile = (top: number) =>
  ({
    avgGradient: 7,
    coords: [[46, 9]],
    dist: [0],
    ele: [800],
    elevationGain: 1200,
    km: 20,
    maxKmGradient: 9,
    start: 800,
    top,
  }) as ProfileWithCoords;

const photo = (title: string) => ({ title }) as Photo;

const profiles: Record<string, ProfileWithCoords> = {
  "testpass:0": profile(2000),
  "testpass:1": profile(2000),
};
const photos: Photos = {
  "pass:testpass": [photo("Testpass von Norden")],
  "town:testort": [photo("Testort")],
};

const build = (p = profiles, ph = photos): ReturnType<typeof detailAssets> =>
  detailAssets([pass], [tour], [town], p, ph);

const bodyOf = (files: ReturnType<typeof detailAssets>["files"], n: number) =>
  JSON.parse(files[n]!.body) as DetailData;

describe("detailAssets", () => {
  test("one file per entity that has something, named by content", () => {
    const { assets, files } = build();
    // The tour has neither a photo nor a profile, so it gets no file and no
    // URL – and the panel makes no request for it.
    expect(files).toHaveLength(2);
    expect(files[0]?.name).toMatch(/^pass-testpass\.[0-9a-f]{8}\.json$/u);
    expect(files[1]?.name).toMatch(/^town-testort\.[0-9a-f]{8}\.json$/u);
    // The count travels with the URL: the panel reserves the carousel's box
    // before the file arrives (see `DetailAsset`).
    expect(assets[entityKey("pass", "testpass")]).toEqual({
      photos: 1,
      url: `/${DETAIL_ASSET_DIR}/${files[0]!.name}`,
    });
    expect(assets[entityKey("tour", "testrunde")]).toBeUndefined();
  });

  test("every written name is one the build script would prune", () => {
    // The script removes files of this shape that are not in the current set;
    // a name it does not recognise would linger in `public/detail` for good.
    // What that shape is, and that `next.config.ts` caches the same set, is
    // `lib/derived-file.test.ts`.
    for (const f of build().files)
      expect(DETAIL_FILES.prune.test(f.name)).toBe(true);
  });

  test("a pass carries its own ascents' profiles and its own photos", () => {
    const data = bodyOf(build().files, 0);
    expect(Object.keys(data.profiles ?? {})).toEqual([
      "testpass:0",
      "testpass:1",
    ]);
    expect(data.photos).toEqual([photo("Testpass von Norden")]);
  });

  test("a town carries photos and no profiles at all", () => {
    const data = bodyOf(build().files, 1);
    expect(data.profiles).toBeUndefined();
    expect(data.photos).toHaveLength(1);
  });

  test("a pass without a routed ascent still gets its photos", () => {
    const { files } = build({});
    expect(bodyOf(files, 0).profiles).toBeUndefined();
    expect(bodyOf(files, 0).photos).toHaveLength(1);
  });

  test("the same content gives the same name, other content another", () => {
    // What makes the file cacheable for a year: the name *is* the content, so
    // `lib/data.ts` derives it without a manifest and a changed profile
    // produces a new URL rather than a stale cached one.
    expect(build().files[0]!.name).toBe(build().files[0]!.name);
    expect(build().files[0]!.name).not.toBe(
      build({ ...profiles, "testpass:0": profile(2100) }).files[0]!.name,
    );
  });
});
