/**
 * Turning a 20-px-wide Commons thumbnail into the data URI that `Photo.blur`
 * carries (`lib/photos.ts`). Two steps, and the order is the point.
 *
 * **Strip.** Wikimedia renders the placeholder, but the thumbnail of a
 * wide-gamut photo inherits its ICC profile, and that profile does not shrink
 * with the picture: one 20×9 JPEG in the data measures 30 750 bytes, of which
 * 30 268 are an APP2 colour profile and 482 are the image. This has to happen
 * first, because re-encoding does not drop it – `Bun.Image` carries the
 * profile into the WebP and the monster comes out 30 420 bytes. Dropping it
 * means the browser reads the blurred stand-in as sRGB, which can shift its
 * colours slightly for the fraction of a second it is on screen; against 40 KB
 * in every detail file that photo appears in, that is not a close call.
 *
 * **Re-encode.** JPEG spends about 280 bytes on quantisation and Huffman
 * tables before it has described a single pixel, which is most of a 20-px
 * picture. WebP does not, and `Bun.Image` is in the runtime the build already
 * uses – so the placeholders cost ~150 bytes instead of ~510, with no image
 * library and no native dependency anywhere in the project.
 *
 * No I/O – separate from `scripts/build-photos.ts` for the same reason
 * `photo-rank.ts` is: the script does the talking.
 */

/**
 * Above this a placeholder is not worth its place in the detail file. Nothing
 * that is genuinely `BLUR_WIDTH` px wide comes near it – the widest measured
 * is around 600 bytes – and what does is a container carrying something other
 * than the picture. Dropping it is then better than shipping it: the panel
 * opens on its own surface, which is what it did before there were
 * placeholders. The bound is generous on purpose, so that a tall portrait,
 * whose 40-px width makes it hundreds of pixels high, is not refused for
 * being honestly large.
 */
export const BLUR_MAX_BYTES = 4096;

/**
 * Quality of the re-encoded placeholder. It is 20 px wide and about to be
 * upscaled twentyfold, so the artefacts a low number buys are smaller than the
 * blur they hide under; below 30 the file stops shrinking and only the colours
 * drift.
 */
export const BLUR_QUALITY = 30;

const join = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/**
 * Segments a 20-px rendering does not need: APP0–APP15 and the comment –
 * except APP14, which is fourteen bytes and is not metadata at all. It names
 * the colour transform of a CMYK or YCCK file, and a decoder that does not
 * find it reads such an image inverted. Commons thumbnails are three-channel
 * sRGB and carry none, so this keeps nothing in practice and rules out one
 * way of quietly wrecking a picture.
 */
const JPEG_DROPPED = (marker: number) =>
  (marker >= 0xe0 && marker <= 0xef && marker !== 0xee) || marker === 0xfe;

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
    const marker = bytes[i + 1]!;
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

/**
 * The pixel width of a placeholder that is already stored, or `null` when it
 * cannot be read. `Photo.blur` records no width of its own, so the picture is
 * asked – which makes a change to `BLUR_WIDTH` as incremental as a change of
 * format: the run skips what is already the width it wants and fetches the
 * rest, instead of refetching all 1 500 because one constant moved.
 */
export const blurWidth = async (uri: string): Promise<number | null> => {
  const [, body] = uri.split(",");
  if (!body) return null;
  try {
    const meta = await new Bun.Image(
      new Uint8Array(Buffer.from(body, "base64")),
    ).metadata();
    return meta.width ?? null;
  } catch {
    return null;
  }
};

/** The picture without its metadata, for the two formats Commons hands us. */
export const strip = (bytes: Uint8Array, type: string): Uint8Array => {
  if (type === "image/jpeg") return stripJpeg(bytes);
  if (type === "image/png") return stripPng(bytes);
  return bytes;
};

/**
 * The stripped picture as WebP, or as it came where this Bun cannot encode
 * one. `Bun.Image` landed during 1.4 and the placeholder is cosmetic, so a
 * runtime without it gets the JPEG rather than an error – both are valid
 * `Photo.blur` values and the panel cannot tell them apart.
 */
const encode = async (
  small: Uint8Array,
  type: string,
): Promise<{ bytes: Uint8Array; type: string }> => {
  try {
    const webp = await new Bun.Image(small)
      .webp({ quality: BLUR_QUALITY })
      .toBuffer();
    return { bytes: new Uint8Array(webp), type: "image/webp" };
  } catch {
    return { bytes: small, type };
  }
};

/**
 * The data URI for `Photo.blur`, or `null` where the rendering is too big to
 * be worth carrying. Never throws on odd input: a placeholder is cosmetic.
 */
export const blurUri = async (
  raw: Uint8Array,
  rawType: string,
): Promise<string | null> => {
  if (!rawType.startsWith("image/")) return null;
  const { bytes, type } = await encode(strip(raw, rawType), rawType);
  if (bytes.length > BLUR_MAX_BYTES) return null;
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
};
