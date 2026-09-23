import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { BRAND, SITE_NAME, siteUrl } from "@/lib/brand";
import { isLang, LANGS } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/server";
import { alternatesOf, homeHref } from "@/lib/routes";
import { openGraphOf } from "@/lib/share-text";

import { fontVariables } from "../fonts";

import "../globals.css";

/**
 * The two languages, prerendered from one tree (plan 08): the segment is
 * the root parameter, `next.config.ts` rewrites the prefix-free German
 * paths onto `/de`, and the English pages live under `/en`.
 */
export const generateStaticParams = () => LANGS.map((lang) => ({ lang }));

/**
 * The start page of each language: its title, description and keywords in
 * that language (`site` in the message files), its own canonical, the other
 * language as an alternate, German as the default for a visitor without a
 * match (`alternatesOf`). An entity route sets the same paths for its own.
 */
export const generateMetadata = async (): Promise<Metadata> => {
  const { lang, site } = await getDictionary();
  return {
    alternates: alternatesOf(lang, homeHref),
    appleWebApp: { capable: true, statusBarStyle: "default", title: SITE_NAME },
    applicationName: SITE_NAME,
    authors: [{ name: "Manuel Dugué", url: "https://manuel.fyi" }],
    category: "travel",
    creator: "Manuel Dugué",
    description: site.description,
    formatDetection: { telephone: false },
    keywords: [...site.keywords],
    // Absolute URLs for the share images; Vercel provides the production host.
    metadataBase: new URL(siteUrl),
    openGraph: openGraphOf(lang, {
      description: site.description,
      title: site.title,
      url: homeHref(lang),
    }),
    // Search engines are welcome; the crawlers that are not are turned away in
    // app/robots.ts.
    robots: { follow: true, index: true },
    title: {
      default: site.title,
      // Sub-pages set a bare title ("Impressum") and get the site name appended.
      template: `%s – ${SITE_NAME}`,
    },
    // The card type is all X needs of its own: the title, the text and the
    // image it reads from the Open Graph tags, on every page below this one.
    twitter: { card: "summary_large_image" },
  };
};

// Keep in sync with --background in app/globals.css (light / dark).
export const viewport: Viewport = {
  themeColor: [
    { color: BRAND.day, media: "(prefers-color-scheme: light)" },
    { color: BRAND.night, media: "(prefers-color-scheme: dark)" },
  ],
  viewportFit: "cover",
};

const RootLayout = async ({ children, params }: LayoutProps<"/[lang]">) => {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} className={fontVariables}>
      <body className="h-dvh overflow-hidden antialiased">{children}</body>
    </html>
  );
};

export default RootLayout;
