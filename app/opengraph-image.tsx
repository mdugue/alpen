import { ImageResponse } from "next/og";

import passes from "@/data/passes.json";
import tours from "@/data/tours.json";
import towns from "@/data/towns.json";
import { BRAND, SITE_NAME } from "@/lib/brand";
import { MarkBadge } from "@/lib/mark";
import { periodLabel } from "@/lib/period";
import {
  DotLayer,
  dotMap,
  SHARE_PERIOD,
  SHARE_SIZE,
  shareFonts,
} from "@/lib/share-image";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/status";
import { fmt } from "@/lib/utils";

/**
 * Share image, rendered once at build time. The graphic is the data itself:
 * every pass as a dot at its real position, coloured by rideability for one
 * half-month – the arc of the Alps emerges on its own (`lib/share-image.tsx`,
 * which the entity routes draw from too). The lockup (mark, wordmark,
 * accent) is the one from lib/brand.ts, so a link preview and the browser
 * tab show the same thing.
 */

export const alt = `${SITE_NAME} – welche Pässe, Touren und Rad-Orte sind wann mit dem Rennrad befahrbar?`;
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const { dots } = dotMap();
  // Same words as the sidebar sections, so the preview and the app agree.
  const counts = [
    `${fmt(passes.length)} Pässe`,
    `${fmt(tours.length)} Touren`,
    `${fmt(towns.length)} Orte`,
  ].join(" · ");

  return new ImageResponse(
    <div
      style={{
        background: BRAND.day,
        color: BRAND.ink,
        display: "flex",
        fontFamily: "Oxanium",
        height: "100%",
        position: "relative",
        width: "100%",
      }}
    >
      <DotLayer dots={dots} />

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
          <span>{periodLabel(SHARE_PERIOD)}</span>
        </div>
        {STATUS_ORDER.map((s) => (
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
    { ...size, fonts: await shareFonts() },
  );
}
