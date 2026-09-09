import { describe, expect, test } from "bun:test";

import {
  best,
  fileName,
  fold,
  plain,
  rank,
  score,
  thumb,
  toPhoto,
  usable,
} from "./photo-rank";
import type { ImageInfo, Page } from "./photo-rank";

const CDN = "https://upload.wikimedia.org/wikipedia/commons";

const info = (over: Partial<ImageInfo> = {}): ImageInfo => ({
  descriptionurl: "https://commons.wikimedia.org/wiki/File:X.jpg",
  extmetadata: {
    Artist: { value: '<a href="/wiki/User:A">Anna Alp</a>' },
    LicenseShortName: { value: "CC BY-SA 4.0" },
    LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" },
  },
  height: 1200,
  mime: "image/jpeg",
  thumburl: `${CDN}/thumb/2/2d/X.jpg/960px-X.jpg`,
  url: `${CDN}/2/2d/X.jpg`,
  width: 1800,
  ...over,
});
const page = (title: string, over: Partial<ImageInfo> = {}): Page => ({
  imageinfo: [info(over)],
  title,
});

describe("plain", () => {
  test("strips the wiki HTML an attribution line arrives in", () => {
    expect(plain('<a href="/x">Anna Alp</a>\n')).toBe("Anna Alp");
    expect(plain("<p>A&nbsp;B</p>")).toBe("A B");
  });

  test("survives a field Commons did not fill in", () => {
    expect(plain()).toBe("");
  });

  test("caps a credit that is a whole paragraph", () => {
    expect(plain("x".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe("fileName / fold", () => {
  test("turns a Commons title into a readable caption", () => {
    expect(fileName("File:Col_du_Galibier_3.jpg")).toBe("Col du Galibier 3");
  });

  test("folds diacritics and punctuation away", () => {
    expect(fold("Col d'Izoard, Süd")).toBe("col d izoard sud");
  });
});

describe("usable", () => {
  test("keeps a large photograph", () => {
    expect(usable(page("File:Stelvio pass.jpg"), info())).toBe(true);
  });

  test("drops what is not a photograph, by name", () => {
    for (const title of [
      "File:Karte Stilfser Joch.jpg",
      "File:Passo dello Stelvio road sign.jpg",
      "File:Wappen Bormio.png",
      "File:Stelvio elevation profile.png",
    ])
      expect(usable(page(title), info())).toBe(false);
  });

  test("keeps a name that only contains a forbidden word", () => {
    // "Mapa" is out, "Mapelli" is not – the pattern matches whole words.
    expect(usable(page("File:Rifugio Mapelli.jpg"), info())).toBe(true);
  });

  test("drops files that are too small or not bitmaps", () => {
    expect(usable(page("File:X.jpg"), info({ width: 900 }))).toBe(false);
    expect(usable(page("File:X.jpg"), info({ height: 500 }))).toBe(false);
    expect(usable(page("File:X.svg"), info({ mime: "image/svg+xml" }))).toBe(
      false,
    );
  });

  test("drops a panorama a 16:9 crop would reduce to a stripe", () => {
    expect(usable(page("File:X.jpg"), info({ height: 700, width: 9000 }))).toBe(
      false,
    );
  });
});

describe("score", () => {
  test("prefers the file that names the place over the nearer one", () => {
    const named = score(
      page("File:Col du Galibier 3.jpg"),
      info(),
      "Col du Galibier",
      20,
    );
    const near = score(
      page("File:Marmot on a rock.jpg"),
      info(),
      "Col du Galibier",
      0,
    );
    expect(named).toBeGreaterThan(near);
  });

  test("prefers the earlier geosearch hit when neither is named", () => {
    const first = score(page("File:Some view.jpg"), info(), "Passo Gavia", 0);
    const last = score(page("File:Some view.jpg"), info(), "Passo Gavia", 40);
    expect(first).toBeGreaterThan(last);
  });

  test("prefers landscape over portrait at equal standing", () => {
    const wide = score(
      page("File:X.jpg"),
      info({ height: 1200, width: 1800 }),
      "X",
      0,
    );
    const tall = score(
      page("File:X.jpg"),
      info({ height: 1800, width: 1200 }),
      "X",
      0,
    );
    expect(wide).toBeGreaterThan(tall);
  });
});

describe("thumb", () => {
  test("reads the real width out of the URL Commons answered with", () => {
    expect(thumb(info())).toEqual({
      height: 640,
      src: `${CDN}/thumb/2/2d/X.jpg/960px-X.jpg`,
      width: 960,
    });
  });

  test("drops the tracking query the API appends", () => {
    const t = thumb(
      info({
        thumburl: `${CDN}/thumb/2/2d/X.jpg/960px-X.jpg?utm_source=commons`,
      }),
    );
    expect(t.src).not.toContain("?");
  });

  test("falls back to the original where no thumbnail was rendered", () => {
    const original = { ...info() };
    delete original.thumburl;
    expect(thumb(original)).toEqual({
      height: 1200,
      src: `${CDN}/2/2d/X.jpg`,
      width: 1800,
    });
  });
});

describe("toPhoto", () => {
  test("carries everything the licence obliges us to show", () => {
    const photo = toPhoto(page("File:Col du Galibier 3.jpg"), info());
    expect(photo).toMatchObject({
      artist: "Anna Alp",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      page: "https://commons.wikimedia.org/wiki/File:X.jpg",
      title: "Col du Galibier 3",
    });
  });

  test("never leaves a photo looking unlicensed", () => {
    const photo = toPhoto(page("File:X.jpg"), info({ extmetadata: {} }));
    expect(photo?.license).toBe("siehe Dateiseite");
    expect(photo?.licenseUrl).toBeUndefined();
    expect(photo?.artist).toBe("");
  });

  test("falls back to the credit line when no artist is named", () => {
    const photo = toPhoto(
      page("File:X.jpg"),
      info({ extmetadata: { Credit: { value: "<p>Eigenes Werk</p>" } } }),
    );
    expect(photo?.artist).toBe("Eigenes Werk");
  });
});

describe("rank / best", () => {
  const answer: Page[] = [
    page("File:Karte Passo Gavia.jpg"),
    page("File:Passo Gavia lake.jpg", {
      thumburl: `${CDN}/thumb/1/11/A.jpg/960px-A.jpg`,
      url: `${CDN}/1/11/A.jpg`,
    }),
    page("File:A cow.jpg", {
      thumburl: `${CDN}/thumb/3/33/B.jpg/960px-B.jpg`,
      url: `${CDN}/3/33/B.jpg`,
    }),
  ];

  test("skips what is not a view and keeps the order the score gives", () => {
    const ranked = rank(answer, "Passo Gavia");
    expect(ranked).toHaveLength(2);
    expect(best(ranked, 6).map((p) => p.title)).toEqual([
      "Passo Gavia lake",
      "A cow",
    ]);
  });

  test("keeps each file once, however often it was found", () => {
    const ranked = rank([...answer, ...answer], "Passo Gavia");
    expect(best(ranked, 6)).toHaveLength(2);
  });

  test("honours the limit", () => {
    expect(best(rank(answer, "Passo Gavia"), 1)).toHaveLength(1);
  });

  test("ignores a page the API returned without image info", () => {
    expect(rank([{ title: "File:X.jpg" }], "X")).toEqual([]);
  });
});
