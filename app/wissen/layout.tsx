import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/brand";

// Only these pages carry prose, so the map's page never loads either sheet.
// typeset.css adds to the `components` layer globals.css has already opened.
import "../typeset.css";
import "./wissen.css";

/**
 * The knowledge base: docs/ rendered as pages (docs/architecture.md, "The
 * docs are the site"). A plain scrolling document in the app's type and
 * colours – no map, no shell. The root layout pins the body to the viewport
 * for the map, so this box is what scrolls, like the legal pages.
 */
const WissenLayout = ({ children }: { children: ReactNode }) => (
  <div className="text-foreground flex h-dvh flex-col overflow-y-auto bg-(--wissen-paper)">
    <header className="sticky top-0 z-20 border-b bg-(--wissen-paper)/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2.5 px-4">
        <Link className="flex items-center gap-2.5 whitespace-nowrap" href="/">
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
);

export default WissenLayout;
