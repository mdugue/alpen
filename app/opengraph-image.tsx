import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import passes from "@/data/passes.json";
import tours from "@/data/tours.json";
import towns from "@/data/towns.json";
import { BRAND, SITE_NAME } from "@/lib/brand";
import { MarkBadge } from "@/lib/mark";
import { periodLabel, passStatus, STATUS_LABEL } from "@/lib/status";
import type { Pass, Status } from "@/lib/types";
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

export const alt = `${SITE_NAME} – welche Pässe, Touren und Rad-Orte sind wann mit dem Rennrad befahrbar?`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const oxaniumBold = await readFile(join(process.cwd(), "assets/fonts/Oxanium-Bold.ttf"));
const oxaniumMedium = await readFile(join(process.cwd(), "assets/fonts/Oxanium-Medium.ttf"));

export default function Image() {
  // Equirectangular projection into the right two thirds of the canvas.
  const box = { x: 400, y: 70, w: 740, h: 500 };
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
      x: dx + (p.lon - lon0) * kx * scale,
      y: dy + (lat1 - p.lat) * scale,
      status: passStatus(p, PERIOD),
      r: 4.5 + p.fame * 2,
    }))
    // Small dots first, so the famous passes stay readable on top.
    .sort((a, b) => a.r - b.r);

  // Same words as the sidebar sections, so the preview and the app agree.
  const counts = [
    `${fmt(passes.length)} Pässe`,
    `${fmt(tours.length)} Touren`,
    `${fmt(towns.length)} Orte`,
  ].join(" · ");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: BRAND.paper,
        fontFamily: "Oxanium",
        color: BRAND.ink,
        position: "relative",
      }}
    >
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        style={{ position: "absolute", left: 0, top: 0 }}
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
          position: "absolute",
          left: 72,
          top: 68,
          display: "flex",
          flexDirection: "column",
          width: 330,
        }}
      >
        <MarkBadge size={62} />
        <div
          style={{
            marginTop: 22,
            fontSize: 54,
            fontWeight: 700,
            letterSpacing: 3,
            lineHeight: 1,
            color: BRAND.primary,
            textTransform: "uppercase",
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 30,
            fontWeight: 500,
            lineHeight: 1.3,
            color: BRAND.ink,
          }}
        >
          Welche Region lohnt sich wann?
        </div>
        <div style={{ marginTop: 14, fontSize: 20, fontWeight: 500, color: BRAND.muted }}>{counts}</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 72,
          bottom: 64,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          fontSize: 21,
          fontWeight: 500,
          color: BRAND.muted,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 4,
            fontSize: 17,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: BRAND.ink,
          }}
        >
          <div style={{ width: 26, height: 4, borderRadius: 999, background: BRAND.accent }} />
          <span>{periodLabel(PERIOD)}</span>
        </div>
        {(["open", "risky", "closed"] as Status[]).map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 14, height: 14, borderRadius: 999, background: BRAND.status[s] }} />
            <span>{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Oxanium", data: oxaniumBold, weight: 700, style: "normal" },
        { name: "Oxanium", data: oxaniumMedium, weight: 500, style: "normal" },
      ],
    },
  );
}
