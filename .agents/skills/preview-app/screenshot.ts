#!/usr/bin/env bun
/**
 * Headless screenshots of the app in a set of states, using Bun.WebView
 * (Bun ≥ 1.4, experimental) – no Playwright, no npm dependency.
 *
 *   bun .agents/skills/preview-app/screenshot.ts [baseUrl] [outDir] [--offline] [--webkit] [--state name=hash[,mobile][,dark]]...
 *
 * Backend: Chrome/Chromium over the DevTools Protocol by default (any
 * installed Chrome; set CHROME=/path/to/chrome when it is not in a standard
 * location). `--webkit` uses the system WebKit on macOS with zero external
 * dependencies, but cannot emulate dark mode, touch or offline mode: those
 * flags are ignored with a note.
 *
 * --offline blocks requests to tile, DEM and glyph servers, so MapLibre
 * reaches "load" without them and draws its vector layers on a blank
 * background. Say so when posting such screenshots.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

// --- CLI ------------------------------------------------------------------

const args = process.argv.slice(2);
const positional = args.filter(
  (a, i) => !a.startsWith("--") && args[i - 1] !== "--state",
);
const base = (positional[0] ?? "http://127.0.0.1:3000").replace(/\/$/u, "");
const outDir = positional[1] ?? "out";
const offline = args.includes("--offline");
const webkit = args.includes("--webkit");
const customStates = args.flatMap((a, i) =>
  a === "--state" && args[i + 1] ? [args[i + 1]!] : [],
);

interface State {
  name: string;
  hash: string;
  mobile: boolean;
  dark: boolean;
}

const DEFAULT_STATES = [
  "overview=",
  "overview-dark=,dark",
  "tour-sellaronda=#tour=sellaronda",
  "pass-galibier=#pass=col-du-galibier&t=10",
  "mobile-peek=,mobile",
  "mobile-pass=#pass=passo-dello-stelvio,mobile",
];

const states: State[] = (
  customStates.length ? customStates : DEFAULT_STATES
).map((spec) => {
  const eq = spec.indexOf("=");
  const name = eq === -1 ? spec : spec.slice(0, eq);
  const [hash = "", ...flags] = (eq === -1 ? "" : spec.slice(eq + 1)).split(
    ",",
  );
  return {
    dark: flags.includes("dark"),
    hash,
    mobile: flags.includes("mobile"),
    name,
  };
});

// --- Backend --------------------------------------------------------------

/** Chrome with software WebGL (MapLibre needs a GL context even headless). */
const CHROME_ARGV = [
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--disable-background-networking",
  "--disable-sync",
  "--hide-scrollbars",
  // Chrome refuses to start as root without it (containers, CI runners).
  ...(process.getuid?.() === 0 ? ["--no-sandbox"] : []),
];

/** Hosts the map talks to; blocked in --offline mode when the base itself is https. */
const EXTERNAL_HOST_PATTERNS = [
  "*://*.openstreetmap.org/*",
  "*://*.openstreetmap.fr/*",
  "*://*.opentopomap.org/*",
  "*://*.arcgisonline.com/*",
  "*://*.amazonaws.com/*",
  "*://*.openmaptiles.org/*",
  "*://*.waymarkedtrails.org/*",
  "*://*.thunderforest.com/*",
  "*://*.maptiler.com/*",
  "*://*.openfreemap.org/*",
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

const backend = (): Bun.WebView.Backend => {
  if (webkit) return "webkit";
  const chrome = chromePath();
  return {
    type: "chrome",
    url: false,
    ...(chrome ? { path: chrome } : {}),
    argv: CHROME_ARGV,
    // Chrome's own crash output; useful when it "closes the pipe" without a reason.
    stderr: process.env.DEBUG_CHROME ? "inherit" : "ignore",
  };
};

if (webkit && (offline || states.some((s) => s.dark || s.mobile))) {
  console.log(
    "note: --webkit cannot emulate dark mode, touch or offline mode; those flags are ignored",
  );
}

// --- One state ------------------------------------------------------------

const shoot = async (state: State) => {
  const width = state.mobile ? 390 : 1440;
  const height = state.mobile ? 844 : 900;
  const errors = new Set<string>();
  const view = new Bun.WebView({
    backend: backend(),
    console: (type, ...rest) => {
      if (type !== "error") return;
      const first = rest[0] as { description?: string } | string | undefined;
      errors.add(
        String(typeof first === "object" ? first?.description : first).slice(
          0,
          160,
        ),
      );
    },
    height,
    width,
  });

  try {
    // The first navigation sets up the DevTools session; emulation comes after it.
    await view.navigate("about:blank");
    if (!webkit) {
      await view.cdp("Emulation.setDeviceMetricsOverride", {
        deviceScaleFactor: 1,
        height,
        mobile: state.mobile,
        width,
      });
      await view.cdp("Emulation.setTouchEmulationEnabled", {
        enabled: state.mobile,
        maxTouchPoints: state.mobile ? 5 : 1,
      });
      await view.cdp("Emulation.setEmulatedMedia", {
        features: [
          {
            name: "prefers-color-scheme",
            value: state.dark ? "dark" : "light",
          },
        ],
      });
      await view.cdp("Emulation.setLocaleOverride", { locale: "de-DE" });
      // Views share one Chrome profile: start every state without stored sidebar or period state.
      await view.cdp("Storage.clearDataForOrigin", {
        origin: base,
        storageTypes: "all",
      });
      if (offline) {
        // Block by URL pattern (a blocklist, so there is no allow-list for the
        // base origin): with a local http server every https request is
        // external; with an https base, block the known tile, DEM and glyph
        // hosts instead. Request interception via the Fetch domain would be
        // exact but deadlocks in Bun.WebView 1.4.2.
        await view.cdp("Network.enable");
        await view.cdp("Network.setBlockedURLs", {
          urls: base.startsWith("http://")
            ? ["https://*"]
            : EXTERNAL_HOST_PATTERNS,
        });
      }
    }

    await view.navigate(`${base}/${state.hash}`);
    // Let MapLibre fetch its worker, style and data and paint the layers.
    await Bun.sleep(offline ? 4000 : 8000);

    const file = path.join(outDir, `${state.name}.png`);
    await Bun.write(file, await view.screenshot({ encoding: "buffer" }));
    const relevant = [...errors].filter(
      (e) =>
        !/Failed to load resource|ERR_FAILED|ERR_BLOCKED|AJAXError/u.test(e),
    );
    console.log(
      `${file}${relevant.length ? `  console: ${relevant.join(" | ")}` : ""}`,
    );
  } finally {
    view.close();
  }
};

await mkdir(outDir, { recursive: true });
try {
  for (const state of states) await shoot(state);
} finally {
  Bun.WebView.closeAll();
}
