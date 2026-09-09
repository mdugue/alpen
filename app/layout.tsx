import type { Metadata, Viewport } from "next";
import { Inter, Oxanium } from "next/font/google";

import {
  BRAND,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  siteUrl,
} from "@/lib/brand";

import "./globals.css";

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

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: SITE_NAME },
  applicationName: SITE_NAME,
  authors: [{ name: "Manuel Dugué", url: "https://manuel.fyi" }],
  category: "travel",
  creator: "Manuel Dugué",
  description: SITE_DESCRIPTION,
  formatDetection: { telephone: false },
  keywords: [
    "Alpenpässe",
    "Rennrad",
    "Rennradurlaub",
    "Radurlaub Alpen",
    "Passhöhen",
    "Rundtouren",
    "Höhenprofil",
    "Passöffnung",
    "Wann sind die Alpenpässe offen",
    "Radreiseziele",
  ],
  // Absolute URLs for the share images; Vercel provides the production host.
  metadataBase: new URL(siteUrl),
  openGraph: {
    description: SITE_DESCRIPTION,
    locale: "de_DE",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    type: "website",
    url: "/",
  },
  // Search engines are welcome; the crawlers that are not are turned away in
  // app/robots.ts.
  robots: { follow: true, index: true },
  title: {
    default: SITE_TITLE,
    // Sub-pages set a bare title ("Impressum") and get the site name appended.
    template: `%s – ${SITE_NAME}`,
  },
  twitter: {
    card: "summary_large_image",
    description: SITE_DESCRIPTION,
    title: SITE_TITLE,
  },
};

// Keep in sync with --background in app/globals.css (light / dark).
export const viewport: Viewport = {
  themeColor: [
    { color: BRAND.paper, media: "(prefers-color-scheme: light)" },
    { color: BRAND.night, media: "(prefers-color-scheme: dark)" },
  ],
  viewportFit: "cover",
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="de" className={`${inter.variable} ${oxanium.variable}`}>
    <body className="h-dvh overflow-hidden antialiased">{children}</body>
  </html>
);

export default RootLayout;
