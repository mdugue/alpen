import { MARK } from "@/lib/brand";

/**
 * The mark as a badge, shared by the icon routes and the share image so all
 * three render from one piece of geometry (lib/brand.ts). Server-only: it is
 * drawn by Satori inside an `ImageResponse`, never in the browser.
 */
export function MarkBadge({
  size,
  /** `"22%"` for a rounded square, `"0"` where iOS or Android applies its own mask. */
  radius = MARK.radius,
  /** Share of the badge the summits occupy; below 1 they stay inside a maskable safe area. */
  inset = 1,
}: {
  size: number;
  radius?: string;
  inset?: number;
}) {
  const glyph = Math.round(size * inset);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: MARK.ground,
        borderRadius: radius,
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 100 100">
        {MARK.peaks.map((d) => (
          <path key={d} d={d} fill={MARK.rock} />
        ))}
        <path d={MARK.cap} fill={MARK.snow} />
      </svg>
    </div>
  );
}
