import { describe, expect, test } from "bun:test";

import { BLUR_MAX_BYTES, blurUri, storedBlur, strip } from "./blur";

/** A minimal but well-formed JPEG: SOI, the segments, SOS, data, EOI. */
const segment = (marker: number, payload: number[]) => [
  0xff,
  marker,
  Math.floor((payload.length + 2) / 256),
  (payload.length + 2) % 256,
  ...payload,
];
const jpeg = (...segments: number[][]) =>
  new Uint8Array([
    0xff,
    0xd8,
    ...segments.flat(),
    ...segment(0xda, [1, 1, 0, 0, 0, 0x3f, 0]),
    0x12,
    0x34,
    0xff,
    0xd9,
  ]);

const DQT = segment(0xdb, [0, 1, 2, 3]);
/** An APP2 segment of the kind a wide-gamut thumbnail carries: an ICC profile. */
const APP2 = segment(
  0xe2,
  Array.from({ length: 4000 }, () => 0x55),
);
const COMMENT = segment(0xfe, [0x68, 0x69]);
/** APP14: not metadata but the colour transform, so it stays. */
const APP14 = segment(0xee, [0x41, 0x64, 0x6f, 0x62, 0x65]);

const png = (...chunks: number[][]) =>
  new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunks.flat(),
  ]);
const chunk = (type: string, payload: number[]) => [
  0,
  0,
  0,
  payload.length,
  ...Array.from(type, (c) => c.codePointAt(0) ?? 0),
  ...payload,
  0,
  0,
  0,
  0,
];

/**
 * A real 20x11 Commons rendering – the encoder needs pixels, and the sizes
 * this file asserts only mean something against a genuine picture.
 */
const THUMB = new Uint8Array(
  Buffer.from(
    "/9j/2wBDAAQDAwQDAwQEAwQFBAQFBgoHBgYGBg0JCggKDw0QEA8NDw4RExgUERIXEg4PFRwVFxkZGxsbEBQdHx0aHxgaGxr/2wBDAQQFBQYFBgwHBwwaEQ8RGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhr/wAARCAALABQDASIAAhEBAxEB/8QAGQAAAgMBAAAAAAAAAAAAAAAAAAMEBgcI/8QAJRAAAQQCAgICAgMAAAAAAAAAAQIDBREEBgcSACExQRMUImGB/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwX/xAAeEQABBAIDAQAAAAAAAAAAAAABAAIDBBExISJRwf/aAAwDAQACEQMRAD8Ao8pwxNQkDkTmzYzkJGtOoZp5sKyFLUaFMdgoJ+f5Kr49X43Wxx7DodGW1m5eQ40wlSZaBxMxDbqge3VTbinOt9SgdRdUr7udonH+sznL+HGyMNiqxH8t4uhoFlSrdUCCtBCqr1V151ZP8R6ElZx0adAobaJZR1jmkqCB7A7BN3ZJu78s2rlqwQMho8H1ToIIIRok+lYho/DEDyhEPzsXsUhOI/acYcyX484J7JohKWUBKUJCVJoCx/f0DxmxabG6fL5GDqj0tC4Th/MrHwprMZbLivRV1S6BdAD/AAeHhNrgty48pDKc9dL/2Q==",
    "base64",
  ),
);

describe("strip", () => {
  test("drops the application segments and the comment, keeps the picture", () => {
    const full = jpeg(APP2, DQT, COMMENT, APP14);
    const out = strip(full, "image/jpeg");
    expect(out).toEqual(jpeg(DQT, APP14));
    // The 4 KB profile is what a 20-px rendering pays for nothing.
    expect(full.length - out.length).toBe(APP2.length + COMMENT.length);
  });

  test("leaves a JPEG without application segments unchanged", () => {
    expect(strip(jpeg(DQT), "image/jpeg")).toEqual(jpeg(DQT));
  });

  test("drops the ancillary chunks of a PNG", () => {
    const ihdr = chunk("IHDR", [1, 2]);
    const idat = chunk("IDAT", [3]);
    const iend = chunk("IEND", []);
    const iccp = chunk("iCCP", [9, 9, 9]);
    expect(strip(png(ihdr, iccp, idat, iend), "image/png")).toEqual(
      png(ihdr, idat, iend),
    );
  });

  test("returns anything it cannot parse untouched", () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(strip(junk, "image/jpeg")).toEqual(junk);
    expect(strip(junk, "image/png")).toEqual(junk);
    expect(strip(junk, "text/html")).toEqual(junk);
  });
});

describe("blurUri", () => {
  test("re-encodes to WebP, which is what makes it small", async () => {
    const uri = await blurUri(THUMB, "image/jpeg");
    expect(uri).toStartWith("data:image/webp;base64,");
    const out = new Uint8Array(Buffer.from(uri?.split(",")[1] ?? "", "base64"));
    // JPEG spends ~280 bytes on its tables before describing a pixel, which
    // is most of a picture this size; WebP does not.
    expect(out.length).toBeLessThan(THUMB.length / 2);
    expect(await new Bun.Image(out).metadata()).toMatchObject({
      format: "webp",
      height: 11,
      width: 20,
    });
  });

  test("strips before it encodes, or the profile rides along", async () => {
    const profile = segment(
      0xe2,
      Array.from({ length: 4000 }, () => 0x55),
    );
    const fat = new Uint8Array([
      ...THUMB.subarray(0, 2),
      ...profile,
      ...THUMB.subarray(2),
    ]);
    const withProfile = await blurUri(fat, "image/jpeg");
    const without = await blurUri(THUMB, "image/jpeg");
    expect(withProfile?.length).toBe(without?.length);
  });

  test("refuses what is still too big to carry", async () => {
    const fat = segment(
      0xdb,
      Array.from({ length: BLUR_MAX_BYTES }, () => 1),
    );
    expect(await blurUri(jpeg(fat), "image/jpeg")).toBeNull();
  });

  test("refuses an answer that is not an image at all", async () => {
    expect(await blurUri(THUMB, "text/html")).toBeNull();
  });
});

const uri = (bytes: Uint8Array, type: string) =>
  `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;

describe("storedBlur", () => {
  test("reads the width of what it wrote, without decoding the picture", async () => {
    const written = (await blurUri(THUMB, "image/jpeg")) ?? "";
    expect(storedBlur(written)).toMatchObject({
      type: "image/webp",
      width: 20,
    });
  });

  test("reads a JPEG and a PNG the same way", () => {
    const sof = segment(0xc0, [8, 0, 11, 0, 20, 3, 1, 0x11, 0, 2, 0x11, 1]);
    expect(storedBlur(uri(jpeg(sof), "image/jpeg"))).toMatchObject({
      type: "image/jpeg",
      width: 20,
    });
    const ihdr = chunk("IHDR", [0, 0, 0, 20, 0, 0, 0, 11, 8, 2, 0, 0, 0]);
    expect(
      storedBlur(uri(png(ihdr, chunk("IEND", [])), "image/png")),
    ).toMatchObject({ type: "image/png", width: 20 });
  });

  test("hands back the bytes, which is what an upgrade re-encodes", async () => {
    // A placeholder written before the re-encoding step existed: it holds the
    // picture already, so it becomes a WebP from its own bytes and no request
    // is spent on it.
    const { bytes, type } = storedBlur(uri(THUMB, "image/jpeg"))!;
    expect(await blurUri(bytes, type)).toBe(await blurUri(THUMB, "image/jpeg"));
  });

  test("says nothing about a URI that is not a base64 picture", () => {
    expect(storedBlur("https://example.org/a.png")).toBeNull();
    expect(storedBlur("data:image/webp,plain")).toBeNull();
    expect(storedBlur(uri(new Uint8Array(64), "image/webp"))).toBeNull();
  });
});
