#!/usr/bin/env node
/**
 * Headless screenshots of the app in a set of states.
 *
 *   node screenshot.mjs <baseUrl> <outDir> [--offline] [--state name=hash[,mobile][,dark]]...
 *
 * Env: PLAYWRIGHT_PKG (path or package name, default "playwright"),
 *      EXE (Chromium executable; omit to use Playwright's own browser).
 */
const [, , base = "http://127.0.0.1:3000", outDir = "out", ...rest] = process.argv;
const offline = rest.includes("--offline");
const custom = rest.flatMap((a, i) => (a === "--state" && rest[i + 1] ? [rest[i + 1]] : []));

const DEFAULT_STATES = [
  "overview=",
  "overview-dark=,dark",
  "tour-sellaronda=#tour=sellaronda",
  "pass-galibier=#pass=col-du-galibier&t=10",
  "mobile-peek=,mobile",
  "mobile-pass=#pass=passo-dello-stelvio,mobile",
];
const states = (custom.length ? custom : DEFAULT_STATES).map((s) => {
  const [name, spec = ""] = s.split(/=(.*)/s);
  const [hash, ...flags] = spec.split(",");
  return { name, hash, mobile: flags.includes("mobile"), dark: flags.includes("dark") };
});

const { chromium } = await import(process.env.PLAYWRIGHT_PKG ?? "playwright");
const { mkdir } = await import("node:fs/promises");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.EXE || undefined,
  args: ["--disable-background-networking", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

for (const s of states) {
  const viewport = s.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({
    viewport,
    colorScheme: s.dark ? "dark" : "light",
    isMobile: s.mobile,
    hasTouch: s.mobile,
    deviceScaleFactor: 1,
    locale: "de-DE",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 120)));
  if (offline) {
    const origin = new URL(base).origin;
    await page.route("**/*", (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
  }
  await page.goto(base + "/" + s.hash, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(offline ? 4000 : 8000);
  const file = `${outDir}/${s.name}.png`;
  await page.screenshot({ path: file });
  const relevant = [...new Set(errors)].filter((e) => !/Failed to load resource|ERR_FAILED|AJAXError/.test(e));
  console.log(`${file}${relevant.length ? "  console: " + relevant.join(" | ") : ""}`);
  await ctx.close();
}
await browser.close();
