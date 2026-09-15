/**
 * End-to-end scenarios from docs/plans/10-tests.md. They need a production
 * build (`bun run build`, with `NEXT_PUBLIC_TEST_HOOKS=1` for the camera
 * assertions) and a Chrome; `bun run e2e` does the rest.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";

import { startApp, waitUntil, withPage } from "@/test/browser";
import type { App } from "@/test/browser";

const TIMEOUT = 90_000;
let app: App;

beforeAll(async () => {
  app = await startApp();
});

afterAll(() => {
  app?.stop();
  Bun.WebView.closeAll();
});

const PASS_ROW = '[data-row^="pass:"]';
const GALIBIER = '[data-row="pass:col-du-galibier"]';
const SLIDER = '[aria-label="Zeitraum"]';

test(
  "1 · loads with all passes and a map canvas",
  () =>
    withPage(app, "loads", {}, async (page) => {
      await page.waitFor(PASS_ROW);
      expect(await page.count(PASS_ROW)).toBe(201);
      await page.waitFor("canvas.maplibregl-canvas");
      // The period control shows a half-month and its histogram.
      await page.waitForAttribute(
        SLIDER,
        "aria-valuetext",
        /^(?:Anfang|Ende) \w+: \d+ beste Zeit, \d+ gut/u,
      );
    }),
  TIMEOUT,
);

test(
  "2 · selecting a pass opens the detail panel, Escape returns focus to the row",
  () =>
    withPage(app, "select-pass", {}, async (page) => {
      await page.click(GALIBIER);
      await page.waitFor("#detail-title");
      expect(await page.text("#detail-title")).toBe("Col du Galibier");
      expect(await page.hash()).toContain("pass=col-du-galibier");
      // The profiles are not in the page: the panel fetches the selected
      // entity's file from `public/detail` (lib/detail-assets.ts). The title
      // is there immediately, the profile a request later.
      await page.waitFor('[aria-label^="Höhenprofil:"]');
      await page.press("Escape");
      await page.waitForGone("#detail-title");
      // The panel is gone on commit, the row is focused a frame later
      // (`back` in explorer.tsx); a single read in between sees the body.
      await waitUntil(
        async () => (await page.activeRow()) === "pass:col-du-galibier",
        "focus back on the row",
      );
      expect(await page.hash()).not.toContain("pass=");
    }),
  TIMEOUT,
);

test(
  "3 · a shared link restores selection, period and camera",
  () =>
    withPage(
      app,
      "shared-link",
      { hash: "#pass=col-du-galibier&t=6&z=9&c=45.06,6.41" },
      async (page) => {
        await page.waitFor("#detail-title");
        expect(await page.text("#detail-title")).toBe("Col du Galibier");
        await page.waitForAttribute(SLIDER, "aria-valuetext", "Anfang Juni");

        // The camera of a link without a selection is applied as it stands;
        // with a selection the map flies to it afterwards.
        await page.navigate("#t=6&z=9&c=45.06,6.41");
        await page.waitFor("canvas.maplibregl-canvas");
        const camera = await page.camera();
        // Only a build with NEXT_PUBLIC_TEST_HOOKS=1 exposes the map.
        if (camera) {
          expect(camera.zoom).toBeCloseTo(9, 1);
          expect(camera.lat).toBeCloseTo(45.06, 1);
          expect(camera.lon).toBeCloseTo(6.41, 1);
        }
      },
    ),
  TIMEOUT,
);

test(
  "4 · a status chip narrows the lists and the applied-filter chip undoes it",
  () =>
    // Early January: nothing is "gut", so the counts and the disabled chip bite.
    withPage(app, "status-filter", { hash: "#t=1" }, async (page) => {
      await page.waitFor(PASS_ROW);
      const all = await page.count(PASS_ROW);
      // The status picker is a row of chips inside the filter panel: no popup
      // to open, and pressing one narrows the list to it.
      await page.clickText("button", "Filter");
      await page.waitFor('[aria-labelledby="f-status"]');
      // Every chip carries how many roads it would leave, counted with its own
      // group's filter lifted. In early January that is zero for "gut", and a
      // chip that can only empty the list is disabled rather than pressable.
      expect(
        await page.evaluate<boolean>(
          `[...document.querySelectorAll('[aria-labelledby="f-status"] button')]
             .find((b) => b.textContent.startsWith("gut")).disabled`,
        ),
      ).toBe(true);
      await page.clickText(
        '[aria-labelledby="f-status"] button',
        "eingeschränkt",
      );
      await waitUntil(
        async () => (await page.count(PASS_ROW)) < all,
        "fewer passes after filtering",
      );
      // The chip row above the panel undoes exactly that decision again.
      await page.clickText(
        '[aria-label="Aktive Filter"] button',
        "eingeschränkt",
      );
      await waitUntil(
        async () => (await page.count(PASS_ROW)) === all,
        "all passes back after the reset",
      );
    }),
  TIMEOUT,
);

test(
  "5 · the search finds one pass",
  () =>
    withPage(app, "search", {}, async (page) => {
      await page.fill("input[type=search]", "galibier");
      await waitUntil(
        async () => (await page.count(PASS_ROW)) === 1,
        'one pass left for "galibier"',
      );
      expect(await page.text(GALIBIER)).toContain("Col du Galibier");
    }),
  TIMEOUT,
);

test(
  "6 · list and detail are separate sheets: peek → list → detail → back",
  () =>
    withPage(app, "mobile-sheet", { mobile: true }, async (page) => {
      // The peek row carries a button, not the field: the sheet opens first,
      // so the software keyboard never arrives while the sheet is moving.
      await page.waitFor('[aria-label="Liste ausklappen"]');
      expect(await page.count("input[type=search]")).toBe(0);
      // The peek row rides in with the sheet, so a tap in its first frames can
      // land beside the button or before React has attached its handler. Tap
      // again until the field has taken the button's place.
      await waitUntil(async () => {
        if ((await page.count("input[type=search]")) > 0) return true;
        await page.clickText("button", "Pass, Tour oder Ort");
        await Bun.sleep(300);
        return (await page.count("input[type=search]")) > 0;
      }, "the list sheet to open");
      await page.waitFor("input[type=search]");
      await page.waitFor(PASS_ROW);
      const all = await page.count(PASS_ROW);
      await page.click(GALIBIER);
      await page.waitFor("#detail-title");
      expect(await page.text("#detail-title")).toBe("Col du Galibier");
      // The list sheet stays on screen behind the detail sheet, so its rows
      // are still in the document while the detail is open.
      expect(await page.count(PASS_ROW)).toBe(all);
      await page.click('[aria-label="Details schließen"]');
      await page.waitForGone("#detail-title");
      await page.waitFor(PASS_ROW);
      expect(await page.hash()).not.toContain("pass=");
    }),
  TIMEOUT,
);

test(
  "7 · a row can be opened and closed with the keyboard alone",
  () =>
    withPage(app, "keyboard", {}, async (page) => {
      await page.focus(GALIBIER);
      await page.press("Enter");
      await page.waitFor("#detail-title");
      await page.press("Escape");
      await page.waitForGone("#detail-title");
    }),
  TIMEOUT,
);

test(
  "8 · the period scrubber steps, is keyboard operable and is remembered",
  () =>
    withPage(app, "period-scrubber", {}, async (page) => {
      await page.waitFor(SLIDER);
      const before = Number(await page.attribute(SLIDER, "aria-valuenow"));
      await page.click('[aria-label="Späterer Halbmonat"]');
      await page.waitForAttribute(SLIDER, "aria-valuenow", String(before + 1));

      await page.focus(SLIDER);
      await page.press("ArrowRight");
      await page.waitForAttribute(SLIDER, "aria-valuenow", String(before + 2));
      const chosen = (await page.attribute(SLIDER, "aria-valuetext"))!;

      // The choice survives a reload with no hash …
      await page.navigate();
      await page.waitForAttribute(SLIDER, "aria-valuetext", chosen);

      // … and someone else's link neither shows nor overwrites it.
      await page.navigate("#t=7");
      await page.waitForAttribute(SLIDER, "aria-valuetext", "Anfang Juli");
      await page.navigate();
      await page.waitForAttribute(SLIDER, "aria-valuetext", chosen);
    }),
  TIMEOUT,
);

test(
  "9 · a shared tour link fits the tour bounds; the lines come as static GeoJSON",
  () =>
    withPage(
      app,
      "tour-bounds",
      { hash: "#tour=la-marmotte" },
      async (page) => {
        await page.waitFor("#detail-title");
        expect(await page.text("#detail-title")).toBe("La Marmotte");
        // Only a build with NEXT_PUBLIC_TEST_HOOKS=1 exposes the map.
        if (!(await page.camera())) return;
        // The bounds are precomputed per tour (lib/map-assets.ts), not read from
        // the line, so the camera lands on the tour before its geometry arrives.
        // The camera flies in from the Alps overview, so it has to have
        // arrived before its centre says anything: half way through the flight
        // it is still east of the tour.
        await waitUntil(async () => {
          const c = await page.camera();
          return !!c && c.zoom > 8 && !c.moving;
        }, "camera fitted to the tour");
        const c = (await page.camera())!;
        expect(c.lat).toBeGreaterThan(45.03);
        expect(c.lat).toBeLessThan(45.36);
        expect(c.lon).toBeGreaterThan(5.99);
        expect(c.lon).toBeLessThan(6.48);
        // Tour and ascent lines were fetched from public/map and tiled.
        await waitUntil(
          () =>
            page.evaluate<boolean>(
              `(() => { const m = window.__alpen?.map; if (!m) return false;
              const tour = m.querySourceFeatures("tours", { filter: ["==", ["get", "slug"], "la-marmotte"] });
              return tour.length > 0 && m.querySourceFeatures("routes").length > 0; })()`,
            ),
          "tour and ascent geometry loaded from GeoJSON",
        );
      },
    ),
  TIMEOUT,
);

/**
 * The map's hit areas: what is drawn is a few pixels wide, what answers the
 * pointer is the transparent layer over it – and the name next to a mark
 * counts as part of the mark.
 */
const HIT_POINTS = `(() => {
  const m = window.__alpen?.map;
  if (!m) return null;
  const feature = m
    .queryRenderedFeatures({ layers: ["passes-hit"] })
    .find((f) => f.properties.slug === "col-du-galibier");
  if (!feature) return null;
  const c = m.project(feature.geometry.coordinates);
  const labels = ["pass-label-5", "pass-label-4", "pass-label-3"]
    .filter((id) => m.getLayer(id));
  // A point that only the name answers: on the label, clear of every mark.
  const onlyLabel = (x, y) =>
    m.queryRenderedFeatures([x, y], { layers: labels })
      .some((f) => f.properties.slug === "col-du-galibier") &&
    m.queryRenderedFeatures([x, y], { layers: ["passes-hit", "towns-hit"] })
      .length === 0;
  let label = null;
  for (let d = 16; d <= 200 && !label; d += 4)
    for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]])
      if (!label && onlyLabel(c.x + dx, c.y + dy))
        label = { x: c.x + dx, y: c.y + dy };
  return { dot: { x: c.x, y: c.y }, label, moving: m.isMoving() };
})()`;

test(
  "10 · a pass answers beside its dot and on its name",
  () =>
    // A camera, no selection: nothing floats over the map and nothing flies.
    withPage(
      app,
      "map-hit-areas",
      { hash: "#z=12&c=45.064,6.408" },
      async (page) => {
        type Points = {
          dot: { x: number; y: number };
          label: { x: number; y: number } | null;
          moving: boolean;
        } | null;
        const points = async () => {
          let p: Points = null;
          await waitUntil(async () => {
            p = await page.evaluate<Points>(HIT_POINTS);
            return !!p && !p.moving && !!p.label;
          }, "the Galibier drawn with its name, on a map at rest");
          return p!;
        };

        // Beside the dot: the drawn circle ends at 13 px, the hit area at 19.
        const beside = await points();
        await page.clickAt(beside.dot.x + 16, beside.dot.y);
        await page.waitFor("#detail-title");
        expect(await page.text("#detail-title")).toBe("Col du Galibier");

        // And on the name, which is a target of its own.
        await page.press("Escape");
        await page.waitForGone("#detail-title");
        const named = await points();
        await page.clickAt(named.label!.x, named.label!.y);
        await page.waitFor("#detail-title");
        expect(await page.text("#detail-title")).toBe("Col du Galibier");
      },
    ),
  TIMEOUT,
);

/**
 * A double click is MapLibre's zoom gesture. Its two halves reach the map as
 * ordinary clicks, so without the double-click window in `pass-map.tsx` the
 * first of them would open whatever it happened to land on while the camera
 * zooms away from it.
 */
const DOUBLE_CLICK = (x: number, y: number) => `(() => {
  const el = document.querySelector("canvas.maplibregl-canvas");
  const opts = (detail) => ({
    bubbles: true, button: 0, cancelable: true,
    clientX: ${x}, clientY: ${y}, detail, view: window,
  });
  for (const detail of [1, 2])
    for (const type of ["mousedown", "mouseup", "click"])
      el.dispatchEvent(new MouseEvent(type, opts(detail)));
  el.dispatchEvent(new MouseEvent("dblclick", opts(2)));
  return true;
})()`;

/** The Galibier's dot in page pixels, on a map at rest. */
const PASS_DOT = `(() => {
  const m = window.__alpen?.map;
  if (!m || m.isMoving()) return null;
  const feature = m
    .queryRenderedFeatures({ layers: ["passes-hit"] })
    .find((f) => f.properties.slug === "col-du-galibier");
  if (!feature) return null;
  const c = m.project(feature.geometry.coordinates);
  return { x: Math.round(c.x), y: Math.round(c.y), zoom: m.getZoom() };
})()`;

test(
  "11 · a double click on the map zooms and opens nothing",
  () =>
    withPage(
      app,
      "map-double-click",
      { hash: "#z=12&c=45.064,6.408" },
      async (page) => {
        type Dot = { x: number; y: number; zoom: number } | null;
        const dot = async () => {
          let d: Dot = null;
          await waitUntil(async () => {
            d = await page.evaluate<Dot>(PASS_DOT);
            return !!d;
          }, "the Galibier drawn, on a map at rest");
          return d!;
        };

        // Straight onto the dot – the worst case, since a single click there
        // is a selection.
        const target = await dot();
        await page.evaluate(DOUBLE_CLICK(target.x, target.y));
        await waitUntil(
          async () =>
            (await page.evaluate<number>("window.__alpen.map.getZoom()")) >
            target.zoom + 0.5,
          "the camera zoomed in",
        );
        // Well past the window a single click waits out.
        await Bun.sleep(1000);
        expect(await page.count("#detail-title")).toBe(0);
        expect(await page.hash()).not.toContain("pass=");

        // A single click on the same dot still selects.
        const again = await dot();
        await page.clickAt(again.x, again.y);
        await page.waitFor("#detail-title");
        expect(await page.text("#detail-title")).toBe("Col du Galibier");
      },
    ),
  TIMEOUT,
);

/**
 * The map's bottom padding on every camera frame. `setPadding` is a `jumpTo`,
 * so its very first frame already carries the final value; a flight that
 * re-pads while it moves starts where the camera stood.
 */
const RECORD_PADDING = `(() => {
  const m = window.__alpen?.map;
  if (!m) return false;
  window.__pad = [];
  m.on("move", () => window.__pad.push(m.getPadding().bottom));
  return true;
})()`;

test(
  "12 · the detail sheet re-pads the map along its flight, not in one frame",
  () =>
    // A tap on the map itself, with the list sheet on its peek row: the case
    // the padding jumped in, because the sheet in front of the map goes from
    // 80 px to more than half the screen in that one moment.
    withPage(
      app,
      "mobile-camera-padding",
      { hash: "#z=12&c=45.064,6.408", mobile: true },
      async (page) => {
        // The map hook is set where the map is built, so the canvas is what
        // says it should be there by now; only a build with
        // NEXT_PUBLIC_TEST_HOOKS=1 actually sets one.
        await page.waitFor("canvas.maplibregl-canvas");
        if (!(await page.camera())) return;
        type Dot = { x: number; y: number; zoom: number } | null;
        let dot: Dot = null;
        await waitUntil(async () => {
          dot = await page.evaluate<Dot>(PASS_DOT);
          return !!dot;
        }, "the Galibier drawn, on a map at rest");

        expect(await page.evaluate<boolean>(RECORD_PADDING)).toBe(true);
        const before = await page.evaluate<number>(
          "window.__alpen.map.getPadding().bottom",
        );
        await page.clickAt(dot!.x, dot!.y);
        await page.waitFor("#detail-title");
        await waitUntil(async () => {
          const c = await page.camera();
          return !!c && !c.moving;
        }, "the camera settled on the pass");

        const pad = await page.evaluate<number[]>("window.__pad");
        const after = pad.at(-1)!;
        // The sheet in front of the map did take more than half the screen …
        expect(after - before).toBeGreaterThan(100);
        // … and the camera answered over the whole flight rather than in one
        // frame: the first of its frames still stands where the camera stood.
        expect(pad.length).toBeGreaterThan(5);
        expect(Math.abs(pad[0]! - before)).toBeLessThan((after - before) / 2);
      },
    ),
  TIMEOUT,
);

/**
 * Whether the detail panel is in the document at the moment the camera lands.
 * The panel shows the selection the camera has *arrived* at (`selectionState`
 * in explorer.tsx), so at `moveend` there is none yet, and it appears – whole,
 * with its photo and its profiles – in one of the commits after.
 */
const AT_MOVEEND = `(() => {
  const m = window.__alpen?.map;
  if (!m) return false;
  window.__atMoveend = [];
  m.on("moveend", () =>
    window.__atMoveend.push(!!document.querySelector("#detail-title")),
  );
  return true;
})()`;

test(
  "13 · the detail panel appears when the camera arrives, not while it flies",
  () =>
    // A camera far from the target, so the flight is a long one.
    withPage(
      app,
      "detail-on-arrival",
      { hash: "#z=8&c=47.4,13.2", mobile: true },
      async (page) => {
        await page.waitFor("canvas.maplibregl-canvas");
        if (!(await page.camera())) return;
        const settled = async () => {
          const c = await page.camera();
          return !!c && !c.moving;
        };
        await waitUntil(async () => {
          if ((await page.count("input[type=search]")) > 0) return true;
          await page.clickText("button", "Pass, Tour oder Ort");
          await Bun.sleep(300);
          return (await page.count("input[type=search]")) > 0;
        }, "the list sheet to open");
        await page.waitFor(GALIBIER);
        await waitUntil(settled, "the camera at rest");

        expect(await page.evaluate<boolean>(AT_MOVEEND)).toBe(true);
        await page.click(GALIBIER);
        // The tap is answered at once on the map and in the hash …
        await waitUntil(
          () => page.hash().then((h) => h.includes("pass=col-du-galibier")),
          "the selection in the hash",
        );
        // … and the panel follows when the camera has landed, with the photo
        // and the profile already in it rather than filling in afterwards.
        await page.waitFor("#detail-title");
        expect(await page.text("#detail-title")).toBe("Col du Galibier");
        await page.waitFor('[aria-label^="Höhenprofil:"]');
        await waitUntil(settled, "the camera settled");

        const atMoveend = await page.evaluate<boolean[]>("window.__atMoveend");
        // The flight happened …
        expect(atMoveend.length).toBeGreaterThan(0);
        // … and the panel was not on screen during any of it.
        expect(atMoveend).toEqual(atMoveend.map(() => false));
      },
    ),
  TIMEOUT,
);
