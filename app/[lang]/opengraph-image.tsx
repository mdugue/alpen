import { ImageResponse } from "next/og";

import passes from "@/data/passes.json";
import tours from "@/data/tours.json";
import towns from "@/data/towns.json";
import { BRAND, SITE_NAME } from "@/lib/brand";
import { langOf, langParams, messagesOf } from "@/lib/i18n";
import { MarkBadge } from "@/lib/mark";
import { periodLabel } from "@/lib/period";
import {
  DotLayer,
  dotMap,
  SHARE_PERIOD,
  SHARE_SIZE,
  shareFonts,
} from "@/lib/share-image";
import { STATUS_ORDER, statusLabel } from "@/lib/status";
import { fmt } from "@/lib/utils";

/**
 * Share image, rendered once at build time. The graphic is the data itself:
 * every pass as a dot at its real position, coloured by rideability for one
 * half-month – the arc of the Alps emerges on its own (`lib/share-image.tsx`,
 * which the entity routes draw from too). The lockup (mark, wordmark,
 * accent) is the one from lib/brand.ts, so a link preview and the browser
 * tab show the same thing. One per language (plan 08): the words on it come
 * from the message files, the dots are the same.
 */
export const generateStaticParams = () => langParams();

// A static export, so one text for both languages: Next reads `alt` from the
// module, not from the params.
export const alt = `${SITE_NAME} – welche Pässe, Touren und Rad-Orte sind wann mit dem Rennrad befahrbar?`;
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = langOf(raw);
  const { share } = messagesOf(lang);
  const { dots } = dotMap();
  // Same words as the sidebar sections, so the preview and the app agree.
  const counts = share.counts(
    fmt(passes.length, 0, lang),
    fmt(tours.length, 0, lang),
    fmt(towns.length, 0, lang),
  );

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
          {share.headline}
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
          <span>{periodLabel(SHARE_PERIOD, lang)}</span>
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
            <span>{statusLabel(s, lang)}</span>
          </div>
        ))}
      </div>
    </div>,
    { ...size, fonts: await shareFonts() },
  );
}
