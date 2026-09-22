import type { Metadata, Viewport } from "next";
import { Inter, Oxanium } from "next/font/google";
import { notFound } from "next/navigation";

import {
  BRAND,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  siteUrl,
} from "@/lib/brand";
import { isLang, LANGS, langPrefix, OG_LOCALE } from "@/lib/i18n";

import "../globals.css";

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
 * The two languages, prerendered from one tree (plan 08): the segment is
 * the root parameter, `next.config.ts` rewrites the prefix-free German
 * paths onto `/de`, and the English pages live under `/en`.
 */
export const generateStaticParams = () => LANGS.map((lang) => ({ lang }));

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: Object.fromEntries(LANGS.map((l) => [l, `${langPrefix(l)}/`])),
  },
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
    locale: OG_LOCALE.de,
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
    { color: BRAND.day, media: "(prefers-color-scheme: light)" },
    { color: BRAND.night, media: "(prefers-color-scheme: dark)" },
  ],
  viewportFit: "cover",
};

const RootLayout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) => {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} className={`${inter.variable} ${oxanium.variable}`}>
      <body className="h-dvh overflow-hidden antialiased">{children}</body>
    </html>
  );
};

export default RootLayout;
