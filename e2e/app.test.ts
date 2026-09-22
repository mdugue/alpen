/**
 * End-to-end scenarios from docs/plans/10-tests.md. They need a production
 * build (`bun run build`, with `NEXT_PUBLIC_TEST_HOOKS=1` for the camera
 * assertions) and a Chrome; `bun run e2e` does the rest.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";

import routesJson from "@/data/generated/routes.json" with { type: "json" };
import passes from "@/data/passes.json" with { type: "json" };
import toursJson from "@/data/tours.json" with { type: "json" };
import { mapAssets } from "@/lib/map-assets";
import type { Bounds } from "@/lib/map-assets";
import { HIT_LAYERS, LAYERS, OVERLAY } from "@/lib/map-layers";
import * as S from "@/lib/schema";
import { startApp, waitUntil, withPage } from "@/test/browser";
import type { App } from "@/test/browser";

const TIMEOUT = 90_000;
let app: App;

/**
 * The boxes a selection is framed into, worked out the way `lib/data.ts` works
 * them out – so what the suite measures the camera against is the app's own
 * arithmetic over the app's own data, not a number copied into a test.
 */
const { passBounds } = mapAssets(
  S.Passes.parse(passes),
  S.Tours.parse(toursJson),
  S.Routes.parse(routesJson),
).assets;

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
const DETAIL_PANEL = 'section[aria-labelledby="detail-title"]';
const BACK_TO_LIST = '[aria-label="Zurück zur Liste"]';
/** A drawer with another one open on top of it – Base UI's own stack state. */
const STACKED = "[data-slot=drawer-popup][data-nested-drawer-open]";
/**
 * The detail panel's scroll container, and whether the title is on screen.
 * Both answers come from one evaluation, because the sheet is animating and
 * two reads a moment apart would describe two different snap points.
 */
const DETAIL_SCROLL = `(() => {
  const title = document.querySelector("#detail-title");
  const box = title?.closest("section")
    ?.querySelector('div[class*="overscroll-contain"]');
  if (!box) return null;
  const rect = title.getBoundingClientRect();
  return JSON.stringify({
    overflow: getComputedStyle(box).overflowY,
    scrollTop: box.scrollTop,
    scrollable: box.scrollHeight - box.clientHeight > 0,
    titleOnScreen: rect.top >= 0 && rect.bottom <= innerHeight,
  });
})()`;

interface DetailScroll {
  overflow: string;
  scrollTop: number;
  scrollable: boolean;
  titleOnScreen: boolean;
}

const detailScroll = async (page: {
  evaluate: <T>(js: string) => Promise<T>;
}): Promise<DetailScroll> =>
  JSON.parse(await page.evaluate<string>(DETAIL_SCROLL)) as DetailScroll;

test(
  "1 · loads with all passes and a map canvas",
  () =>
    withPage(app, "loads", {}, async (page) => {
      await page.waitFor(PASS_ROW);
      // Every road in the file is a row: the count comes from the data, so a
      // curation PR does not have to touch this test.
      expect(await page.count(PASS_ROW)).toBe(passes.length);
      await page.waitFor("canvas.maplibregl-canvas");
      // The season band shows a half-month, what most passes are in it and
      // the counts behind that.
      await page.waitForAttribute(
        SLIDER,
        "aria-valuetext",
        /^(?:Anfang|Ende) \w+: .+\. \d+ beste Zeit, \d+ gut/u,
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
        await page.waitForAttribute(SLIDER, "aria-valuetext", /^Anfang Juni:/u);

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
  "6 · nothing covers the map until it is asked for; list and detail stack",
  () =>
    withPage(app, "mobile-sheet", { mobile: true }, async (page) => {
      // At rest the map is the page: no drawer, no peek, no swipe handle –
      // only a floating button over the map's corner, which says what it
      // opens rather than posing as a search field (the keyboard would
      // otherwise arrive while the drawer is still moving).
      await page.waitFor("canvas.maplibregl-canvas");
      expect(await page.count('[aria-label*="klappen"]')).toBe(0);
      expect(await page.count("input[type=search]")).toBe(0);

      // Tapping a road opens the detail drawer on its own – there is no list
      // underneath it, so it closes rather than going back.
      await page.navigate("#pass=col-du-galibier");
      await page.waitFor("#detail-title");
      expect(await page.text("#detail-title")).toBe("Col du Galibier");
      expect(await page.count('[aria-label*="klappen"]')).toBe(1);
      expect(await page.count('[aria-label="Details schließen"]')).toBe(1);
      // Nothing behind it, so it is nobody's drawer: no stack.
      expect(await page.count(STACKED)).toBe(0);
      await page.waitInViewport('[aria-label="Details schließen"]');
      await page.click('[aria-label="Details schließen"]');
      await page.waitForGone("#detail-title");

      // The season bar's list button opens the list drawer. It rides in with
      // its own animation, so a tap in its first frames can land before React
      // has attached the handler; tap again until the field is there.
      await waitUntil(async () => {
        if ((await page.count("input[type=search]")) > 0) return true;
        await page.clickText("button", "Straßen");
        await Bun.sleep(300);
        return (await page.count("input[type=search]")) > 0;
      }, "the list drawer to open");
      await page.waitFor(PASS_ROW);
      const all = await page.count(PASS_ROW);

      // A row opens a second drawer over the first. Both are mounted, so
      // there are two swipe handles, and the list keeps its rows – and with
      // them its scroll position, its tab and its search.
      await page.click(GALIBIER);
      await page.waitFor("#detail-title");
      expect(await page.count('[aria-label*="klappen"]')).toBe(2);
      expect(await page.count(PASS_ROW)).toBe(all);
      // Opened from a row, the detail is a drawer *on* the list: the one
      // behind scales back and peeks above it rather than being covered flat.
      await waitUntil(
        async () => (await page.count(STACKED)) === 1,
        "the list drawer stacked behind the detail",
      );
      // Leaving a detail that has a list behind it means going back to it,
      // and the control says so instead of offering a close cross.
      expect(await page.count('[aria-label="Details schließen"]')).toBe(0);
      // The drawer slides in, so its header is still off the bottom of the
      // viewport for the first frames and a click aimed at it would land on
      // nothing at all.
      await page.waitInViewport(BACK_TO_LIST);
      await page.click(BACK_TO_LIST);
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
  "8 · the season band steps, is keyboard operable and is remembered",
  () =>
    withPage(app, "season-band", {}, async (page) => {
      await page.waitFor(SLIDER);
      const before = Number(await page.attribute(SLIDER, "aria-valuenow"));
      // The band has no stepper buttons: it is one slider, and the arrow keys
      // are the whole keyboard interface.
      await page.focus(SLIDER);
      await page.press("ArrowRight");
      await page.waitForAttribute(SLIDER, "aria-valuenow", String(before + 1));
      await page.press("ArrowRight");
      await page.waitForAttribute(SLIDER, "aria-valuenow", String(before + 2));
      const chosen = (await page.attribute(SLIDER, "aria-valuetext"))!;

      // The choice survives a reload with no hash …
      await page.navigate();
      await page.waitForAttribute(SLIDER, "aria-valuetext", chosen);

      // … and someone else's link neither shows nor overwrites it.
      await page.navigate("#t=7");
      await page.waitForAttribute(SLIDER, "aria-valuetext", /^Anfang Juli:/u);
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
 * pointer is the transparent layer over it.
 *
 * The ids come from the one table the style is built from
 * (`LAYERS`, lib/map-layers.ts), so a layer renamed on one side and not the
 * other fails here rather than silently going quiet – which is also why the
 * whole table is checked against the running map: a fame level added to the
 * label ladder has to answer the pointer too.
 */
const HIT_POINTS = `(() => {
  const m = window.__alpen?.map;
  if (!m) return null;
  const feature = m
    .queryRenderedFeatures({ layers: [${JSON.stringify(LAYERS.pass.hit)}] })
    .find((f) => f.properties.slug === "col-du-galibier");
  if (!feature) return null;
  const c = m.project(feature.geometry.coordinates);
  // Beside the dot: the drawn circle ends at about 14 px, the hit area at 19.
  const beside = [c.x + 16, c.y];
  const answers = (layer) =>
    m.queryRenderedFeatures(beside, { layers: [layer] })
      .some((f) => f.properties.slug === "col-du-galibier");
  return {
    dot: { x: c.x, y: c.y },
    missing: ${JSON.stringify(HIT_LAYERS)}.filter((id) => !m.getLayer(id)),
    drawn: answers(${JSON.stringify(LAYERS.pass.mark)}),
    hit: answers(${JSON.stringify(LAYERS.pass.hit)}),
    moving: m.isMoving(),
  };
})()`;

test(
  "10 · a pass answers beside its dot, where nothing is drawn",
  () =>
    // A camera, no selection: nothing floats over the map and nothing flies.
    withPage(
      app,
      "map-hit-areas",
      { hash: "#z=12&c=45.064,6.408" },
      async (page) => {
        type Points = {
          dot: { x: number; y: number };
          missing: string[];
          drawn: boolean;
          hit: boolean;
          moving: boolean;
        } | null;
        let p: Points = null;
        await waitUntil(async () => {
          p = await page.evaluate<Points>(HIT_POINTS);
          return !!p && !p.moving;
        }, "the Galibier drawn, on a map at rest");
        const points = p!;

        // Every layer the pick queries is in the style under that name.
        expect(points.missing).toEqual([]);
        // 16 px beside the summit the dot itself answers nothing …
        expect(points.drawn).toBe(false);
        // … its hit area does, and a click there opens the pass.
        expect(points.hit).toBe(true);
        await page.clickAt(points.dot.x + 16, points.dot.y);
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
 * How often one selection rewrites the address bar, and where the camera and
 * the sheet end up.
 *
 * What the padding does on the way there is the camera machine's business and
 * is pinned by its traces (`camera` in lib/map-camera.ts): that the first
 * padding is the only one set outright, that a selection's flight carries the
 * sheet's share rather than jumping to it, and that the hash is written once
 * when the camera settles. What no unit test can say is whether the app is
 * wired to that machine at all, which is what is left here.
 */
const RECORD_HASH = `(() => {
  if (!window.__alpen?.map) return false;
  window.__writes = [];
  const replaceState = history.replaceState.bind(history);
  history.replaceState = (...args) => {
    window.__writes.push(String(args[2]).replace(/^[^#]*/u, ""));
    return replaceState(...args);
  };
  return true;
})()`;

/**
 * The state scenario 12 is about, asked in one go: the sheet's padding on a map
 * that has stopped moving, with the address bar carrying the very centre the
 * map is on. Returns the recorded writes, or `null` while any of it is still
 * on its way.
 */
const SETTLED = (before: number) => `(() => {
  const m = window.__alpen.map;
  if (m.isMoving() || m.getPadding().bottom <= ${before + 100}) return null;
  const c = m.getCenter();
  const hash = location.hash;
  if (!hash.includes("c=" + c.lat.toFixed(4) + "," + c.lng.toFixed(4)))
    return null;
  if (!hash.includes("pass=col-du-galibier")) return null;
  return JSON.stringify(window.__writes);
})()`;

test(
  "12 · a tap on the map re-pads for the sheet and writes the hash twice",
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

        expect(await page.evaluate<boolean>(RECORD_HASH)).toBe(true);
        const before = await page.evaluate<number>(
          "window.__alpen.map.getPadding().bottom",
        );
        await page.clickAt(dot!.x, dot!.y);
        await page.waitFor("#detail-title");
        // The settled state, in one evaluation, because every half of it is
        // true on its own at some point in between: the camera leaves the panel
        // the first frames to itself, so one that has yet to set off reads
        // exactly like one that has arrived (`SELECT_DELAY`, lib/map-camera.ts);
        // the padding only grows once the flight carries it; and between a
        // flight landing and the padding it could not carry easing in, the map
        // stands still with the address bar a camera behind. What is waited for
        // is all three at once – the sheet's more than half the screen, a map
        // that has stopped, and a hash that carries the centre the map is
        // actually on – which is the state this scenario is about.
        let recorded = "";
        await waitUntil(async () => {
          const writes = await page.evaluate<string | null>(SETTLED(before));
          if (writes) recorded = writes;
          return writes !== null;
        }, "the sheet's padding carried, the camera at rest and in the hash");
        // Two hashes: the selection, and the camera it settles at. Distinct
        // ones rather than calls, because Next's router echoes every
        // `replaceState` with the path in front of the same hash – and it is
        // the camera positions that used to pile up, one per frame the flight
        // came to rest on.
        const writes = JSON.parse(recorded) as string[];
        expect(new Set(writes).size).toBe(2);
        expect(writes.at(-1)).toContain("pass=col-du-galibier");
      },
    ),
  TIMEOUT,
);

/**
 * Whether the detail panel is in the document while the camera crosses the
 * Alps. The panel opens with the tap and the flight follows it (the `select`
 * case of `reduce`, lib/app-state.ts), so it is on screen for every frame of
 * that flight – where the old order had it appear only once the camera landed.
 *
 * Frames are counted from where the camera *is*, not from a `movestart`: the
 * map moves for other reasons too – a phone's viewport height settling a few
 * pixels re-pads it, which is a camera move of its own – and only the flight
 * takes the centre half a degree from where it began.
 */
const RECORD_FLIGHT = `(() => {
  const m = window.__alpen?.map;
  if (!m) return false;
  window.__flight = [];
  const from = m.getCenter();
  m.on("move", () => {
    const c = m.getCenter();
    if (Math.abs(c.lng - from.lng) + Math.abs(c.lat - from.lat) > 0.5)
      window.__flight.push(!!document.querySelector("#detail-title"));
  });
  return true;
})()`;

test(
  "13 · the detail panel is up before the camera sets off",
  () =>
    // A camera far from the target, so the flight is a long one.
    withPage(
      app,
      "detail-before-flight",
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
          await page.clickText("button", "Straßen");
          await Bun.sleep(300);
          return (await page.count("input[type=search]")) > 0;
        }, "the list sheet to open");
        await page.waitFor(GALIBIER);
        await waitUntil(settled, "the camera at rest");

        expect(await page.evaluate<boolean>(RECORD_FLIGHT)).toBe(true);
        await page.click(GALIBIER);
        // The tap is answered at once – in the hash, and by the panel …
        await waitUntil(
          () => page.hash().then((h) => h.includes("pass=col-du-galibier")),
          "the selection in the hash",
        );
        await page.waitFor("#detail-title");
        expect(await page.text("#detail-title")).toBe("Col du Galibier");
        // … and the camera is the slow half: it sets off once the panel is
        // there. Only that it sets off is waited for, not that it arrives:
        // where it arrives is scenario 14, and how long a flight across the
        // Alps takes over a software GL context is the runner's business
        // rather than the app's – measured on one machine at three CPU speeds
        // it landed after 2.6 s, 7.6 s and anywhere between 4.5 s and 17.3 s,
        // which is what used to make this the one wait in the suite with a
        // timeout of its own.
        await waitUntil(
          () => page.evaluate<boolean>("window.__flight.length > 0"),
          "the camera on its way to the pass",
        );

        const flight = await page.evaluate<boolean[]>("window.__flight");
        // The flight happened …
        expect(flight.length).toBeGreaterThan(0);
        // … and the panel was up for every frame of it.
        expect(flight).toEqual(flight.map(() => true));
      },
    ),
  TIMEOUT,
);

/**
 * Whether the whole of the Galibier – both ascents and the summit, the box
 * `passBounds` carries – is inside the part of the map no panel covers. The
 * padded box *is* that part: the sheet's share at the bottom, the control
 * cluster's at the top, the floating panels' at the left (`map-camera.ts`).
 *
 * The box is derived here from the same data and the same `mapAssets` the app
 * hands the map, rather than being carried out through the test hook: what the
 * window exposes is the map itself, and nothing a test can work out for itself.
 */
const PASS_IN_VIEW = (box: Bounds) => `(() => {
  const m = window.__alpen.map;
  const [w, s, e, n] = ${JSON.stringify(box)};
  const pad = m.getPadding();
  const box = m.getCanvas().getBoundingClientRect();
  return [[w, s], [w, n], [e, s], [e, n]]
    .map((c) => m.project(c))
    .every(
      (q) =>
        q.x >= pad.left &&
        q.x <= box.width - pad.right &&
        q.y >= pad.top &&
        q.y <= box.height - pad.bottom,
    );
})()`;

test(
  "14 · a selected pass is framed whole, clear of the sheet and the controls",
  () =>
    // The case a camera centred on the summit could not answer: on a phone the
    // detail sheet takes more than half the screen, so an ascent of 18 km ran
    // off the top and the bottom of what was left.
    withPage(
      app,
      "pass-frame",
      { hash: "#pass=col-du-galibier&t=14", mobile: true },
      async (page) => {
        await page.waitFor("canvas.maplibregl-canvas");
        if (!(await page.camera())) return;
        await page.waitFor("#detail-title");
        // Zoomed in *and* at rest: the flight follows the panel rather than
        // leading it, so a camera at rest may be one that has yet to set off.
        await waitUntil(async () => {
          const c = await page.camera();
          return !!c && !c.moving && c.zoom > 9;
        }, "the camera framed on the pass");
        expect(
          await page.evaluate<boolean>(
            PASS_IN_VIEW(passBounds["col-du-galibier"]!),
          ),
        ).toBe(true);
      },
    ),
  TIMEOUT,
);

const COMPASS = '[aria-label="Nach Norden ausrichten"]';
const ATTRIB_TEXT = ".maplibregl-ctrl-attrib-inner";

test(
  "15 · the corner carries only what it has to: a folded attribution, a compass only off north",
  () =>
    withPage(app, "map-controls", { mobile: true }, async (page) => {
      await page.waitFor("canvas.maplibregl-canvas");
      if (!(await page.camera())) return;

      // Attribution is a licence obligation, so it is one interaction away –
      // folded, but never gone and never nested deeper than its own ⓘ.
      await page.waitFor(".maplibregl-ctrl-attrib-button");
      const shown = `!!document.querySelector("${ATTRIB_TEXT}")?.getClientRects().length`;
      expect(await page.evaluate<boolean>(shown)).toBe(false);
      await page.click(".maplibregl-ctrl-attrib-button");
      await page.waitFor(ATTRIB_TEXT);
      // Offline the tile servers never report in, so which sources are named
      // depends on the run; that there is something to read does not.
      const credit = await page.text(ATTRIB_TEXT);
      expect(credit?.length).toBeGreaterThan(0);

      // A map pointing north needs no control saying so.
      expect(await page.count(COMPASS)).toBe(0);
      // The comma keeps the map itself from travelling back as the result.
      await page.evaluate("window.__alpen.map.setBearing(-32), true");
      await page.waitFor(COMPASS);
      await page.click(COMPASS);
      await waitUntil(
        async () =>
          (await page.count(COMPASS)) === 0 &&
          (await page.evaluate<number>(
            "Math.abs(window.__alpen.map.getBearing())",
          )) < 0.5,
        "the map back on north and the compass gone with it",
      );
    }),
  TIMEOUT,
);

test(
  "16 · the sheet's content scrolls only once it is all the way up",
  () =>
    // The drag and the scroll are one gesture, so below the top snap point the
    // content does not scroll at all and the whole sheet is a handle – the
    // rule that makes a sheet whose upper half is a photo enlargeable by
    // anything other than its 20 px grabber.
    withPage(
      app,
      "sheet-scroll-lock",
      { hash: "#pass=passo-dello-stelvio", mobile: true },
      async (page) => {
        await page.waitFor("#detail-title");
        await page.waitInViewport("#detail-title");

        // Collapsed: there is more than fits, and none of it scrolls.
        const collapsed = await detailScroll(page);
        expect(collapsed.overflow).toBe("hidden");
        // The title lies at the foot of the hero, so a panel that opened
        // already scrolled would have taken it off the top of the sheet.
        expect(collapsed.titleOnScreen).toBe(true);
        expect(collapsed.scrollTop).toBe(0);
        expect(collapsed.scrollable).toBe(true);

        // Up at the top snap point it is an ordinary scroll container again.
        await page.click('[aria-label*="ausklappen"]');
        await waitUntil(async () => {
          const up = await detailScroll(page);
          return up.overflow === "auto";
        }, "the content scrollable once the sheet is up");

        // And coming back down starts it over at the hero rather than in the
        // middle of an article the collapsed sheet has no room for.
        await page.evaluate(
          `document.querySelector("#detail-title").closest("section")
             .querySelector('div[class*="overscroll-contain"]').scrollTop = 300`,
        );
        const mid = await detailScroll(page);
        expect(mid.scrollTop).toBe(300);
        await page.click('[aria-label*="einklappen"]');
        await waitUntil(async () => {
          const back = await detailScroll(page);
          return back.overflow === "hidden" && back.scrollTop === 0;
        }, "the content locked and back at the top");
        const reset = await detailScroll(page);
        expect(reset.titleOnScreen).toBe(true);
      },
    ),
  TIMEOUT,
);

test(
  "17 · a stored half-month is applied, a shared link beats it",
  () =>
    withPage(app, "stored-period", {}, async (page) => {
      // The preference is written by the period control only; here it is
      // planted directly and the page opened afresh on top of it.
      await page.evaluate('localStorage.setItem("alpenpaesse:period", "3")');
      await page.navigate();
      await page.waitFor(PASS_ROW);
      // The static HTML names today's half-month until the script arrives;
      // `load` runs in a layout effect, so the first paint after hydration
      // already names the stored one and nothing flips afterwards. The moment
      // of hydration cannot be caught from outside reliably, so what is
      // asserted is the settled headline, the band and the hash they wrote.
      await page.waitForAttribute(SLIDER, "aria-valuetext", /^Anfang März:/u);
      expect(await page.text("header p")).toMatch(/^Anfang März:/u);
      expect(await page.hash()).toContain("t=3");
      // A shared link wins over the preference and leaves it untouched.
      await page.navigate("#t=7");
      await page.waitForAttribute(SLIDER, "aria-valuetext", /^Anfang Juli:/u);
      expect(
        await page.evaluate<string | null>(
          'localStorage.getItem("alpenpaesse:period")',
        ),
      ).toBe("3");
    }),
  TIMEOUT,
);

test(
  "18 · a detail file that never arrives ends the wait instead of extending it",
  () =>
    // The file is content-hashed and immutable, so the one way it goes missing
    // is a stale deploy answering a 404 – which used to leave an `aria-busy`
    // skeleton on screen forever (lib/detail-state.ts).
    withPage(
      app,
      "detail-file-blocked",
      { block: ["*/detail/*.json"], hash: "#pass=col-du-galibier" },
      async (page) => {
        await page.waitFor("#detail-title");
        expect(await page.text("#detail-title")).toBe("Col du Galibier");
        const panelSays = async (sentence: string) => {
          const text = await page.text(DETAIL_PANEL);
          return !!text?.includes(sentence);
        };
        // The page's own count says this pass has photos, so the head opened
        // as a hero – and gave it up when nothing arrived.
        await waitUntil(
          () => panelSays("Keine Fotos geladen"),
          "the panel saying the photos did not arrive",
        );
        // The profile block says its own half of it, rather than drawing a
        // placeholder for something that is not on its way.
        await waitUntil(
          () => panelSays("Kein Höhenprofil vorhanden."),
          "the profile block saying there is none",
        );
        await waitUntil(
          async () => (await page.count("[aria-busy]")) === 0,
          "no skeleton left waiting",
        );
      },
    ),
  TIMEOUT,
);

/**
 * One hover, both halves of the screen.
 *
 * The hull of what a town reaches used to be painted by the map's own pointer
 * alone, so pointing at a row said nothing about the town it names – the two
 * hover states never met (docs/plans/30-map-scene.md). Now the row reports the
 * hover and the scene answers it, which is what this checks from the outside.
 */
const REACH_DRAWN = `(() => {
  const m = window.__alpen?.map;
  if (!m) return -1;
  return m.queryRenderedFeatures({ layers: [${JSON.stringify(OVERLAY.hull)}] }).length;
})()`;

test(
  "19 · a town hovered in the list outlines what it reaches",
  () =>
    withPage(app, "town-hover-reach", {}, async (page) => {
      await page.waitFor("canvas.maplibregl-canvas");
      if (!(await page.camera())) return;
      await page.clickText("button", "Orte");
      const row = '[data-row="town:bormio"]';
      await page.waitFor(row);
      // Nothing is pointed at, so nothing is outlined.
      expect(await page.evaluate<number>(REACH_DRAWN)).toBe(0);

      // The row reports the hover the same way the map's pointer does; focus
      // is the half of it a headless run can produce.
      await page.focus(row);
      await waitUntil(
        async () => (await page.evaluate<number>(REACH_DRAWN)) > 0,
        "the hull of what Bormio reaches, drawn from a hover in the list",
      );
      await page.evaluate("document.activeElement.blur()");
      await waitUntil(
        async () => (await page.evaluate<number>(REACH_DRAWN)) === 0,
        "the outline gone with the pointer",
      );
    }),
  TIMEOUT,
);
