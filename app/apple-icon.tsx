import { ImageResponse } from "next/og";

import { MarkBadge } from "@/lib/mark";

/**
 * Home-screen icon for iOS and, via app/manifest.ts, for Android. Same badge as
 * app/icon.tsx, square-cut because iOS applies its own mask. It is not offered
 * as a maskable icon: the artwork runs edge to edge, and a circular crop would
 * cut the range off its baseline.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<MarkBadge size={size.width} radius="0" />, size);
}
