import { describe, expect, test } from "bun:test";

import { BLUR_MAX_BYTES, blurUri, strip } from "./blur";

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
  ...[...type].map((c) => c.codePointAt(0) ?? 0),
  ...payload,
  0,
  0,
  0,
  0,
];

describe("strip", () => {
  test("drops the application segments and the comment, keeps the picture", () => {
    const full = jpeg(APP2, DQT, COMMENT);
    const out = strip(full, "image/jpeg");
    expect(out).toEqual(jpeg(DQT));
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
  test("is the stripped picture as a data URI of its own type", () => {
    const uri = blurUri(jpeg(APP2, DQT), "image/jpeg");
    expect(uri).toStartWith("data:image/jpeg;base64,");
    expect(Buffer.from(uri?.split(",")[1] ?? "", "base64").length).toBe(
      jpeg(DQT).length,
    );
  });

  test("refuses what is still too big to carry after stripping", () => {
    const fat = segment(
      0xdb,
      Array.from({ length: BLUR_MAX_BYTES }, () => 1),
    );
    expect(blurUri(jpeg(fat), "image/jpeg")).toBeNull();
  });

  test("refuses an answer that is not an image at all", () => {
    expect(blurUri(jpeg(DQT), "text/html")).toBeNull();
  });
});
