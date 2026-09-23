import { Inter, Oxanium } from "next/font/google";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});
const oxanium = Oxanium({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-oxanium",
});

/**
 * The two faces as CSS variables, for the `<html>` of both root layouts – the
 * map's (`app/[lang]/layout.tsx`) and the knowledge base's
 * (`app/wissen/layout.tsx`), which share nothing else but the stylesheet.
 */
export const fontVariables = `${inter.variable} ${oxanium.variable}`;
