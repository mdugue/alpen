/**
 * The smoke test. It needs a production build (`bun run build`, with
 * `NEXT_PUBLIC_TEST_HOOKS=1` for the camera assertions) and a Chrome;
 * `bun run e2e` does the rest.
 *
 * Ten scenarios, and what is not among them is not untested: the reducer, the
 * camera machine, the scene, the pick, the detail model and the pipeline are
 * all decided in `lib/` and answered by table tests there
 * (docs/architecture.md, "Functional core, imperative shell"). What is left
 * here is the half no table test can reach – that the app is wired to those
 * decisions at all, and the handful of behaviours that only exist once a real
 * browser lays the page out: a drawer stacking on another, a hit area a few
 * pixels wide, a sheet whose content scrolls only at the top, a scheme the OS
 * chooses.
 *
 * Every scenario runs on the suite's own timeout (`bun test --timeout`, see
 * `e2e:run` in package.json); none carries one of its own, and nothing here
 * reaches into the page for anything but the map handle.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";

import routesJson from "@/data/generated/routes.json" with { type: "json" };
import passes from "@/data/passes.json" with { type: "json" };
import toursJson from "@/data/tours.json" with { type: "json" };
import type { Bounds } from "@/lib/geo";
import { HIT_LAYERS, LAYERS } from "@/lib/layer-ids";
import { mapAssets } from "@/lib/map-assets";
import * as S from "@/lib/schema";
import { startApp, waitUntil, withPage } from "@/test/browser";
import type { App, Page } from "@/test/browser";

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
/**
 * The list opens on the areas (plan 12); the road tests switch to the roads
 * first, the way a visitor does – by the tab.
 */
const showRoads = (page: Page) => page.clickText('[role="tab"]', "Straßen");
const GALIBIER = '[data-row="pass:col-du-galibier"]';
const SLIDER = '[aria-label="Zeitraum"]';
const BACK_TO_LIST = '[aria-label="Zurück zur Liste"]';
/** A drawer with another one open on top of it – Base UI's own stack state. */
const STACKED = "[data-slot=drawer-popup][data-nested-drawer-open]";

test("1 · loads with all passes and a map canvas", () =>
  withPage(app, "loads", {}, async (page) => {
    await showRoads(page);
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
  }));

test("2 · selecting a pass opens the detail panel, Escape returns focus to the row", () =>
  withPage(app, "select-pass", {}, async (page) => {
    await showRoads(page);
    // A row is reached and opened without a pointer: the list is one tab stop
    // and the arrows move inside it (`useRoving`, lib/use-roving.ts), so the
    // focus steps on from the first row …
    await page.waitFor(PASS_ROW);
    const first = await page.attribute(PASS_ROW, "data-row");
    await page.focus(PASS_ROW);
    await page.press("ArrowDown");
    await waitUntil(async () => {
      const row = await page.activeRow();
      return row !== null && row !== first;
    }, "the arrow key to move the focus one row on");
    // … and Enter on the row the focus sits on opens it.
    await page.focus(GALIBIER);
    await page.press("Enter");
    await page.waitFor("#detail-title");
    expect(await page.text("#detail-title")).toBe("Col du Galibier");
    // The selection is the path (plan 02); the hash carries the rest. The
    // push is a transition, so it lands a moment after the panel.
    await waitUntil(
      async () => (await page.path()) === "/pass/col-du-galibier",
      "the pass's route",
    );
    expect(await page.hash()).not.toContain("pass=");
    // The profiles are not in the page: the panel fetches the selected
    // entity's file from `public/detail` (lib/detail-assets.ts). The title
    // is there immediately, the profile a request later.
    await page.waitFor('[aria-label^="Höhenprofil:"]');
    // In a text field the key belongs to the field – Chrome empties a search
    // input with it – so the panel stays open.
    await page.focus('input[type="search"]');
    await page.press("Escape");
    expect(await page.text("#detail-title")).toBe("Col du Galibier");
    // Everywhere else it closes the panel, whether or not the focus is still
    // in it: it is opened from the map as often as from a row.
    await page.evaluate("document.activeElement?.blur()");
    await page.press("Escape");
    await page.waitForGone("#detail-title");
    // The panel is gone on commit, the row is focused a frame later
    // (`back` in explorer.tsx); a single read in between sees the body.
    await waitUntil(
      async () => (await page.activeRow()) === "pass:col-du-galibier",
      "focus back on the row",
    );
    expect(await page.path()).toBe("/");
  }));

test("3 · a shared link restores selection, period and camera", () =>
  withPage(
    app,
    "shared-link",
    { hash: "#pass=col-du-galibier&t=6&z=9&c=45.06,6.41" },
    async (page) => {
      // A link from before the routes: the selection it carries is applied
      // and the address bar moves to the pass's own path, the rest of the
      // hash kept (`useHashAdapter`, lib/hash-adapter.ts).
      await page.waitFor("#detail-title");
      expect(await page.text("#detail-title")).toBe("Col du Galibier");
      await waitUntil(
        async () => (await page.path()) === "/pass/col-du-galibier",
        "the old link moved over to the route",
      );
      expect(await page.hash()).not.toContain("pass=");
      expect(await page.hash()).toContain("t=6");
      await page.waitForAttribute(SLIDER, "aria-valuetext", /^Anfang Juni:/u);

      // The link carries a camera as well – the app writes one into every
      // hash – and the pass is framed all the same: the link's view is what
      // the map is *built* with, not a camera asked for on top of it, which
      // would take the flight away before it set off (`load`, lib/app-state.ts).
      if (await page.camera())
        await waitUntil(async () => {
          const c = await page.camera();
          return !!c && !c.moving && c.zoom > 9.5;
        }, "the camera framed on the pass, past the link's own zoom of 9");

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
  ));

test("4 · a status chip narrows the lists and the applied-filter chip undoes it", () =>
  // Early January: nothing is "gut", so the counts and the disabled chip bite.
  withPage(app, "status-filter", { hash: "#t=1" }, async (page) => {
    await showRoads(page);
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
  }));

test("5 · nothing covers the map until it is asked for; list and detail stack", () =>
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
      // The tab followed the tap on the road, so the button names the roads.
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
    expect(await page.path()).toBe("/");
  }));

test("5b · an entity route is a page of its own, and the back button closes it", () =>
  withPage(
    app,
    "entity-route",
    { hash: "pass/col-du-galibier#t=6" },
    async (page) => {
      // A direct visit: prerendered with the pass's own title, and the panel
      // open on it without a hash saying so.
      await page.waitFor("#detail-title");
      expect(await page.text("#detail-title")).toBe("Col du Galibier");
      expect(await page.evaluate<string>("document.title")).toContain(
        "Col du Galibier",
      );
      expect(await page.path()).toBe("/pass/col-du-galibier");
      // A second selection is a history entry, so back returns to the first …
      await showRoads(page);
      await page.click('[data-row="pass:passo-dello-stelvio"]');
      await waitUntil(
        async () => (await page.path()) === "/pass/passo-dello-stelvio",
        "the second pass's route",
      );
      await page.back();
      await waitUntil(
        async () => (await page.text("#detail-title")) === "Col du Galibier",
        "the first pass again after back",
      );
      // … and closing the panel now goes forward to the start page rather than
      // back out of the site: the entry behind this one is not the app's.
      await page.click('[aria-label="Details schließen"]');
      await page.waitForGone("#detail-title");
      await waitUntil(
        async () => (await page.path()) === "/",
        "the start page",
      );
      expect(await page.hash()).toContain("t=6");
    },
  ));

test("5c · the English version lives under /en, and the toggle keeps the place", () =>
  withPage(
    app,
    "english",
    { hash: "en/pass/col-du-galibier#t=6" },
    async (page) => {
      await page.waitFor("#detail-title");
      expect(await page.evaluate<string>("document.documentElement.lang")).toBe(
        "en",
      );
      expect(await page.path()).toBe("/en/pass/col-du-galibier");
      // The kind tabs read the English words; the rows keep their names.
      await page.clickText('[role="tab"]', "Roads");
      await page.waitFor('[data-row="pass:passo-dello-stelvio"]');
      // The toggle is a plain link to the same place without the prefix.
      await page.click('a[hreflang="de"]');
      await waitUntil(
        async () => (await page.path()) === "/pass/col-du-galibier",
        "the German route",
      );
      // A full load: the new document is there once its panel is.
      await page.waitFor("#detail-title");
      expect(await page.evaluate<string>("document.documentElement.lang")).toBe(
        "de",
      );
      expect(await page.hash()).toContain("t=6");
    },
  ));

test("6 · a stored half-month is applied, a shared link beats it", () =>
  withPage(app, "stored-period", {}, async (page) => {
    // The preference is written by the period control only; here it is
    // planted directly and the page opened afresh on top of it.
    await page.evaluate('localStorage.setItem("alpenpaesse:period", "3")');
    await page.navigate();
    await showRoads(page);
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
  }));

/**
 * The map's hit areas: what is drawn is a few pixels wide, what answers the
 * pointer is the transparent layer over it.
 *
 * The ids come from the one table the style is built from
 * (`LAYERS`, lib/layer-ids.ts), so a layer renamed on one side and not the
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

test("7 · a pass answers beside its dot, where nothing is drawn", () =>
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
      // Only a build with NEXT_PUBLIC_TEST_HOOKS=1 exposes the map; without
      // it there is nothing to query and the wait below would sit out the
      // suite's timeout.
      if (!(await page.camera())) return;
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
  ));

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

test("8 · a selected pass is framed whole, clear of the sheet and the controls", () =>
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
      // And the road itself is there: the ascent lines never travel as props,
      // they are fetched from the content-hashed GeoJSON in public/map and
      // tiled (lib/map-assets.ts).
      await waitUntil(
        () =>
          page.evaluate<boolean>(
            'window.__alpen.map.querySourceFeatures("routes").length > 0',
          ),
        "the ascent geometry loaded from GeoJSON",
      );
    },
  ));

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

test("9 · the sheet's content scrolls only once it is all the way up", () =>
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
  ));

const COMPASS = '[aria-label="Nach Norden ausrichten"]';
const ATTRIB_TEXT = ".maplibregl-ctrl-attrib-inner";

/**
 * How light the page paints, from 0 to 1.
 *
 * Read through a canvas pixel rather than parsed: the tokens are `oklch()`,
 * and what a computed style serialises them back to is the browser's business
 * – the same reason `readColors` paints MapLibre's colours through a canvas
 * (docs/map-rendering.md, "MapLibre needs two workarounds").
 */
const LUMINANCE = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  const lum = (color) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  const style = getComputedStyle(document.body);
  return JSON.stringify({
    background: lum(style.backgroundColor),
    text: lum(style.color),
  });
})()`;

test("10 · the page follows the OS into the dark, and the corner carries only what it has to", () =>
  withPage(app, "dark-controls", { dark: true, mobile: true }, async (page) => {
    await page.waitFor("canvas.maplibregl-canvas");

    // There is no switch: `prefers-color-scheme` is the whole mechanism
    // (docs/ui-conventions.md, "Dark mode follows the OS, nothing else"), so
    // an emulated preference is all it takes to turn the page over.
    const shade = JSON.parse(await page.evaluate<string>(LUMINANCE)) as {
      background: number;
      text: number;
    };
    expect(shade.background).toBeLessThan(0.25);
    expect(shade.text).toBeGreaterThan(0.75);

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
  }));
