/**
 * Browser harness for the e2e suite: one `next start` per run and a headless
 * Chrome per scenario, driven through `Bun.WebView` (Bun ≥ 1.4, experimental)
 * – the same backend the `preview-app` skill screenshots with, so CI needs
 * nothing beyond Bun and a Chrome.
 *
 * Runs are hermetic: every view starts with cleared storage and every request
 * to another origin is blocked, so no tile, DEM or glyph server is involved.
 * MapLibre still reaches `load` and draws its own layers on a blank
 * background.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

const PORT = Number(process.env.PORT ?? 3123);
const FAILURE_DIR = process.env.E2E_FAILURE_DIR ?? "e2e/failures";

/** Chrome with software WebGL – MapLibre needs a GL context even headless. */
const CHROME_ARGV = [
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--disable-background-networking",
  "--disable-sync",
  "--hide-scrollbars",
  // Unconditional, not just for root: on Ubuntu 24.04 (the GitHub runner)
  // unprivileged user namespaces are restricted, so Chrome's sandbox cannot
  // start and the process closes the pipe before the first navigation. The
  // page under test is our own server with every other origin blocked.
  "--no-sandbox",
  // Small /dev/shm in containers crashes the renderer.
  "--disable-dev-shm-usage",
];

const chromePath = (): string | undefined => {
  const explicit = process.env.CHROME ?? process.env.BUN_CHROME_PATH;
  if (explicit) return explicit;
  for (const name of [
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
  ]) {
    // On PATH: let Bun auto-detect.
    if (Bun.which(name)) return undefined;
  }
  const fallback = "/opt/pw-browsers/chromium";
  return Bun.file(fallback).size > 0 ? fallback : undefined;
};

/** Polls until the check passes; the message names what was waited for. */
export const waitUntil = async (
  check: () => Promise<boolean>,
  what: string,
  timeout = 15_000,
) => {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await check()) return;
    if (Date.now() > deadline) throw new Error(`Timeout: ${what}`);
    await Bun.sleep(100);
  }
};

export interface App {
  base: string;
  stop: () => void;
}

/**
 * Reuses a server at `BASE_URL`, otherwise starts the production server once
 * for the whole run. `bun run build` has to have happened before.
 */
export const startApp = async (): Promise<App> => {
  const fromEnv = process.env.BASE_URL;
  if (fromEnv)
    return {
      base: fromEnv.replace(/\/$/u, ""),
      stop: () => {
        // Nothing to stop: the server is not ours.
      },
    };

  const proc = Bun.spawn({
    cmd: ["bun", "run", "start"],
    env: { ...process.env, PORT: String(PORT) },
    stderr: "pipe",
    stdout: "pipe",
  });
  const base = `http://127.0.0.1:${PORT}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (proc.exitCode !== null) {
      throw new Error(
        `"bun run start" exited with ${proc.exitCode}. Run "bun run build" first.\n${await new Response(
          proc.stderr,
        ).text()}`,
      );
    }
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(2000) });
      if (res.ok) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline)
      throw new Error(`No answer from ${base} after 60 s.`);
    await Bun.sleep(250);
  }
  return { base, stop: () => proc.kill() };
};

export interface OpenOptions {
  /** Everything after the "/", usually a "#…" hash. */
  hash?: string;
  /** 390 × 844 with touch emulation. */
  mobile?: boolean;
  dark?: boolean;
}

/** One page under test; thin wrapper over the view with the waits we need. */
export class Page {
  readonly errors: string[] = [];
  private readonly view: Bun.WebView;
  private readonly base: string;
  constructor(view: Bun.WebView, base: string) {
    this.view = view;
    this.base = base;
  }

  /**
   * Always a fresh document, via a hop over about:blank: a fragment-only
   * change is a same-document navigation, and `navigate()` would wait for a
   * load event that never comes.
   */
  async navigate(hash = "") {
    await this.view.navigate("about:blank");
    await this.view.navigate(`${this.base}/${hash}`);
  }

  evaluate<T = unknown>(expression: string) {
    return this.view.evaluate<T>(expression);
  }

  /** Waits until the selector matches a visible element, then returns it. */
  async waitFor(selector: string, timeout = 15_000): Promise<void> {
    const deadline = Date.now() + timeout;
    for (;;) {
      const visible = await this.evaluate<boolean>(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)});
          return !!el && !!el.getClientRects().length; })()`,
      );
      if (visible) return;
      if (Date.now() > deadline)
        throw new Error(`Timeout: ${selector} did not become visible`);
      await Bun.sleep(100);
    }
  }

  async waitForGone(selector: string, timeout = 15_000): Promise<void> {
    const deadline = Date.now() + timeout;
    for (;;) {
      const gone = await this.evaluate<boolean>(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)});
          return !el || !el.getClientRects().length; })()`,
      );
      if (gone) return;
      if (Date.now() > deadline)
        throw new Error(`Timeout: ${selector} is still there`);
      await Bun.sleep(100);
    }
  }

  count(selector: string) {
    return this.evaluate<number>(
      `document.querySelectorAll(${JSON.stringify(selector)}).length`,
    );
  }

  text(selector: string) {
    return this.evaluate<string | null>(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)});
        return el ? el.textContent.replace(/\\s+/g, " ").trim() : null; })()`,
    );
  }

  /**
   * Polls an attribute until it matches. State restored from `localStorage`
   * only appears after hydration, so reading once would race the effect.
   */
  async waitForAttribute(
    selector: string,
    name: string,
    expected: string | RegExp,
    timeout = 15_000,
  ) {
    const deadline = Date.now() + timeout;
    let last: string | null = null;
    for (;;) {
      last = await this.attribute(selector, name);
      if (
        last !== null &&
        (typeof expected === "string"
          ? last.includes(expected)
          : expected.test(last))
      )
        return last;
      if (Date.now() > deadline)
        throw new Error(
          `Timeout: ${selector}[${name}] is "${last}", expected ${expected}`,
        );
      await Bun.sleep(100);
    }
  }

  attribute(selector: string, name: string) {
    return this.evaluate<string | null>(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)});
        return el ? el.getAttribute(${JSON.stringify(name)}) : null; })()`,
    );
  }

  async click(selector: string) {
    await this.waitFor(selector);
    // Rows sit in a scroll container; actionability needs them in the viewport.
    await this.view.scrollTo(selector);
    await this.view.click(selector);
  }

  /**
   * Clicks the first element matching the selector whose text contains
   * `text` – for the German link and button labels that carry no test id.
   */
  async clickText(selector: string, text: string) {
    const box = await this.evaluate<{ x: number; y: number } | null>(
      `(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
          .find((e) => e.textContent.includes(${JSON.stringify(text)}));
        if (!el) return null;
        el.scrollIntoView({ block: "nearest" });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
    );
    if (!box) throw new Error(`No ${selector} with the text "${text}"`);
    // A native click: the Base UI components listen for pointer events, which
    // a programmatic element.click() would not produce.
    await this.view.click(box.x, box.y);
  }

  /** Moves focus without a click, e.g. before typing or for keyboard tests. */
  async focus(selector: string) {
    await this.waitFor(selector);
    await this.evaluate(
      `document.querySelector(${JSON.stringify(selector)}).focus()`,
    );
  }

  async fill(selector: string, value: string) {
    await this.focus(selector);
    await this.view.type(value);
  }

  press(key: string) {
    return this.view.press(key);
  }

  hash() {
    return this.evaluate<string>("location.hash");
  }

  /** `data-row` of the focused element, for the focus-return checks. */
  activeRow() {
    return this.evaluate<string | null>(
      "document.activeElement?.getAttribute('data-row') ?? null",
    );
  }

  /** Camera state via the test hook (`NEXT_PUBLIC_TEST_HOOKS=1`). */
  camera() {
    return this.evaluate<{ zoom: number; lat: number; lon: number } | null>(
      `(() => { const m = window.__alpen?.map; if (!m) return null;
        const c = m.getCenter(); return { zoom: m.getZoom(), lat: c.lat, lon: c.lng }; })()`,
    );
  }

  async save(name: string) {
    await mkdir(FAILURE_DIR, { recursive: true });
    const file = path.join(
      FAILURE_DIR,
      name.endsWith(".png") ? name : `${name}.png`,
    );
    await Bun.write(file, await this.view.screenshot({ encoding: "buffer" }));
    return file;
  }

  close() {
    this.view.close();
  }
}

const openPage = async (app: App, options: OpenOptions = {}): Promise<Page> => {
  const width = options.mobile ? 390 : 1440;
  const height = options.mobile ? 844 : 900;
  const errors: string[] = [];
  const view = new Bun.WebView({
    backend: {
      type: "chrome",
      url: false,
      ...(chromePath() ? { path: chromePath()! } : {}),
      argv: CHROME_ARGV,
      // Chrome's own crash output; the reason it "closed the pipe" is only in there.
      stderr: process.env.DEBUG_CHROME ? "inherit" : "ignore",
    },
    console: (type, ...rest) => {
      if (type !== "error") return;
      const first = rest[0] as { description?: string } | string | undefined;
      errors.push(
        String(typeof first === "object" ? first?.description : first).slice(
          0,
          200,
        ),
      );
    },
    height,
    width,
  });
  const page = new Page(view, app.base);
  // The first navigation sets up the CDP session; emulation comes after it.
  await view.navigate("about:blank");
  await view.cdp("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height,
    mobile: !!options.mobile,
    width,
  });
  await view.cdp("Emulation.setTouchEmulationEnabled", {
    enabled: !!options.mobile,
    maxTouchPoints: options.mobile ? 5 : 1,
  });
  await view.cdp("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: options.dark ? "dark" : "light" },
    ],
  });
  await view.cdp("Emulation.setLocaleOverride", { locale: "de-DE" });
  // No remembered sidebar, period or favourites leaking between scenarios.
  await view.cdp("Storage.clearDataForOrigin", {
    origin: app.base,
    storageTypes: "all",
  });
  // Hermetic: the base is http, so every https request is a tile, DEM or
  // glyph server. Blocking is enough for MapLibre to reach "load".
  await view.cdp("Network.enable");
  await view.cdp("Network.setBlockedURLs", { urls: ["https://*"] });
  page.errors.push(...errors);
  await page.navigate(options.hash ?? "");
  return page;
};

/**
 * One scenario: opens a page, runs the body, and writes a screenshot next to
 * the report when it fails.
 */
export const withPage = async (
  app: App,
  name: string,
  options: OpenOptions,
  body: (page: Page) => Promise<void>,
): Promise<void> => {
  const page = await openPage(app, options);
  try {
    await body(page);
  } catch (error) {
    const file = await page
      .save(name.replaceAll(/[^a-z0-9]+/giu, "-").toLowerCase())
      .catch(() => null);
    if (file) console.error(`Screenshot of the failure: ${file}`);
    throw error;
  } finally {
    page.close();
  }
};
