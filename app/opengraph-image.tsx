import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import climateJson from "@/data/generated/climate.json";
import profilesJson from "@/data/generated/profiles.json";
import passes from "@/data/passes.json";
import tours from "@/data/tours.json";
import towns from "@/data/towns.json";
import { BRAND, SITE_NAME } from "@/lib/brand";
import { MarkBadge } from "@/lib/mark";
import { valleyElevations } from "@/lib/profile";
import {
  inputAt,
  periodLabel,
  passStatus,
  signalsOf,
  STATUS_LABEL,
} from "@/lib/status";
import type { Signals } from "@/lib/status";
import type { ClimateYear, ElevationProfile, Pass, Status } from "@/lib/types";
import { fmt } from "@/lib/utils";

/**
 * Share image, rendered once at build time. The graphic is the data itself:
 * every pass as a dot at its real position, coloured by rideability for one
 * half-month – the arc of the Alps emerges on its own. The lockup (mark,
 * wordmark, accent) is the one from lib/brand.ts, so a link preview and the
 * browser tab show the same thing. Fonts come from assets/fonts (Oxanium,
 * OFL); Satori needs raw TTF data.
 */

/** Late October: the season's end, when all three colours show at once. */
const PERIOD = 10.5;

/**
 * The same signals the app reads (climate series, valley elevation), so the
 * dots agree with the list for the same half-month: without them a pass
 * that the heuristic calls limited for snow or a cold descent would show as
 * open here.
 */
const signals: Signals = {
  climate: climateJson as unknown as Record<string, ClimateYear>,
  valleys: valleyElevations(
    passes as Pass[],
    profilesJson as unknown as Record<string, ElevationProfile>,
  ),
};

export const alt = `${SITE_NAME} – welche Pässe, Touren und Rad-Orte sind wann mit dem Rennrad befahrbar?`;
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

const oxaniumBold = await readFile(
  path.join(process.cwd(), "assets/fonts/Oxanium-Bold.ttf"),
);
const oxaniumMedium = await readFile(
  path.join(process.cwd(), "assets/fonts/Oxanium-Medium.ttf"),
);

/** Equirectangular projection into the right two thirds of the canvas. */
const box = { h: 500, w: 740, x: 400, y: 70 };

export default function Image() {
  const lats = (passes as Pass[]).map((p) => p.lat);
  const lons = (passes as Pass[]).map((p) => p.lon);
  const lat0 = Math.min(...lats);
  const lat1 = Math.max(...lats);
  const lon0 = Math.min(...lons);
  const lon1 = Math.max(...lons);
  const kx = Math.cos(((lat0 + lat1) / 2) * (Math.PI / 180));
  const scale = Math.min(box.w / ((lon1 - lon0) * kx), box.h / (lat1 - lat0));
  const dx = box.x + (box.w - (lon1 - lon0) * kx * scale) / 2;
  const dy = box.y + (box.h - (lat1 - lat0) * scale) / 2;
  const dots = (passes as Pass[])
    .map((p) => ({
      r: 4.5 + p.fame * 2,
      status: passStatus(
        p,
        PERIOD,
        inputAt(signalsOf(signals, p.slug), PERIOD),
      ),
      x: dx + (p.lon - lon0) * kx * scale,
      y: dy + (lat1 - p.lat) * scale,
    }))
    // Small dots first, so the famous passes stay readable on top.
    .toSorted((a, b) => a.r - b.r);

  // Same words as the sidebar sections, so the preview and the app agree.
  const counts = [
    `${fmt(passes.length)} Pässe`,
    `${fmt(tours.length)} Touren`,
    `${fmt(towns.length)} Orte`,
  ].join(" · ");

  return new ImageResponse(
    <div
      style={{
        background: BRAND.paper,
        color: BRAND.ink,
        display: "flex",
        fontFamily: "Oxanium",
        height: "100%",
        position: "relative",
        width: "100%",
      }}
    >
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        style={{ left: 0, position: "absolute", top: 0 }}
      >
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.r}
            fill={BRAND.status[d.status]}
            stroke={BRAND.paper}
            strokeWidth={2.5}
          />
        ))}
      </svg>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          left: 72,
          position: "absolute",
          top: 68,
          width: 330,
        }}
      >
        <MarkBadge size={62} />
        <div
          style={{
            color: BRAND.primary,
            fontSize: 54,
            fontWeight: 700,
            letterSpacing: 3,
            lineHeight: 1,
            marginTop: 22,
            textTransform: "uppercase",
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            color: BRAND.ink,
            fontSize: 30,
            fontWeight: 500,
            lineHeight: 1.3,
            marginTop: 20,
          }}
        >
          Welche Region lohnt sich wann?
        </div>
        <div
          style={{
            color: BRAND.muted,
            fontSize: 20,
            fontWeight: 500,
            marginTop: 14,
          }}
        >
          {counts}
        </div>
      </div>

      <div
        style={{
          bottom: 64,
          color: BRAND.muted,
          display: "flex",
          flexDirection: "column",
          fontSize: 21,
          fontWeight: 500,
          gap: 10,
          left: 72,
          position: "absolute",
        }}
      >
        <div
          style={{
            alignItems: "center",
            color: BRAND.ink,
            display: "flex",
            fontSize: 17,
            gap: 12,
            letterSpacing: 2,
            marginBottom: 4,
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              background: BRAND.accent,
              borderRadius: 999,
              height: 4,
              width: 26,
            }}
          />
          <span>{periodLabel(PERIOD)}</span>
        </div>
        {(["open", "risky", "closed"] as Status[]).map((s) => (
          <div
            key={s}
            style={{ alignItems: "center", display: "flex", gap: 12 }}
          >
            <div
              style={{
                background: BRAND.status[s],
                borderRadius: 999,
                height: 14,
                width: 14,
              }}
            />
            <span>{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { data: oxaniumBold, name: "Oxanium", style: "normal", weight: 700 },
        { data: oxaniumMedium, name: "Oxanium", style: "normal", weight: 500 },
      ],
    },
  );
}
