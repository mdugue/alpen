import { MARK } from "@/lib/brand";

/**
 * The mark as a badge, shared by the icon routes and the share image so all
 * three render from one piece of geometry (lib/brand.ts). Edge to edge at every
 * size: the two distant ridges are meant to run off the sides, and the range
 * only looks grounded while its baseline sits near the bottom of the badge.
 *
 * Server-only – drawn by Satori inside an `ImageResponse`, never in the browser.
 */
export const MarkBadge = ({
  size,
  /** `"22%"` for a rounded square, `"0"` where iOS applies its own mask. */
  radius = MARK.radius,
}: {
  size: number;
  radius?: string;
}) => (
  <div
    style={{
      background: MARK.ground,
      borderRadius: radius,
      display: "flex",
      height: size,
      width: size,
    }}
  >
    <svg width={size} height={size} viewBox="0 0 100 100">
      {MARK.ridges.map((r) => (
        <path key={r.d} d={r.d} fill={r.fill} />
      ))}
    </svg>
  </div>
);
