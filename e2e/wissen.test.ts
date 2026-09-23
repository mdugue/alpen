/**
 * The knowledge base under /wissen: docs/ prerendered at build time, the
 * Mermaid diagrams inlined as the committed SVGs. What the Markdown becomes is
 * decided in `lib/docs/` and answered by table tests there; these check that
 * the pages are wired to it – the entry built from the indexes, a diagram in
 * the HTML with no Mermaid in the browser, the links rewritten, the zoom
 * dialog – in a real browser, on the same build as the app.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";

import { startApp, withPage } from "@/test/browser";
import type { App } from "@/test/browser";

let app: App;

beforeAll(async () => {
  app = await startApp();
});

afterAll(() => {
  app?.stop();
  Bun.WebView.closeAll();
});

test("1 · the entry lists the guide as cards and the docs as AGENTS.md does", () =>
  withPage(app, "wissen-entry", { hash: "wissen" }, async (page) => {
    await page.waitFor("h1");
    expect(await page.text("h1")).toBe("Was hinter der Karte steckt");
    // One card per page the guide's index links to, each a link to its page.
    expect(await page.count("ol [data-slot=card] a[href^='/wissen/']")).toBe(5);
    // The developer docs, in AGENTS.md's order, the first one first.
    expect(await page.attribute("section ul li:first-child a", "href")).toBe(
      "/wissen/dev/data-pipeline",
    );
    // The road sketch is drawn from the app's own routes, inline.
    expect(await page.count("svg.wissen-sketch path")).toBe(2);
  }));

test("2 · a page carries its diagrams as SVG, and its links stay on the site", () =>
  withPage(
    app,
    "wissen-page",
    { hash: "wissen/dev/data-model" },
    async (page) => {
      await page.waitFor("article h1");
      expect(await page.attribute("article", "lang")).toBe("en");
      // Mermaid never reaches the browser: the SVG is in the HTML.
      expect(await page.count("article figure.diagram svg")).toBeGreaterThan(0);
      expect(
        await page.evaluate<boolean>("typeof window.mermaid === 'undefined'"),
      ).toBe(true);
      // A link to another doc goes to its page, one out of docs/ to GitHub.
      expect(
        await page.count("article a[href^='/wissen/dev/']"),
      ).toBeGreaterThan(0);
      expect(
        await page.count(
          "article a[href^='https://github.com/mdugue/alpen/blob/main/']",
        ),
      ).toBeGreaterThan(0);
    },
  ));

test("3 · a diagram wider than the column opens in a dialog with zoom", () =>
  withPage(
    app,
    "wissen-dialog",
    { hash: "wissen/dev/data-pipeline" },
    async (page) => {
      await page.click("figure.diagram .diagram-open");
      await page.waitFor("[role=dialog]");
      const zoom = "[role=dialog] button[title='Originalgröße']";
      const before = await page.text(zoom);
      await page.click("[role=dialog] button[aria-label='Hineinzoomen']");
      expect(await page.text(zoom)).not.toBe(before);
      await page.press("Escape");
      await page.waitForGone("[role=dialog]");
    },
  ));

test("4 · the guide reads in German, in the dark too", () =>
  withPage(
    app,
    "wissen-guide-dark",
    { dark: true, hash: "wissen/data-journey", mobile: true },
    async (page) => {
      await page.waitFor("article h1");
      expect(await page.attribute("article", "lang")).toBe("de");
      expect(await page.text("article h1")).toBe("Der Weg der Daten");
      // The pager leads on through the guide in its index's order.
      expect(
        await page.attribute("nav[aria-label=Weiterlesen] a", "href"),
      ).toBe("/wissen/scales-and-status");
    },
  ));
