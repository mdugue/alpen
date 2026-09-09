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
      expect(await page.count(PASS_ROW)).toBe(92);
      await page.waitFor("canvas.maplibregl-canvas");
      // The period control shows a half-month and its histogram.
      await page.waitForAttribute(
        SLIDER,
        "aria-valuetext",
        /^(?:Anfang|Ende) \w+: \d+ meist offen/u,
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
      await page.press("Escape");
      await page.waitForGone("#detail-title");
      expect(await page.activeRow()).toBe("pass:col-du-galibier");
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
  "4 · the status filter changes the counts and the reset link restores them",
  () =>
    // Early January, so all three statuses actually occur.
    withPage(app, "status-filter", { hash: "#t=1" }, async (page) => {
      await page.waitFor(PASS_ROW);
      const all = await page.count(PASS_ROW);
      // The status picker is a toggle group inside the filter panel: one chip
      // per status, no popup to open.
      await page.clickText("button", "Filter");
      await page.waitFor('[aria-label="Status filtern"]');
      await page.clickText(
        '[aria-label="Status filtern"] button',
        "oft gesperrt",
      );
      await waitUntil(
        async () => (await page.count(PASS_ROW)) < all,
        "fewer passes after filtering",
      );
      await page.clickText("button", "Filter zurücksetzen");
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
      await page.clickText("button", "Pass, Tour oder Ort");
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
