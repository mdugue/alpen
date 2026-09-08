import { ImageResponse } from "next/og";
import { BRAND, MARK } from "@/lib/brand";

/**
 * Home-screen icon for iOS and, via app/manifest.ts, for Android. Same mark as
 * app/icon.tsx, but full-bleed and without rounded corners – both platforms
 * apply their own mask. The mark stays inside the middle 72 %, which is the
 * safe area a maskable icon may be cropped to.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const mark = Math.round(size.width * 0.72);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND.primary,
      }}
    >
      <svg width={mark} height={mark} viewBox="0 0 100 100">
        <path
          d={MARK.ridge}
          fill="none"
          stroke={BRAND.paper}
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={MARK.col.x}
          cy={MARK.col.y}
          r={12}
          fill={BRAND.accent}
          stroke={BRAND.primary}
          strokeWidth={5}
        />
      </svg>
    </div>,
    size,
  );
}
