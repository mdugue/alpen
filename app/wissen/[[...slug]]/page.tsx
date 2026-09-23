import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  FileCodeIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SITE_NAME } from "@/lib/brand";
import { descriptionOf } from "@/lib/docs/content";
import { DEV_INDEX } from "@/lib/docs/nav";
import {
  langOf,
  routeOf,
  segmentsOf,
  sourceUrl,
  WISSEN,
  WISSEN_DEV,
} from "@/lib/docs/routes";
import { cn } from "@/lib/utils";

import { docIcon } from "../_components/doc-icon";
import { DocNav, SECTION_LABEL } from "../_components/doc-nav";
import { DevRow, Landing } from "../_components/landing";
import { RoadSketch } from "../_components/road-sketch";
import {
  descriptionFor,
  devEntries,
  nav,
  neighbours,
  pageFiles,
  placeAt,
  rangeSketch,
  readDoc,
  regionSketch,
  titleFor,
} from "../_lib/docs";
import type { Place } from "../_lib/docs";
import { renderDoc } from "../_lib/markdown";
import type { TocEntry } from "../_lib/markdown";

interface Props {
  params: Promise<{ slug?: string[] }>;
}

/** Every page of the knowledge base, prerendered; nothing renders per request. */
export const generateStaticParams = () => [
  { slug: [] },
  { slug: segmentsOf(WISSEN_DEV) },
  ...pageFiles().map((file) => ({ slug: segmentsOf(routeOf(file) ?? "") })),
];

const placeOf = async (params: Props["params"]): Promise<Place | null> => {
  const { slug = [] } = await params;
  return placeAt(slug);
};

const DEV_TITLE = "Entwicklerdokumentation";
const DEV_LEAD =
  "Wie die App gebaut ist, auf Englisch: AGENTS.md ist der Index, und die Dokumente hier sind die, die er aufführt.";
const ENTRY_LEAD =
  "Woher die Daten der Alpenpässe-Karte kommen, wie Skalen und Status entstehen und was davon redaktionell eingeschätzt ist.";

/** Title, description and address of a place, for the metadata. */
const headOf = (
  place: Place,
): { title: string; description: string | null; route: string } => {
  if (place.kind === "entry") {
    return { description: ENTRY_LEAD, route: WISSEN, title: "Wissen" };
  }
  if (place.kind === "dev") {
    return {
      description: DEV_LEAD,
      route: WISSEN_DEV,
      title: `${DEV_TITLE} · Wissen`,
    };
  }
  return {
    description: descriptionOf(readDoc(place.file)),
    route: routeOf(place.file) ?? WISSEN,
    title: `${titleFor(place.file)} · Wissen`,
  };
};

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  const place = await placeOf(params);
  if (!place) {
    return {};
  }
  const { description, route, title } = headOf(place);
  return {
    alternates: { canonical: route },
    description: description ?? undefined,
    openGraph: {
      description: description ?? undefined,
      locale: "de_DE",
      siteName: SITE_NAME,
      title,
      type: "article",
      url: route,
    },
    title,
  };
};

/** /wissen: the landing, built from the guide's index and AGENTS.md. */
const Entry = async () => {
  "use cache";
  const guide = nav().find((g) => g.id === "guide")?.items ?? [];
  return (
    <Landing
      developer={devEntries()}
      guide={guide.map((i) => ({
        description: descriptionFor(i.file),
        file: i.file,
        href: i.href,
        title: i.title,
      }))}
      range={rangeSketch()}
    />
  );
};

/** A strip of the range above a page, a different region per page. */
const Cover = ({ file, kicker }: { file: string; kicker: string }) => (
  <div className="bg-card ring-foreground/10 relative isolate mb-10 flex h-28 items-end overflow-hidden rounded-xl ring-1 sm:h-32">
    <RoadSketch
      className="absolute inset-0 -z-20 size-full"
      fill
      sketch={regionSketch(file)}
    />
    <div className="wissen-cover-veil absolute inset-0 -z-10" />
    <div className="flex items-center gap-2.5 p-4">
      <span className="bg-background/85 ring-foreground/10 flex size-8 items-center justify-center rounded-lg ring-1 backdrop-blur">
        {docIcon(file, { className: "size-4" })}
      </span>
      <span className={cn(SECTION_LABEL, "text-foreground/70")}>{kicker}</span>
    </div>
  </div>
);

/** The page frame: the menu, the page, and what is on it. */
const Frame = ({
  children,
  current,
  toc,
}: {
  children: ReactNode;
  current: string;
  toc: TocEntry[];
}) => {
  const groups = nav();
  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-7xl flex-1 gap-x-12 px-4 lg:grid-cols-[15rem_minmax(0,1fr)]",
        toc.length > 1 && "xl:grid-cols-[15rem_minmax(0,1fr)_13rem]",
      )}
    >
      <aside className="hidden lg:block">
        <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-8 pr-2">
          <DocNav current={current} groups={groups} />
        </div>
      </aside>

      <main className="min-w-0 py-8 lg:py-10">
        <details className="group/menu mb-8 rounded-lg border lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium">
            Inhalt
            <ChevronDownIcon className="size-4 opacity-50 transition-transform group-open/menu:rotate-180" />
          </summary>
          <div className="border-t px-1 py-4">
            <DocNav current={current} groups={groups} />
          </div>
        </details>
        {children}
      </main>

      {toc.length > 1 ? (
        <aside className="hidden xl:block">
          <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-10">
            <span className={cn(SECTION_LABEL, "mb-3 block")}>
              Auf dieser Seite
            </span>
            <ul className="flex flex-col gap-1.5 border-l text-xs leading-snug">
              {toc.map((entry) => (
                <li key={entry.id}>
                  <a
                    className={cn(
                      "text-muted-foreground hover:border-foreground/40 hover:text-foreground -ml-px block border-l border-transparent pl-3",
                      entry.depth === 3 && "pl-6",
                    )}
                    href={`#${entry.id}`}
                  >
                    {entry.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      ) : null}
    </div>
  );
};

/** One end of the pager: the neighbouring page as a card, whole card the link. */
const PagerCard = ({
  direction,
  href,
  title,
}: {
  direction: "prev" | "next";
  href: string;
  title: string;
}) => {
  const next = direction === "next";
  return (
    <Card
      className="group/pager hover:ring-accent/60 relative transition-shadow hover:shadow-md"
      size="sm"
    >
      <CardHeader className={cn(next && "justify-items-end text-right")}>
        <CardDescription className="flex items-center gap-1.5">
          {next ? (
            <>
              Weiter
              <ArrowRightIcon className="size-3.5 transition-transform group-hover/pager:translate-x-0.5" />
            </>
          ) : (
            <>
              <ArrowLeftIcon className="size-3.5 transition-transform group-hover/pager:-translate-x-0.5" />
              Zurück
            </>
          )}
        </CardDescription>
        <CardTitle>
          <Link className="after:absolute after:inset-0" href={href}>
            {title}
          </Link>
        </CardTitle>
      </CardHeader>
    </Card>
  );
};

/** /wissen/dev: the documents table of AGENTS.md, as a page. */
const DevIndex = async () => {
  "use cache";
  return (
    <Frame current={WISSEN_DEV} toc={[]}>
      <Cover file={DEV_INDEX} kicker="Entwicklung · Englisch" />
      <div className="typeset typeset-wissen">
        <h1>{DEV_TITLE}</h1>
        <p>
          {DEV_LEAD} Wer die Karte benutzt und wissen will, was sie zeigt, ist
          im <Link href={WISSEN}>Leitfaden</Link> besser aufgehoben.
        </p>
      </div>
      <ul className="mt-8 flex flex-col gap-1">
        {devEntries().map((entry) => (
          <li key={entry.file}>
            <DevRow entry={entry} />
          </li>
        ))}
      </ul>
      <footer className="text-muted-foreground mt-16 border-t pt-5 text-xs">
        <a
          className="hover:text-foreground inline-flex items-center gap-1.5"
          href={sourceUrl(DEV_INDEX)}
          rel="noopener"
        >
          <FileCodeIcon className="size-3.5" />
          Quelle auf GitHub: <span className="font-mono">AGENTS.md</span>
        </a>
      </footer>
    </Frame>
  );
};

/**
 * One page, rendered once at build time. Cached because the Markdown pipeline
 * reads the clock on its way (Cache Components refuses that in a prerender
 * otherwise), and its output only changes with the file.
 */
const DocPage = async ({ file }: { file: string }) => {
  "use cache";
  const route = routeOf(file) ?? WISSEN;
  const { content, toc } = await renderDoc(
    file,
    readDoc(file),
    new Set(pageFiles()),
  );
  const place = neighbours(file);
  const kicker = place
    ? place.group.id === "dev"
      ? "Entwicklung · Englisch"
      : `${place.group.label} · ${place.index + 1} / ${place.count}`
    : "Wissen";

  return (
    <Frame current={route} toc={toc}>
      <Cover file={file} kicker={kicker} />
      <article className="typeset typeset-wissen" lang={langOf(file)}>
        {content}
      </article>

      {place && (place.prev || place.next) ? (
        <nav
          aria-label="Weiterlesen"
          className="mt-16 grid gap-3 sm:grid-cols-2"
        >
          {place.prev ? (
            <PagerCard
              direction="prev"
              href={place.prev.href}
              title={place.prev.title}
            />
          ) : (
            <span />
          )}
          {place.next ? (
            <PagerCard
              direction="next"
              href={place.next.href}
              title={place.next.title}
            />
          ) : null}
        </nav>
      ) : null}

      <footer className="text-muted-foreground mt-16 border-t pt-5 text-xs">
        <a
          className="hover:text-foreground inline-flex items-center gap-1.5"
          href={sourceUrl(file)}
          rel="noopener"
        >
          <FileCodeIcon className="size-3.5" />
          Quelle auf GitHub: <span className="font-mono">{file}</span>
        </a>
      </footer>
    </Frame>
  );
};

const WissenPage = async ({ params }: Props) => {
  const place = await placeOf(params);
  if (!place) {
    notFound();
  }
  if (place.kind === "entry") {
    return <Entry />;
  }
  return place.kind === "dev" ? <DevIndex /> : <DocPage file={place.file} />;
};

export default WissenPage;
