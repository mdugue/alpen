import type { RoadTag, TownTag } from "@/lib/types";

/**
 * The geometry of the eighteen label icons, as Lucide draws them (Lucide 1.43.0,
 * ISC, lucide.dev). Not imported as `lucide-react` components, because the
 * same glyphs also have to reach MapLibre's hover popup, which takes an
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

/**
 * One table over both vocabularies (`TOWN_TAGS`, `ROAD_TAGS`): a glyph is a
 * glyph, and the row, the badge and the popup that draw one do not care which
 * list the label came from. The two vocabularies share no name.
 */
export const TAG_ICON: Record<TownTag | RoadTag, IconNode> = {
  // traffic-cone – the road is barred to cars
  carfree: [
    ["path", { d: "M16.05 10.966a5 2.5 0 0 1-8.1 0" }],
    [
      "path",
      {
        d: "m16.923 14.049 4.48 2.04a1 1 0 0 1 .001 1.831l-8.574 3.9a2 2 0 0 1-1.66 0l-8.574-3.91a1 1 0 0 1 0-1.83l4.484-2.04",
      },
    ],
    [
      "path",
      { d: "M16.949 14.14a5 2.5 0 1 1-9.9 0L10.063 3.5a2 2 0 0 1 3.874 0z" },
    ],
    ["path", { d: "M9.194 6.57a5 2.5 0 0 0 5.61 0" }],
  ],
  // trophy
  events: [
    ["path", { d: "M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2" }],
    ["path", { d: "M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2" }],
    ["path", { d: "M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3" }],
    ["path", { d: "M4 22h16" }],
    ["path", { d: "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" }],
    ["path", { d: "M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3" }],
  ],
  // snowflake
  glacier: [
    ["path", { d: "m10 20-1.25-2.5L6 18" }],
    ["path", { d: "M10 4 8.75 6.5 6 6" }],
    ["path", { d: "m14 20 1.25-2.5L18 18" }],
    ["path", { d: "m14 4 1.25 2.5L18 6" }],
    ["path", { d: "m17 21-3-6h-4" }],
    ["path", { d: "m17 3-3 6 1.5 3" }],
    ["path", { d: "M2 12h6.5L10 9" }],
    ["path", { d: "m20 10-1.5 2 1.5 2" }],
    ["path", { d: "M22 12h-6.5L14 15" }],
    ["path", { d: "m4 10 1.5 2L4 14" }],
    ["path", { d: "m7 21 3-6-1.5-3" }],
    ["path", { d: "m7 3 3 6h4" }],
  ],
  // chevrons-right-left – two walls closing in
  gorge: [
    ["path", { d: "m20 17-5-5 5-5" }],
    ["path", { d: "m4 17 5-5-5-5" }],
  ],
  // spline – the curve the hairpins are built for
  hairpins: [
    ["circle", { cx: "19", cy: "5", r: "2" }],
    ["circle", { cx: "5", cy: "19", r: "2" }],
    ["path", { d: "M5 17A12 12 0 0 1 17 5" }],
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
  // binoculars – built for the view
  panorama: [
    ["path", { d: "M10 10h4" }],
    ["path", { d: "M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3" }],
    [
      "path",
      {
        d: "M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z",
      },
    ],
    ["path", { d: "M 22 16 L 2 16" }],
    [
      "path",
      {
        d: "M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z",
      },
    ],
    ["path", { d: "M9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3" }],
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
  // dam
  reservoir: [
    [
      "path",
      {
        d: "M11 11.31c1.17.56 1.54 1.69 3.5 1.69 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
      },
    ],
    [
      "path",
      { d: "M11.75 18c.35.5 1.45 1 2.75 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" },
    ],
    ["path", { d: "M2 10h4" }],
    ["path", { d: "M2 14h4" }],
    ["path", { d: "M2 18h4" }],
    ["path", { d: "M2 6h4" }],
    [
      "path",
      {
        d: "M7 3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1L10 4a1 1 0 0 0-1-1z",
      },
    ],
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
  // grip – the cobbles under the tyre
  surface: [
    ["circle", { cx: "12", cy: "5", r: "1" }],
    ["circle", { cx: "19", cy: "5", r: "1" }],
    ["circle", { cx: "5", cy: "5", r: "1" }],
    ["circle", { cx: "12", cy: "12", r: "1" }],
    ["circle", { cx: "19", cy: "12", r: "1" }],
    ["circle", { cx: "5", cy: "12", r: "1" }],
    ["circle", { cx: "12", cy: "19", r: "1" }],
    ["circle", { cx: "19", cy: "19", r: "1" }],
    ["circle", { cx: "5", cy: "19", r: "1" }],
  ],
  // euro – a fee is charged
  toll: [
    ["path", { d: "M4 10h12" }],
    ["path", { d: "M4 14h9" }],
    [
      "path",
      {
        d: "M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2",
      },
    ],
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
  // flashlight – what an unlit tunnel asks for
  tunnels: [
    ["path", { d: "M12 13v1" }],
    [
      "path",
      {
        d: "M17 2a1 1 0 0 1 1 1v4a3 3 0 0 1-.6 1.8l-.6.8A4 4 0 0 0 16 12v8a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-8a4 4 0 0 0-.8-2.4l-.6-.8A3 3 0 0 1 6 7V3a1 1 0 0 1 1-1z",
      },
    ],
    ["path", { d: "M6 6h12" }],
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
export const tagIconSvg = (tag: TownTag | RoadTag, size = 12): string => {
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
