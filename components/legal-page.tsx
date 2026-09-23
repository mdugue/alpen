import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getDictionary } from "@/lib/i18n/server";
import { alternatesOf, homeHref, legalHref } from "@/lib/routes";
import type { LegalPage } from "@/lib/routes";
import { openGraphOf } from "@/lib/share-text";

/** Which title of `legal` each page carries. */
const TITLE = { datenschutz: "privacy", impressum: "imprint" } as const;

/** A legal page's metadata: its own title and paths, and never indexed. */
export const legalMetadata = async (page: LegalPage): Promise<Metadata> => {
  const { lang, legal } = await getDictionary();
  const title = legal[TITLE[page]];
  return {
    alternates: alternatesOf(lang, (l) => legalHref(page, l)),
    openGraph: openGraphOf(lang, { title, url: legalHref(page, lang) }),
    robots: { index: false },
    // The site name is appended by the title template in app/[lang]/layout.tsx.
    title,
  };
};

/**
 * The frame of the two legal pages. What is around the text – the way back
 * to the map, the note an English reader gets, the link to the other page –
 * is in the page's language; the text itself is German in both, the binding
 * one, and marked as German so a screen reader on `/en` reads it with a
 * German voice.
 */
export const LegalFrame = async ({
  page,
  children,
}: {
  page: LegalPage;
  /** The German text, headline included. */
  children: React.ReactNode;
}) => {
  const { backToMap, lang, legal } = await getDictionary();
  const other: LegalPage = page === "impressum" ? "datenschutz" : "impressum";
  return (
    <main className="bg-background text-foreground h-dvh overflow-y-auto px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <Link
          href={homeHref(lang)}
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          {backToMap}
        </Link>
        {legal.englishNote && (
          <p className="text-muted-foreground text-sm">{legal.englishNote}</p>
        )}
        <div lang="de" className="flex flex-col gap-8">
          {children}
        </div>
        <p className="text-muted-foreground text-xs">
          {legal.seeAlso}{" "}
          <Link href={legalHref(other, lang)} className="underline">
            {legal[TITLE[other]]}
          </Link>
        </p>
      </div>
    </main>
  );
};
