import { readFile } from "node:fs/promises";
import path from "node:path";

import climateJson from "@/data/generated/climate.json";
import profilesJson from "@/data/generated/profiles.json";
import passes from "@/data/passes.json";
import { BRAND } from "@/lib/brand";
import { valleyElevations } from "@/lib/profile";
import { inputAt, passStatus, signalsOf } from "@/lib/status";
import type { Signals } from "@/lib/status";
import type { LatLon, Pass } from "@/lib/types";

/**
 * What the share images are made of (plan 02): the dot map – every pass at
 * its real position, coloured by rideability for one half-month, so the arc
 * of the Alps emerges on its own – and the fonts Satori needs as raw TTF.
 * `app/opengraph-image.tsx` draws the site's card from it, the entity route
 * draws one with the entity marked. Server-only: read by `ImageResponse`
 * at build time, never in the browser.
 */

/** Late October: the season's end, when all three colours show at once. */
export const SHARE_PERIOD = 10.5;

export const SHARE_SIZE = { height: 630, width: 1200 };

/**
 * The same signals the app reads (climate series, valley elevation), so the
 * dots agree with the list for the same half-month: without them a pass
 * that the heuristic calls limited for snow or a cold descent would show as
 * open here.
 */
const signals: Signals = {
  climate: climateJson,
  valleys: valleyElevations(passes, profilesJson),
};

/** A font file as the `ArrayBuffer` the image renderer parses. */
const fontFile = async (name: string): Promise<ArrayBuffer> => {
  const bytes = await readFile(path.join(process.cwd(), "assets/fonts", name));
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
};

/**
 * The two cuts of the brand face. Cached, because reading a file is IO and a
 * share image is rendered like a page under Cache Components: uncached IO in
 * it is an error rather than a slow render. Plain `ArrayBuffer`s, because a
 * `Buffer` comes back out of the cache as a bare typed array, which the
 * renderer's font parser refuses.
 */
export const shareFonts = async () => {
  "use cache";
  const [bold, medium] = await Promise.all([
    fontFile("Oxanium-Bold.ttf"),
    fontFile("Oxanium-Medium.ttf"),
  ]);
  return [
    {
      data: bold,
      name: "Oxanium",
      style: "normal" as const,
      weight: 700 as const,
    },
    {
      data: medium,
      name: "Oxanium",
      style: "normal" as const,
      weight: 500 as const,
    },
  ];
};

/** Equirectangular projection into the right two thirds of the canvas. */
const BOX = { h: 500, w: 740, x: 400, y: 70 };

export interface Dot {
  x: number;
  y: number;
  r: number;
  fill: string;
}

/**
 * The passes as dots, small ones first so the famous ones stay readable on
 * top, and a projection for anything else that has to land on the same map.
 */
export const dotMap = () => {
  const all = passes as Pass[];
  const lats = all.map((p) => p.lat);
  const lons = all.map((p) => p.lon);
  const lat0 = Math.min(...lats);
  const lat1 = Math.max(...lats);
  const lon0 = Math.min(...lons);
  const lon1 = Math.max(...lons);
  const kx = Math.cos(((lat0 + lat1) / 2) * (Math.PI / 180));
  const scale = Math.min(BOX.w / ((lon1 - lon0) * kx), BOX.h / (lat1 - lat0));
  const dx = BOX.x + (BOX.w - (lon1 - lon0) * kx * scale) / 2;
  const dy = BOX.y + (BOX.h - (lat1 - lat0) * scale) / 2;
  const project = (at: LatLon) => ({
    x: dx + (at.lon - lon0) * kx * scale,
    y: dy + (lat1 - at.lat) * scale,
  });
  const dots: Dot[] = all
    .map((p) => ({
      ...project(p),
      fill: BRAND.status[
        passStatus(
          p,
          SHARE_PERIOD,
          inputAt(signalsOf(signals, p.slug), SHARE_PERIOD),
        )
      ],
      r: 4.5 + p.fame * 2,
    }))
    .toSorted((a, b) => a.r - b.r);
  return { dots, project };
};

/** The dot map as an SVG layer over the whole card. */
export const DotLayer = ({
  dots,
  mark,
}: {
  dots: Dot[];
  /** A ring around one point – the entity a card is about. */
  mark?: { x: number; y: number } | null;
}) => (
  <svg
    width={SHARE_SIZE.width}
    height={SHARE_SIZE.height}
    viewBox={`0 0 ${SHARE_SIZE.width} ${SHARE_SIZE.height}`}
    style={{ left: 0, position: "absolute", top: 0 }}
  >
    {dots.map((d, i) => (
      <circle
        key={i}
        cx={d.x}
        cy={d.y}
        r={d.r}
        fill={d.fill}
        stroke={BRAND.day}
        strokeWidth={2.5}
      />
    ))}
    {mark && (
      <circle
        cx={mark.x}
        cy={mark.y}
        r={22}
        fill="none"
        stroke={BRAND.accent}
        strokeWidth={5}
      />
    )}
  </svg>
);
