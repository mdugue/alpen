import { ImageResponse } from "next/og";
import { MarkBadge } from "@/lib/mark";

/**
 * Home-screen icon for iOS and, via app/manifest.ts, for Android. Same badge as
 * app/icon.tsx, but square-cut – both platforms apply their own mask – and with
 * the summits at 74 %, which keeps them inside the safe area a maskable icon
 * may be cropped to.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<MarkBadge size={size.width} radius="0" inset={0.74} />, size);
}
