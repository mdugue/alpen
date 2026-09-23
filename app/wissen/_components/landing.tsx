import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Sketch } from "@/lib/docs/sketch";
import { cn } from "@/lib/utils";

import type { DevEntry } from "../_lib/docs";
import { docIcon } from "./doc-icon";
import { SECTION_LABEL } from "./doc-nav";
import { RoadSketch } from "./road-sketch";

export interface GuideEntry {
  file: string;
  href: string;
  title: string;
  description: string | null;
}

const GuideCard = ({
  entry,
  number,
}: {
  entry: GuideEntry;
  number: number;
}) => (
  <Card className="group/entry hover:ring-accent/60 relative h-full transition-shadow hover:shadow-md">
    <CardHeader>
      <CardTitle className="text-base leading-snug">
        {/* Stretched over the card, so the whole card is the link. */}
        <Link className="after:absolute after:inset-0" href={entry.href}>
          {entry.title}
        </Link>
      </CardTitle>
      {entry.description ? (
        <CardDescription className="line-clamp-3">
          {entry.description}
        </CardDescription>
      ) : null}
      <CardAction className="bg-accent/20 text-foreground flex size-9 items-center justify-center rounded-lg">
        {docIcon(entry.file, { className: "size-4" })}
      </CardAction>
    </CardHeader>
    <CardFooter className="mt-auto gap-2">
      <span className="text-muted-foreground font-mono tabular-nums">
        {String(number).padStart(2, "0")}
      </span>
      <span className="inline-flex items-center gap-1 font-medium">
        Lesen
        <ArrowRightIcon className="size-3.5 transition-transform group-hover/entry:translate-x-0.5" />
      </span>
    </CardFooter>
  </Card>
);

/** One developer document: its title, and what AGENTS.md says it answers. */
export const DevRow = ({ entry }: { entry: DevEntry }) => {
  const body = (
    <>
      {docIcon(entry.file, {
        className:
          "text-muted-foreground group-hover/dev:text-foreground mt-0.5 size-4 shrink-0",
      })}
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-medium">
          {entry.title}
          {entry.external ? (
            <ArrowUpRightIcon className="text-muted-foreground size-3.5" />
          ) : null}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
          {entry.answers}
        </span>
      </span>
    </>
  );
  const className =
    "group/dev hover:bg-card hover:ring-foreground/10 -mx-3 flex gap-3 rounded-lg px-3 py-3 hover:ring-1";
  return entry.external ? (
    <a className={className} href={entry.href} lang="en" rel="noopener">
      {body}
    </a>
  ) : (
    <Link className={className} href={entry.href} lang="en">
      {body}
    </Link>
  );
};

/**
 * The entry of /wissen: the range as the app's roads draw it, then the guide
 * as cards and the developer docs as AGENTS.md lists them. Titles and
 * descriptions are read from the pages and the table themselves
 * (lib/docs/content.ts, lib/docs/nav.ts); only the lead is written here.
 */
export const Landing = ({
  developer,
  guide,
  range,
}: {
  developer: DevEntry[];
  guide: GuideEntry[];
  range: Sketch;
}) => {
  const [first] = guide;
  return (
    <main className="flex-1">
      <section className="relative isolate overflow-hidden border-b">
        <RoadSketch
          className="absolute inset-y-0 right-0 -z-20 h-full w-full sm:w-[72%]"
          sketch={range}
        />
        <div className="wissen-hero-veil absolute inset-0 -z-10" />
        <div className="mx-auto max-w-7xl px-4 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <p
            className={cn(
              SECTION_LABEL,
              "text-foreground flex items-center gap-2",
            )}
          >
            <span aria-hidden className="bg-accent h-4 w-1 rounded-full" />
            Wissen
          </p>
          <h1 className="font-heading mt-4 max-w-2xl text-4xl leading-tight font-bold tracking-wide text-balance sm:text-5xl">
            Was hinter der Karte steckt
          </h1>
          <p className="text-foreground/75 mt-5 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
            Jede Linie ist eine Auffahrt, jeder Punkt eine Passhöhe. Hier steht,
            woher die Daten kommen, wie Skalen und Status entstehen und was
            davon gemessen, abgeleitet oder redaktionell eingeschätzt ist.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {first ? (
              <Link
                className={buttonVariants({ className: "h-9 px-3.5 text-sm" })}
                href={first.href}
              >
                Leitfaden lesen
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            ) : null}
            <Link
              className={buttonVariants({
                className: "bg-background/70 h-9 px-3.5 text-sm backdrop-blur",
                variant: "outline",
              })}
              href="/"
            >
              Zur Karte
            </Link>
          </div>
        </div>
        <p className="text-foreground/55 text-2xs absolute right-4 bottom-2.5 max-w-[60%] text-right leading-snug">
          Im Hintergrund: jede Auffahrt der App, gezeichnet aus ihren eigenen
          Routendaten · Straßen © OpenStreetMap-Mitwirkende
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
        <p className={SECTION_LABEL}>Leitfaden</p>
        <h2 className="font-heading mt-3 text-2xl font-bold tracking-wide">
          Für alle, die mit der Karte planen
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guide.map((entry, i) => (
            <li key={entry.file}>
              <GuideCard entry={entry} number={i + 1} />
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-background/60 border-t">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <p className={SECTION_LABEL}>Entwicklung · Englisch</p>
          <h2 className="font-heading mt-3 text-2xl font-bold tracking-wide">
            Wie es gebaut ist
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
            Die Dokumentation für alle, die am Projekt arbeiten: Datenpipeline,
            Datenmodell, die Schwellen hinter Skalen und Status, Oberfläche,
            Karte und Architektur – in der Reihenfolge, in der AGENTS.md sie
            aufführt.
          </p>
          <ul className="mt-8 grid gap-x-8 gap-y-1 md:grid-cols-2">
            {developer.map((entry) => (
              <li key={entry.file}>
                <DevRow entry={entry} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
};
