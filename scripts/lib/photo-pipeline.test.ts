import { describe, expect, test } from "bun:test";

import { BLUR_WIDTH, PHOTO_LIMIT } from "../../lib/photos";
import type { Pass, Photo, Tour, Town } from "../../lib/types";
import type { Page } from "./hosts";
import {
  blurJob,
  borrowed,
  photosFor,
  placeJobs,
  RADIUS_M,
  runPhotos,
} from "./photo-pipeline";
import type { PhotoCurated, PhotoFlags, StoredPhotos } from "./photo-pipeline";
import type { Bytes, Transport } from "./transport";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FLAGS: PhotoFlags = { reblur: false, refresh: false };

const pass = (slug: string, name = slug): Pass => ({
  ascents: [],
  beauty: 3,
  classicAscent: "",
  country: "IT",
  difficulty: 3,
  elevation: 2000,
  fame: 3,
  lat: 46.5,
  lon: 11.8,
  name,
  note: "",
  region: "Dolomiten",
  season: null,
  slug,
  surface: "asphalt",
  traffic: 3,
  type: "pass",
});

const town = (slug: string, name = slug): Town => ({
  country: "IT",
  lat: 46.3,
  lon: 11.5,
  name,
  slug,
  tags: ["hub"],
  why: "",
});

const tour = (slug: string, passes: string[]): Tour => ({
  color: "#c2410c",
  description: "",
  elevationGain: 1000,
  km: 50,
  name: slug,
  note: "",
  passes,
  season: null,
  slug,
  surface: "asphalt",
  waypoints: [
    { lat: 46.5, lon: 11.8 },
    { lat: 46.4, lon: 11.7 },
  ],
});

/** A Commons page big enough and plain enough to be usable (`photo-rank.ts`). */
const page = (title: string, at = 1): Page => ({
  imageinfo: [
    {
      descriptionurl: `https://commons.wikimedia.org/wiki/File:${title}.jpg`,
      height: 1080,
      mime: "image/jpeg",
      thumburl: `https://upload.wikimedia.org/x/${title}.jpg/960px-${title}-${at}.jpg`,
      url: `https://upload.wikimedia.org/x/${title}-${at}.jpg`,
      width: 1920,
    },
  ],
  title: `File:${title}_${at}.jpg`,
});

const photo = (src: string, blur?: string): Photo => ({
  artist: "",
  height: 540,
  license: "CC BY-SA 4.0",
  page: "https://commons.wikimedia.org/wiki/File:X.jpg",
  src,
  title: "X",
  width: 960,
  ...(blur === undefined ? {} : { blur }),
});

/** A thumbnail URL `thumbUrl` can rewrite to another standard width. */
const THUMB = "https://upload.wikimedia.org/x/A.jpg/960px-A.jpg";

/**
 * A lossy WebP header of the given width – enough for `storedBlur` to read,
 * which is all the placeholder rules ever look at.
 */
const webp = (width: number): string => {
  const bytes = new Uint8Array(40);
  bytes.set(
    Array.from("RIFF", (c) => c.codePointAt(0) ?? 0),
    0,
  );
  bytes.set(
    Array.from("WEBP", (c) => c.codePointAt(0) ?? 0),
    8,
  );
  bytes.set(
    Array.from("VP8 ", (c) => c.codePointAt(0) ?? 0),
    12,
  );
  bytes.set([0x9d, 0x01, 0x2a], 23);
  new DataView(bytes.buffer).setUint16(26, width, true);
  return `data:image/webp;base64,${Buffer.from(bytes).toString("base64")}`;
};

/** The same, as the JPEG a placeholder written before the re-encoding step is. */
const jpeg = (width: number): string => {
  const bytes = new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    0x00,
    0x0b,
    Math.floor(width / 256),
    width % 256,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
    0xff,
    0xd9,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
  return `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;
};

/** A transport that answers nothing: every call is a failure of the test. */
const silent: Transport = {
  getBytes: (_host, url) => {
    throw new Error(`asked for ${url}`);
  },
  getJson: (_host, url) => {
    throw new Error(`asked for ${url}`);
  },
};

// ── The rules ────────────────────────────────────────────────────────────────

describe("placeJobs", () => {
  const curated: PhotoCurated = {
    passes: [pass("stelvio"), pass("gavia")],
    tours: [],
    towns: [town("bormio")],
  };
  const stored: StoredPhotos = { "pass:stelvio": [photo(THUMB)] };
  const keys = (flags: PhotoFlags, state = stored) =>
    placeJobs(curated, state, flags).map((j) => j.key);

  test("asks only about what has no photos yet", () => {
    expect(keys(FLAGS)).toEqual(["pass:gavia", "town:bormio"]);
  });

  test("--refresh asks about every place again", () => {
    expect(keys({ ...FLAGS, refresh: true })).toEqual([
      "pass:stelvio",
      "pass:gavia",
      "town:bormio",
    ]);
  });

  test("--only restricts it to matching slugs", () => {
    expect(keys({ ...FLAGS, only: "gav", refresh: true })).toEqual([
      "pass:gavia",
    ]);
  });

  test("--blur asks about none, whatever is missing", () => {
    expect(keys({ ...FLAGS, reblur: true, refresh: true })).toEqual([]);
  });

  test("a town is searched in a wider circle than a pass", () => {
    const radii = Object.fromEntries(
      placeJobs(curated, {}, FLAGS).map((j) => [j.key, j.radius]),
    );
    expect(radii["pass:gavia"]).toBe(RADIUS_M.pass);
    expect(radii["town:bormio"]).toBe(RADIUS_M.town);
    expect(RADIUS_M.town).toBeGreaterThan(RADIUS_M.pass);
  });
});

describe("photosFor", () => {
  const job = { key: "pass:x", lat: 46, lon: 11, name: "Passo", radius: 2000 };
  const asked: string[] = [];
  const ask = (nearby: Page[], byName: Page[] = []) => {
    asked.length = 0;
    return {
      byName: (name: string) => {
        asked.push(`name ${name}`);
        return Promise.resolve(byName);
      },
      nearby: (at: { lat: number; lon: number }, radius: number) => {
        asked.push(`nearby ${at.lat},${at.lon} ${radius}`);
        return Promise.resolve(nearby);
      },
    };
  };

  test("asks where the place is, in the radius its kind is given", async () => {
    await photosFor(job, ask([]));
    expect(asked[0]).toBe("nearby 46,11 2000");
  });

  test("and nothing else when the geosearch fills the strip", async () => {
    const full = Array.from({ length: PHOTO_LIMIT }, (_, i) =>
      page("Passo", i + 1),
    );
    const found = await photosFor(job, ask(full));
    expect(found).toHaveLength(PHOTO_LIMIT);
    expect(asked).toHaveLength(1);
  });

  test("falls back to the name search where the photos carry no coordinate", async () => {
    const found = await photosFor(
      job,
      ask([], [page("Passo", 1), page("Passo", 2)]),
    );
    expect(asked).toEqual(["nearby 46,11 2000", "name Passo"]);
    expect(found).toHaveLength(2);
  });

  test("but ranks what it finds by name below an equal hit found nearby", async () => {
    const found = await photosFor(
      job,
      ask([page("Blick", 1)], [page("Blick", 2)]),
    );
    // Two files a name search and a geosearch score identically: the one that
    // stands at the place wins, because a file that merely mentions it can
    // stand anywhere.
    expect(found.map((p) => p.src)).toEqual([
      "https://upload.wikimedia.org/x/Blick.jpg/960px-Blick-1.jpg",
      "https://upload.wikimedia.org/x/Blick.jpg/960px-Blick-2.jpg",
    ]);
  });
});

describe("borrowed", () => {
  const first = photo("a.jpg");
  const second = photo("b.jpg");
  const stored: StoredPhotos = {
    "pass:eins": [first, photo("a2.jpg")],
    "pass:zwei": [second],
  };

  test("a tour shows the leading photo of each of its passes, in riding order", () => {
    const next = borrowed(stored, [tour("runde", ["zwei", "eins"])], FLAGS);
    expect(next["tour:runde"]).toEqual([second, first]);
  });

  test("and no more than one strip holds", () => {
    const passes = Array.from({ length: PHOTO_LIMIT + 2 }, (_, i) => `p${i}`);
    const state = Object.fromEntries(
      passes.map((slug, i) => [`pass:${slug}`, [photo(`${i}.jpg`)]]),
    );
    expect(
      borrowed(state, [tour("lang", passes)], FLAGS)["tour:lang"],
    ).toHaveLength(PHOTO_LIMIT);
  });

  test("a tour whose passes have none keeps no entry at all", () => {
    const state = { "tour:leer": [first] };
    expect(borrowed(state, [tour("leer", ["ohne"])], FLAGS)).toEqual({});
  });

  test("--only leaves the tours it does not name alone", () => {
    const next = borrowed(stored, [tour("runde", ["eins"])], {
      ...FLAGS,
      only: "andere",
    });
    expect(next).toEqual(stored);
  });

  test("never writes into the photos it borrows", () => {
    borrowed(stored, [tour("runde", ["eins"])], FLAGS);
    expect(stored["pass:eins"]).toEqual([first, photo("a2.jpg")]);
  });
});

describe("blurJob", () => {
  test("leaves a WebP placeholder of the wanted width alone", () => {
    expect(blurJob(photo(THUMB, webp(BLUR_WIDTH)), false)).toBeNull();
  });

  test("re-encodes an older format from its own bytes, costing no request", () => {
    const job = blurJob(photo(THUMB, jpeg(BLUR_WIDTH)), false);
    expect(job?.act).toBe("recode");
    expect(job).toMatchObject({ type: "image/jpeg" });
  });

  test("fetches again where the stored placeholder is the wrong width", () => {
    // Too few pixels to become the right width, however it is re-encoded.
    expect(blurJob(photo(THUMB, webp(20)), false)).toEqual({
      act: "fetch",
      url: `https://upload.wikimedia.org/x/A.jpg/${BLUR_WIDTH}px-A.jpg`,
    });
  });

  test("fetches where there is none at all", () => {
    expect(blurJob(photo(THUMB), false)?.act).toBe("fetch");
  });

  test("--blur fetches even what is already right", () => {
    expect(blurJob(photo(THUMB, webp(BLUR_WIDTH)), true)?.act).toBe("fetch");
  });

  test("and asks for nothing where the URL cannot be rewritten", () => {
    // The original of a file smaller than the requested width: not a
    // thumbnail URL, so the panel falls back to its own surface.
    expect(
      blurJob(photo("https://upload.wikimedia.org/x/A.jpg"), true),
    ).toBeNull();
  });
});

// ── The run ──────────────────────────────────────────────────────────────────

/** Counts what a run decodes; `Bun.Image` is the only decoder in the pipeline. */
const decodes = async (run: () => Promise<unknown>): Promise<number> => {
  const real = Bun.Image;
  let n = 0;
  // Patched for the duration of one run: the only decoder in the pipeline.
  Bun.Image = class extends real {
    constructor(...args: ConstructorParameters<typeof real>) {
      n += 1;
      super(...args);
    }
  };
  try {
    await run();
  } finally {
    Bun.Image = real;
  }
  return n;
};

/** Every line a run printed, so a test can assert that none was a warning. */
const lines: string[] = [];

const run = (state: StoredPhotos, curated: PhotoCurated, transport = silent) =>
  runPhotos({
    curated,
    flags: FLAGS,
    log: () => {
      lines.push("log");
    },
    save: () => Promise.resolve(),
    state,
    transport,
    warn: (line) => {
      lines.push(`warn ${line}`);
    },
  });

describe("runPhotos", () => {
  const curated: PhotoCurated = {
    passes: [pass("stelvio")],
    tours: [tour("runde", ["stelvio"])],
    towns: [],
  };

  test("a run with nothing to do asks nothing and decodes nothing", async () => {
    const state: StoredPhotos = {
      "pass:stelvio": [photo(THUMB, webp(BLUR_WIDTH))],
      "tour:runde": [photo(THUMB, webp(BLUR_WIDTH))],
    };
    let report: Awaited<ReturnType<typeof runPhotos>> | null = null;
    const n = await decodes(async () => {
      report = await run(state, curated);
    });
    // The stored record says the placeholder is a WebP of the right width, so
    // nothing is opened to find out.
    expect(n).toBe(0);
    expect(report!.asked).toBe(0);
    expect(report!.photos).toEqual(state);
  });

  test("a placeholder is written into a new record, never into the stored one", async () => {
    const stored = photo(THUMB);
    const state: StoredPhotos = { "pass:stelvio": [stored] };
    const bytes: Bytes = {
      bytes: new Uint8Array(
        Buffer.from(webp(BLUR_WIDTH).split(",")[1]!, "base64"),
      ),
      type: "image/webp",
    };
    const { photos } = await run(state, curated, {
      ...silent,
      getBytes: () => Promise.resolve(bytes),
    });
    expect(photos["pass:stelvio"]?.[0]?.blur).toStartWith("data:image/webp;");
    // The object the caller handed in is the one it still has.
    expect(stored.blur).toBeUndefined();
    expect(state["pass:stelvio"]).toEqual([stored]);
  });

  test("and the tour borrows the photo the pass ended up with", async () => {
    const state: StoredPhotos = {
      "pass:stelvio": [photo(THUMB, webp(BLUR_WIDTH))],
    };
    const { photos } = await run(state, curated);
    expect(photos["tour:runde"]).toEqual(photos["pass:stelvio"] ?? []);
  });
});
