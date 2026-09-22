#!/usr/bin/env bun
/**
 * The sRGB mirror against the stylesheet it mirrors.
 *
 *   bun run palette
 *
 * Three things render outside the document and cannot read a custom property:
 * MapLibre, which is handed a finished style (`lib/basemap.ts`), and Satori
 * and the web manifest, which paint the icons, the share image and the browser
 * chrome (`lib/brand.ts`). All three read `TOKENS` in `lib/palette.ts`, and a
 * copy of a colour is only acceptable while something says when it stops being
 * one – the two copies that preceded it had drifted from `app/globals.css` and
 * from each other, silently, over every token they shared.
 *
 * So the stylesheet's own `oklch()` values are converted here and compared.
 * The conversion is the CSS Color 4 one (Oklab → linear sRGB → gamma), which
 * is what a browser does with the same declaration; a drift is reported with
 * the value to paste.
 */

/** The tokens the mirror carries, keyed by scheme; see `lib/palette.ts`. */
import { TOKENS } from "../lib/palette";
import type { Scheme, Tokens } from "../lib/palette";

/** `mutedForeground` is `--muted-foreground`, and that is the whole mapping. */
const property = (key: string) =>
  `--${key.replaceAll(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`)}`;

/**
 * Where each scheme's tokens stand in `app/globals.css`: the light ones in the
 * `:root` block at the top, the dark ones in the `prefers-color-scheme` block
 * after it. Everything from `@theme inline` on is Tailwind's own mapping,
 * where a token is only ever `var(--token)` – no scheme, nothing to compare.
 */
const regions = (css: string): Record<Scheme, string> => {
  const dark = css.indexOf("@media (prefers-color-scheme: dark)");
  const theme = css.indexOf("@theme inline");
  if (dark === -1 || theme < dark)
    throw new Error(
      "app/globals.css: neither the dark block nor @theme inline is where this check expects it",
    );
  return { dark: css.slice(dark, theme), light: css.slice(0, dark) };
};

/** The last declaration of a custom property as `oklch(l c h)`, if it is one. */
const declared = (
  region: string,
  prop: string,
): [number, number, number] | null => {
  const matches = [
    ...region.matchAll(
      new RegExp(String.raw`(?:^|[;{\s])${prop}:\s*oklch\(([^)]+)\)`, "gmu"),
    ),
  ];
  const last = matches.at(-1);
  if (!last?.[1]) return null;
  const parts = last[1].trim().split(/\s+/u).map(Number);
  return parts.length === 3 && parts.every((n) => Number.isFinite(n))
    ? [parts[0]!, parts[1]!, parts[2]!]
    : null;
};

/** One linear-light channel as two hex digits, gamma-encoded and clipped. */
const channel = (v: number) => {
  const gamma = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, gamma)) * 255)
    .toString(16)
    .padStart(2, "0");
};

/** CSS Color 4: Oklch → Oklab → linear sRGB → `#rrggbb`. */
const toHex = ([l, c, h]: [number, number, number]): string => {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return `#${channel(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short)}${channel(
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
  )}${channel(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short)}`;
};

const css = await Bun.file(
  `${new URL("..", import.meta.url).pathname}app/globals.css`,
).text();
const source = regions(css);

const checks = (Object.entries(TOKENS) as [Scheme, Tokens][]).flatMap(
  ([scheme, tokens]) =>
    (Object.entries(tokens) as [keyof Tokens, string][]).map(
      ([key, mirrored]) => ({ key, mirrored, scheme }),
    ),
);

const drift: string[] = [];
for (const { key, mirrored, scheme } of checks) {
  const prop = property(key);
  const value = declared(source[scheme], prop);
  if (!value) {
    drift.push(
      `${scheme} ${prop}: not declared as an oklch() value in app/globals.css`,
    );
    continue;
  }
  const expected = toHex(value);
  if (expected !== mirrored)
    drift.push(
      `${scheme} ${prop}: the stylesheet says ${expected}, TOKENS.${scheme}.${key} says ${mirrored}`,
    );
}

// English, unlike `data:check`: this one reports to whoever is writing the
// code, next to oxlint's own findings, not to the curator.
console.log(
  `${checks.length} tokens: ${drift.length === 0 ? "all mirrored" : `${drift.length} drifted`}`,
);
if (drift.length) {
  for (const line of drift) console.error(`\n${line}`);
  console.error(
    "\nEither app/globals.css moved and TOKENS (lib/palette.ts) follows it, or the token was renamed in one of the two.",
  );
  process.exit(1);
}
