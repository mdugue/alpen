import { describe, expect, test } from "bun:test";

import {
  BLUR_WIDTH,
  PHOTO_WIDTH,
  photoSrcSet,
  THUMB_WIDTHS,
  thumbUrl,
} from "@/lib/photos";

const DIR = "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c";
const SRC = `${DIR}/Ospiz_Albulapass.jpg/960px-Ospiz_Albulapass.jpg`;

describe("thumbUrl", () => {
  test("rewrites the width in the last segment only", () => {
    expect(thumbUrl(SRC, 250)).toBe(
      `${DIR}/Ospiz_Albulapass.jpg/250px-Ospiz_Albulapass.jpg`,
    );
  });

  test("leaves a URL alone that is not a thumbnail", () => {
    // `thumb` in scripts/lib/photo-rank.ts falls back to the original file
    // when Commons rendered no thumbnail; that URL has no width to rewrite.
    expect(
      thumbUrl(
        "https://upload.wikimedia.org/wikipedia/commons/9/9c/Ospiz.jpg",
        250,
      ),
    ).toBeUndefined();
  });

  test("leaves the rewritten names of non-bitmap sources alone", () => {
    expect(
      thumbUrl(`${DIR}/Karte.tif/lossy-page1-960px-Karte.tif.jpg`, 250),
    ).toBeUndefined();
  });

  test("never upscales", () => {
    expect(thumbUrl(SRC, 1280)).toBeUndefined();
    expect(thumbUrl(SRC, 960)).toBe(SRC);
  });

  test("the widths it is asked for are ones Wikimedia renders", () => {
    // Anything off this ladder is answered with a 400 (T414805), so a width
    // used anywhere in the app has to be on it.
    expect(THUMB_WIDTHS).toContain(BLUR_WIDTH);
    for (const w of [250, 500, 960])
      expect(THUMB_WIDTHS as readonly number[]).toContain(w);
    // What the API is asked for is rounded up to the ladder instead.
    expect(THUMB_WIDTHS as readonly number[]).not.toContain(PHOTO_WIDTH);
  });
});

describe("photoSrcSet", () => {
  test("offers the smaller widths next to the stored one", () => {
    expect(photoSrcSet({ src: SRC, width: 960 })).toBe(
      `${DIR}/Ospiz_Albulapass.jpg/250px-Ospiz_Albulapass.jpg 250w, ` +
        `${DIR}/Ospiz_Albulapass.jpg/500px-Ospiz_Albulapass.jpg 500w, ` +
        `${SRC} 960w`,
    );
  });

  test("drops the widths at or above the stored one", () => {
    const small = `${DIR}/Ospiz_Albulapass.jpg/500px-Ospiz_Albulapass.jpg`;
    expect(photoSrcSet({ src: small, width: 500 })).toBe(
      `${DIR}/Ospiz_Albulapass.jpg/250px-Ospiz_Albulapass.jpg 250w, ${small} 500w`,
    );
  });

  test("is undefined where nothing smaller can be offered", () => {
    const tiny = `${DIR}/Ospiz_Albulapass.jpg/250px-Ospiz_Albulapass.jpg`;
    expect(photoSrcSet({ src: tiny, width: 250 })).toBeUndefined();
  });
});
