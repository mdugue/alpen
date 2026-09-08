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
      // The status picker is a dropdown with checkboxes inside the filter panel.
      await page.clickText("button", "Filter");
      await page.click('[aria-label="Status filtern"]');
      await page.clickText('[role="menuitemcheckbox"]', "oft gesperrt");
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
  "6 · the mobile sheet goes peek → list → detail → back",
  () =>
    withPage(app, "mobile-sheet", { mobile: true }, async (page) => {
      await page.waitFor("input[type=search]");
      await page.click('[aria-label="Liste ausklappen"]');
      await page.waitFor(PASS_ROW);
      await page.click(GALIBIER);
      await page.waitFor("#detail-title");
      expect(await page.text("#detail-title")).toBe("Col du Galibier");
      await page.clickText("button", "Liste");
      await page.waitForGone("#detail-title");
      await page.waitFor(PASS_ROW);
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
