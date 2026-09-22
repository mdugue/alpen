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
import {
  isLang,
  LANGS,
  langOf,
  langParams,
  langPrefix,
  OG_LOCALE,
} from "@/lib/i18n";

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
export const generateStaticParams = () => langParams();

/**
 * The start page of each language: its own canonical, the other language as
 * an alternate, German as the default for a visitor without a match. An
 * entity route sets the same three for its own path.
 */
export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> => {
  const { lang: raw } = await params;
  const lang = langOf(raw);
  const home = langPrefix(lang) || "/";
  return {
    alternates: {
      canonical: home,
      languages: {
        ...Object.fromEntries(LANGS.map((l) => [l, langPrefix(l) || "/"])),
        "x-default": "/",
      },
    },
    openGraph: { locale: OG_LOCALE[lang], url: home },
  };
};

export const metadata: Metadata = {
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
    siteName: SITE_NAME,
    title: SITE_TITLE,
    type: "website",
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
