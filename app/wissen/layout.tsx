import { ArrowRightIcon } from "lucide-react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { BRAND, SITE_NAME, siteUrl } from "@/lib/brand";

import { fontVariables } from "../fonts";

import "../globals.css";
// Only these pages carry prose, so the map's page never loads either sheet.
// typeset.css adds to the `components` layer globals.css has already opened.
import "../typeset.css";
import "./wissen.css";

/**
 * What the map's root layout says about the site, for the pages that are not
 * the map: absolute share URLs, the title template, the scheme colours.
 */
export const metadata: Metadata = {
  applicationName: SITE_NAME,
  metadataBase: new URL(siteUrl),
  robots: { follow: true, index: true },
  title: { default: `Wissen – ${SITE_NAME}`, template: `%s – ${SITE_NAME}` },
};

// Keep in sync with --background in app/globals.css (light / dark).
export const viewport: Viewport = {
  themeColor: [
    { color: BRAND.day, media: "(prefers-color-scheme: light)" },
    { color: BRAND.night, media: "(prefers-color-scheme: dark)" },
  ],
  viewportFit: "cover",
};

/**
 * The knowledge base: docs/ rendered as pages (docs/architecture.md, "The
 * docs are the site"). A plain scrolling document in the app's type and
 * colours – no map, no shell. A root layout of its own, beside
 * `app/[lang]/`: the pages are German (the guide) and developer English, one
 * path each, so they stay out of the language segment and its rewrite. The
 * body is pinned to the viewport like the map's, so this box is what scrolls.
 */
const WissenLayout = ({ children }: { children: ReactNode }) => (
  <html lang="de" className={fontVariables}>
    <body className="h-dvh overflow-hidden antialiased">
      <div className="text-foreground flex h-dvh flex-col overflow-y-auto bg-(--wissen-paper)">
        <header className="sticky top-0 z-20 border-b bg-(--wissen-paper)/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-2.5 px-4">
            <Link
              className="flex items-center gap-2.5 whitespace-nowrap"
              href="/"
            >
              <span aria-hidden className="bg-accent h-5 w-1 rounded-full" />
              <span className="font-heading text-sm font-bold tracking-wide uppercase">
                {SITE_NAME}
              </span>
            </Link>
            <span aria-hidden className="text-muted-foreground/60">
              /
            </span>
            <Link
              className="hover:text-foreground/70 text-sm font-medium"
              href="/wissen"
            >
              Wissen
            </Link>
            <Link
              className={buttonVariants({
                className: "ml-auto",
                size: "lg",
                variant: "outline",
              })}
              href="/"
            >
              Zur Karte
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </body>
  </html>
);

export default WissenLayout;
