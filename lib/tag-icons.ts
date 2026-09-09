import type { TownTag } from "@/lib/types";

/**
 * The geometry of the nine label icons, as Lucide draws them (Lucide 1.43.0,
 * ISC, lucide.dev). Not imported as `lucide-react` components, because the
 * same nine glyphs also have to reach MapLibre's hover popup, which takes an
 * HTML string and not React – the same reason `scripts/build-glyphs.ts` bakes
 * Inter into glyph atlases for the map. One table serves both, so a badge in
 * the panel and the popup on the map can never drift apart.
 *
 * To change or add an icon, take the `node` of the Lucide icon module
 * (`node_modules/lucide-react/dist/esm/icons/<name>.mjs`) minus its `key`
 * entries; everything else about the drawing – 24×24 box, no fill, round caps,
 * 2 px stroke in `currentColor` – is in `ICON_ATTRS` below.
 */
type IconNode = [element: string, attrs: Record<string, string>][];

export const TAG_ICON: Record<TownTag, IconNode> = {
  // trophy
  events: [
    ["path", { d: "M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2" }],
    ["path", { d: "M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2" }],
    ["path", { d: "M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3" }],
    ["path", { d: "M4 22h16" }],
    ["path", { d: "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" }],
    ["path", { d: "M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3" }],
  ],
  // bed-double
  hotels: [
    ["path", { d: "M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" }],
    ["path", { d: "M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" }],
    ["path", { d: "M12 4v6" }],
    ["path", { d: "M2 18h20" }],
  ],
  // bike
  hub: [
    ["circle", { cx: "18.5", cy: "17.5", r: "3.5" }],
    ["circle", { cx: "5.5", cy: "17.5", r: "3.5" }],
    ["circle", { cx: "15", cy: "5", r: "1" }],
    ["path", { d: "M12 17.5V14l-3-3 4-3 2 3h2" }],
  ],
  // mountain
  passes: [["path", { d: "m8 3 4 8 5-5 5 15H2L8 3z" }]],
  // leaf
  quiet: [
    [
      "path",
      {
        d: "M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20",
      },
    ],
    ["path", { d: "M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13" }],
  ],
  // sparkles
  scenic: [
    [
      "path",
      {
        d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",
      },
    ],
    ["path", { d: "M20 2v4" }],
    ["path", { d: "M22 4h-4" }],
    ["circle", { cx: "4", cy: "20", r: "2" }],
  ],
  // sun
  season: [
    ["circle", { cx: "12", cy: "12", r: "4" }],
    ["path", { d: "M12 2v2" }],
    ["path", { d: "M12 20v2" }],
    ["path", { d: "m4.93 4.93 1.41 1.41" }],
    ["path", { d: "m17.66 17.66 1.41 1.41" }],
    ["path", { d: "M2 12h2" }],
    ["path", { d: "M20 12h2" }],
    ["path", { d: "m6.34 17.66-1.41 1.41" }],
    ["path", { d: "m19.07 4.93-1.41 1.41" }],
  ],
  // train-front
  train: [
    ["path", { d: "M8 3.1V7a4 4 0 0 0 8 0V3.1" }],
    ["path", { d: "m9 15-1-1" }],
    ["path", { d: "m15 15 1-1" }],
    [
      "path",
      { d: "M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z" },
    ],
    ["path", { d: "m8 19-2 3" }],
    ["path", { d: "m16 19 2 3" }],
  ],
  // wrench
  workshops: [
    [
      "path",
      {
        d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z",
      },
    ],
  ],
};

/** What every glyph shares; a `<path>` inherits stroke and cap from the `<svg>`. */
export const ICON_ATTRS = {
  fill: "none",
  stroke: "currentColor",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "stroke-width": "2",
  viewBox: "0 0 24 24",
} as const;

/**
 * The same glyph as markup, for MapLibre's popup. Only this module's own
 * literals reach it – nothing from the data files – so there is nothing to
 * escape here; the popup escapes the names it interpolates itself.
 */
export const tagIconSvg = (tag: TownTag, size = 12): string => {
  const attrs = Object.entries({ ...ICON_ATTRS, height: size, width: size })
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  const body = TAG_ICON[tag]
    .map(
      ([el, a]) =>
        `<${el} ${Object.entries(a)
          .map(([k, v]) => `${k}="${v}"`)
          .join(" ")}/>`,
    )
    .join("");
  return `<svg ${attrs} aria-hidden="true">${body}</svg>`;
};
