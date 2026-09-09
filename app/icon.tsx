import { ImageResponse } from "next/og";

import { MarkBadge } from "@/lib/mark";

/**
 * Browser icon, generated at build time: two summits on amber, the main one
 * snow-capped (lib/brand.ts). The same badge appears on the touch icon and in
 * the share image, so a tab, a home screen and a link preview all show one
 * thing.
 */

export const size = { height: 32, width: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<MarkBadge size={size.width} />, size);
}
