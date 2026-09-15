/**
 * Turning a 20-px-wide Commons thumbnail into the data URI that `Photo.blur`
 * carries (`lib/photos.ts`).
 *
 * Wikimedia renders the placeholder; the only thing left to do is take out
 * what a 20-px image has no use for. The thumbnail of a wide-gamut photo
 * inherits its ICC profile, and that profile does not shrink with the picture:
 * one 20×9 JPEG in the data measures 30 750 bytes, of which 30 268 are an APP2
 * colour profile and 482 are the image. Stripped, it is the same 482 bytes as
 * every other placeholder. Dropping the profile means the browser reads the
 * blurred stand-in as sRGB, which can shift its colours slightly for the
 * fraction of a second it is on screen – against 40 KB in every detail file
 * that photo appears in, that is not a close call.
 *
 * Marker and chunk surgery only, no decoding: the pixels are not touched, so
 * nothing here can change what the placeholder looks like beyond that.
 *
 * Pure functions, no I/O – separate from `scripts/build-photos.ts` for the
 * same reason `photo-rank.ts` is: the script does the talking.
 */

/**
 * Above this a placeholder is not worth its place in the detail file. Nothing
 * that is genuinely 20 px wide comes near it; what does is a container that
 * carries something other than the picture, and dropping the placeholder is
 * better than shipping it – the panel then opens on its own surface, which is
 * what it did before there were placeholders.
 */
export const BLUR_MAX_BYTES = 2048;

const join = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/** Segments a 20-px rendering does not need: APP0–APP15 and the comment. */
const JPEG_DROPPED = (marker: number) =>
  (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;

/**
 * A JPEG without its application segments. Walks the marker list up to the
 * start of scan and copies what is not dropped; from `SOS` on the rest is
 * entropy-coded data and is taken as it is. Anything that does not parse as a
 * JPEG is returned unchanged rather than guessed at.
 */
const stripJpeg = (bytes: Uint8Array): Uint8Array => {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const keep: Uint8Array[] = [bytes.subarray(0, 2)];
  let i = 2;
  while (i < bytes.length - 3) {
    // Not where a marker should be: leave the file alone.
    if (bytes[i] !== 0xff) return bytes;
    const marker = bytes[i + 1] as number;
    // Padding (FF FF) and the standalone markers carry no length.
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      keep.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === 0xda) {
      keep.push(bytes.subarray(i));
      break;
    }
    const length = view.getUint16(i + 2);
    if (length < 2 || i + 2 + length > bytes.length) return bytes;
    if (!JPEG_DROPPED(marker)) keep.push(bytes.subarray(i, i + 2 + length));
    i += 2 + length;
  }
  return join(keep);
};

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** What a PNG needs to draw; every other chunk is metadata by definition. */
const PNG_KEPT = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS"]);

/**
 * A PNG without its ancillary chunks – the same idea as `stripJpeg`, and the
 * same fallback: a file that does not parse comes back untouched. Commons
 * serves a PNG thumbnail for a PNG source, so this is the other half of the
 * two formats `usable` in `photo-rank.ts` lets through.
 */
const stripPng = (bytes: Uint8Array): Uint8Array => {
  if (PNG_MAGIC.some((b, n) => bytes[n] !== b)) return bytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const keep: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  while (i + 8 <= bytes.length) {
    const length = view.getUint32(i);
    const end = i + 12 + length;
    if (end > bytes.length) return bytes;
    const type = String.fromCodePoint(...bytes.subarray(i + 4, i + 8));
    if (PNG_KEPT.has(type)) keep.push(bytes.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return join(keep);
};

/** The picture without its metadata, for the two formats Commons hands us. */
export const strip = (bytes: Uint8Array, type: string): Uint8Array => {
  if (type === "image/jpeg") return stripJpeg(bytes);
  if (type === "image/png") return stripPng(bytes);
  return bytes;
};

/**
 * The data URI for `Photo.blur`, or `null` where the rendering is too big to
 * be worth carrying. Never throws on odd input: a placeholder is cosmetic.
 */
export const blurUri = (bytes: Uint8Array, type: string): string | null => {
  if (!type.startsWith("image/")) return null;
  const small = strip(bytes, type);
  if (small.length > BLUR_MAX_BYTES) return null;
  return `data:${type};base64,${Buffer.from(small).toString("base64")}`;
};
