import { ImageResponse } from "next/og";
import { BRAND, MARK } from "@/lib/brand";

/**
 * Browser icon, generated at build time. The mark is the same ridge-and-col
 * figure as on the touch icon and the share image (see lib/brand.ts): two
 * summits, the col between them, an accent dot on the col. Everything else is
 * left out – at 16 px only those two strokes survive.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: BRAND.primary,
        borderRadius: "22%",
      }}
    >
      <svg width={size.width} height={size.height} viewBox="0 0 100 100">
        <path
          d={MARK.ridge}
          fill="none"
          stroke={BRAND.paper}
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={MARK.col.x}
          cy={MARK.col.y}
          r={13}
          fill={BRAND.accent}
          stroke={BRAND.primary}
          strokeWidth={6}
        />
      </svg>
    </div>,
    size,
  );
}
