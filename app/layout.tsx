import type { Metadata, Viewport } from "next";
import { Inter, Oxanium } from "next/font/google";
import { BRAND, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, siteUrl } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const oxanium = Oxanium({ subsets: ["latin"], variable: "--font-oxanium", display: "swap" });

export const metadata: Metadata = {
  // Absolute URLs for the share images; Vercel provides the production host.
  metadataBase: new URL(siteUrl),
  title: {
    default: SITE_TITLE,
    // Sub-pages set a bare title ("Impressum") and get the site name appended.
    template: `%s – ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Manuel Dugué", url: "https://manuel.fyi" }],
  creator: "Manuel Dugué",
  category: "travel",
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
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  // Search engines are welcome; the crawlers that are not are turned away in
  // app/robots.ts.
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

// Keep in sync with --background in app/globals.css (light / dark).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.paper },
    { media: "(prefers-color-scheme: dark)", color: BRAND.night },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} ${oxanium.variable}`}>
      <body className="h-dvh overflow-hidden antialiased">{children}</body>
    </html>
  );
}
