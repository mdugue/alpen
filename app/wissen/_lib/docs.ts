import { readFileSync } from "node:fs";
import path from "node:path";

import { getRoadSketch } from "@/lib/data";
import { descriptionOf, titleOf } from "@/lib/docs/content";
import { docFiles } from "@/lib/docs/files";
import { DEV_INDEX, documentsTable, navGroups } from "@/lib/docs/nav";
import type { NavGroup, NavItem } from "@/lib/docs/nav";
import {
  resolveHref,
  routeOf,
  segmentsOf,
  WISSEN_DEV,
} from "@/lib/docs/routes";
import { boxOf, sketch } from "@/lib/docs/sketch";
import type { Box, Sketch } from "@/lib/docs/sketch";

/**
 * docs/ as the /wissen pages read it, at build time: every page is
 * prerendered from `generateStaticParams`, so nothing here runs per request.
 * The paths are spelled out from the project root so the file trace stays
 * with docs/ and AGENTS.md.
 */
const DOCS = path.join(process.cwd(), "docs");

/** Every published docs file, repo-relative. */
export const pageFiles = (): string[] =>
  docFiles(DOCS).filter((f) => routeOf(f) !== null);

/** A published file's Markdown – a docs file, or AGENTS.md, the dev index. */
export const readDoc = (file: string): string =>
  file === DEV_INDEX
    ? readFileSync(path.join(process.cwd(), "AGENTS.md"), "utf-8")
    : readFileSync(path.join(DOCS, file.replace(/^docs\//u, "")), "utf-8");

/** What is published at these segments under /wissen. */
export type Place =
  | { kind: "entry" }
  | { kind: "dev" }
  | { kind: "doc"; file: string };

export const placeAt = (segments: readonly string[]): Place | null => {
  const wanted = segments.map((s) => decodeURIComponent(s)).join("/");
  if (wanted === "") {
    return { kind: "entry" };
  }
  if (`/wissen/${wanted}` === WISSEN_DEV) {
    return { kind: "dev" };
  }
  const file = pageFiles().find(
    (f) => segmentsOf(routeOf(f) ?? "").join("/") === wanted,
  );
  return file ? { file, kind: "doc" } : null;
};

export const titleFor = (file: string): string =>
  titleOf(readDoc(file)) ?? path.basename(file, ".md");

export const nav = (): NavGroup[] => navGroups(pageFiles(), readDoc, titleFor);

export const descriptionFor = (file: string): string | null =>
  descriptionOf(readDoc(file));

/** A developer document as AGENTS.md lists it. */
export interface DevEntry {
  href: string;
  title: string;
  /** "Read it when you want to know …" – English, as the table says it. */
  answers: string;
  /** On the site, or a file on GitHub (README.md, the skills). */
  external: boolean;
  file: string;
}

/** The rows of AGENTS.md's documents table, resolved to where they go. */
export const devEntries = (): DevEntry[] => {
  const pages = new Set(pageFiles());
  return documentsTable(readDoc(DEV_INDEX)).map(({ answers, target }) => {
    const resolved = resolveHref(DEV_INDEX, target, pages);
    const file = target.replace(/\/$/u, "");
    const page = resolved.kind === "page";
    return {
      answers,
      external: !page,
      file,
      href: resolved.href,
      title: page
        ? titleFor(file.endsWith(".md") ? file : `${file}/README.md`)
        : file,
    };
  });
};

/** A page's neighbours in its menu group, flattened (folders in order). */
export const neighbours = (
  file: string,
): {
  group: NavGroup;
  index: number;
  count: number;
  prev: NavItem | null;
  next: NavItem | null;
} | null => {
  for (const group of nav()) {
    const flat = group.items.flatMap((item) => [item, ...item.children]);
    const index = flat.findIndex((item) => item.file === file);
    if (index !== -1) {
      return {
        count: flat.length,
        group,
        index,
        next: flat[index + 1] ?? null,
        prev: flat[index - 1] ?? null,
      };
    }
  }
  return null;
};

/** The whole range: every summit, with a little room around it. */
export const rangeSketch = (): Sketch => {
  const { roads, summits } = getRoadSketch();
  return sketch(roads, summits, boxOf(summits, 0.04), 1600);
};

/**
 * Regions worth a strip above a page, picked by eye where the roads are
 * dense: Maurienne and Oisans, the Maritime Alps, Valais and the Oberland,
 * Engadin and Bernina, Stelvio and Gavia, the Dolomites, Ötztal and the
 * Timmelsjoch. `[lat, lon]` of the centre.
 */
const REGIONS: [number, number][] = [
  [45.15, 6.45],
  [44.3, 6.95],
  [46.55, 8.2],
  [46.45, 9.95],
  [46.45, 10.45],
  [46.5, 11.85],
  [46.9, 11.1],
];

/** A strip of the range above a page, a different region per page. */
export const regionSketch = (file: string): Sketch => {
  let hash = 0;
  for (const c of file) {
    hash = (hash * 31 + (c.codePointAt(0) ?? 0)) % 4_294_967_296;
  }
  const [lat, lon] = REGIONS[hash % REGIONS.length] ?? [46.5, 10];
  const box: Box = [lon - 0.9, lat - 0.3, lon + 0.9, lat + 0.3];
  const { roads, summits } = getRoadSketch();
  return sketch(roads, summits, box, 960);
};
