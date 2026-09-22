import { describe, expect, test } from "bun:test";

import type { DetailAsset, DetailData } from "@/lib/detail-assets";
import {
  BAR_PX,
  detailState,
  heroShape,
  pastHead,
  profilesOf,
  shownPhotos,
} from "@/lib/detail-state";
import type { DetailState, Fetched, HeadBox } from "@/lib/detail-state";
import type { Photo } from "@/lib/types";

const asset = (photos: number): DetailAsset => ({
  photos,
  url: "/detail/pass-test.a1b2c3d4.json",
});

const photo = (src: string): Photo => ({
  artist: "Jemand",
  height: 720,
  license: "CC BY-SA 4.0",
  page: "https://commons.wikimedia.org/wiki/File:Test.jpg",
  src,
  title: "Test",
  width: 1280,
});

/** The three answers a fetch adapter can give, in the shape `useFetch` has. */
const pending: Fetched<DetailData> = {
  data: null,
  error: null,
  loading: true,
};
const failed: Fetched<DetailData> = {
  data: null,
  error: new Error("404"),
  loading: false,
};
const ready = (data: DetailData): Fetched<DetailData> => ({
  data,
  error: null,
  loading: false,
});

const PHOTOS = [photo("https://upload.example/a.jpg")];
const PROFILES = {
  "test:0": {
    avgGradient: 6,
    dist: [0, 10, 20],
    ele: [900, 1500, 2100],
    elevationGain: 1200,
    km: 20,
    maxKmGradient: 11,
    start: 900,
    top: 2100,
  },
};

describe("the detail file as one value", () => {
  test("an entity without a file asks for nothing", () => {
    expect(detailState(undefined, pending)).toEqual({ phase: "absent" });
    // Even an adapter that answers for a URL it was never given: with no
    // asset there is nothing to be on its way.
    expect(detailState(undefined, ready({ photos: PHOTOS }))).toEqual({
      phase: "absent",
    });
  });

  test("while it is on its way it carries the count the page knows", () => {
    expect(detailState(asset(3), pending)).toEqual({
      phase: "pending",
      photos: 3,
    });
  });

  test("a file that arrives carries its photos and profiles", () => {
    const state = detailState(
      asset(1),
      ready({ photos: PHOTOS, profiles: PROFILES }),
    );
    expect(state.phase).toBe("ready");
    expect(shownPhotos(state)).toEqual(PHOTOS);
    expect(profilesOf(state)).toEqual(PROFILES);
    // A tour or a town has no profiles; the block that draws them gets an
    // empty map rather than undefined.
    expect(profilesOf(detailState(asset(1), ready({ photos: [] })))).toEqual(
      {},
    );
  });

  test("a file that does not arrive is a failure, not a wait", () => {
    // The defect this value exists for: a 404 after a stale deploy used to
    // read as "still loading" forever.
    expect(detailState(asset(6), failed)).toEqual({ phase: "failed" });
    expect(shownPhotos(detailState(asset(6), failed))).toEqual([]);
    expect(profilesOf(detailState(asset(6), failed))).toEqual({});
    // An answer with neither an error nor a body is the same thing.
    expect(
      detailState(asset(6), { data: null, error: null, loading: false }),
    ).toEqual({ phase: "failed" });
  });

  test("a slide the browser could not load is dropped, the rest stay", () => {
    const photos = [
      photo("https://upload.example/a.jpg"),
      photo("https://upload.example/b.jpg"),
    ];
    const state = detailState(
      asset(2),
      ready({ photos }),
      new Set(["https://upload.example/a.jpg"]),
    );
    expect(shownPhotos(state)).toEqual([photos[1]!]);
  });
});

describe("the shape of the head", () => {
  const readyWith = (photos: Photo[], broken: string[] = []): DetailState =>
    detailState(asset(photos.length), ready({ photos }), new Set(broken));

  test("the head is a hero exactly where a picture can lie under it", () => {
    const rows: [string, DetailState, "hero" | "plain"][] = [
      ["no file at all", { phase: "absent" }, "plain"],
      // The count comes from the page, so the box is reserved in the first
      // frame rather than after the fetch.
      ["on its way, with photos", { phase: "pending", photos: 4 }, "hero"],
      ["on its way, without any", { phase: "pending", photos: 0 }, "plain"],
      ["arrived with photos", readyWith(PHOTOS), "hero"],
      [
        "arrived, every slide broken",
        readyWith(PHOTOS, [PHOTOS[0]!.src]),
        "plain",
      ],
      ["did not arrive", { phase: "failed" }, "plain"],
    ];
    for (const [what, state, shape] of rows)
      expect(heroShape(state), what).toBe(shape);
  });
});

/** A head of `height` px, `top` px down the scroller. */
const head = (height: number, top = 0): HeadBox => ({
  offsetHeight: height,
  offsetTop: top,
});

describe("when the head has scrolled under the control row", () => {
  test("the threshold is the head's foot, less the row's own height", () => {
    const tall = head(300);
    // A hero 6 px inside the panel: the head does not start at the top.
    const inset = head(300, 6);
    // Shorter than the bar, so the clamp is what decides – a plain title
    // block on a phone is not much taller than the row over it.
    const short = head(BAR_PX - 10);
    const rows: [string, number, HeadBox | null, boolean][] = [
      ["at the top", 0, tall, false],
      ["one short of the threshold", 300 - BAR_PX - 1, tall, false],
      ["exactly on it – still under the row", 300 - BAR_PX, tall, false],
      ["one past it", 300 - BAR_PX + 1, tall, true],
      ["well past it", 1000, tall, true],
      ["the head's own offset counts", 306 - BAR_PX, inset, false],
      ["and pushes the threshold out", 306 - BAR_PX + 1, inset, true],
      ["a head shorter than the bar: at the top", 0, short, false],
      ["…and one pixel down", 1, short, true],
      // Before the first paint there is nothing to measure, and a bar that
      // went solid at zero would open the panel looking scrolled.
      ["nothing measured yet", 0, null, false],
      ["nothing measured, but scrolled", 1, null, true],
    ];
    for (const [what, top, box, expected] of rows)
      expect(pastHead(top, box), what).toBe(expected);
  });
});
