import { linkTargets, plainText } from "./content";
import { resolveHref, routeOf, WISSEN_DEV } from "./routes";

export interface NavItem {
  file: string;
  href: string;
  title: string;
  /** Pages in the folder this item is the README of (docs/plans/). */
  children: NavItem[];
}

export interface NavGroup {
  id: "guide" | "dev";
  label: string;
  items: NavItem[];
}

/** The guide's index, whose links are its reading order. */
export const GUIDE_INDEX = "docs/guide/README.md";
/** The developer docs' index: AGENTS.md, and in it the documents table. */
export const DEV_INDEX = "AGENTS.md";

/**
 * The order an index already gives: the files it links to, first appearance
 * first, then whatever it does not mention, alphabetically. The site's menu
 * is the knowledge base's own reading order, not a second list.
 */
export const orderByIndex = (
  indexFile: string,
  indexMarkdown: string,
  files: readonly string[],
): string[] => {
  const pages = new Set(files);
  const byRoute = new Map(files.map((f) => [routeOf(f), f]));
  const seen = new Set<string>();
  for (const target of linkTargets(indexMarkdown)) {
    const resolved = resolveHref(indexFile, target, pages);
    const route = resolved.href.split("#")[0] ?? "";
    const file = resolved.kind === "page" ? byRoute.get(route) : undefined;
    if (file !== undefined && file !== indexFile) {
      seen.add(file);
    }
  }
  return [...seen, ...files.filter((f) => !seen.has(f)).toSorted()];
};

/** One row of AGENTS.md's documents table: the file and what it answers. */
export interface DocumentRow {
  target: string;
  /** "Read it when you want to know …", as the table says it. */
  answers: string;
}

/** The `## The documents` section of AGENTS.md, up to the next heading. */
export const documentsSection = (agents: string): string =>
  agents.split(/^## The documents\s*$/mu)[1]?.split(/^## /mu)[0] ?? "";

/**
 * The rows of the `## The documents` table in AGENTS.md, in its order. That
 * table is the one list of the developer docs, so /wissen/dev reads it rather
 * than keeping a list of its own.
 */
export const documentsTable = (agents: string): DocumentRow[] => {
  const rows: DocumentRow[] = [];
  for (const line of documentsSection(agents).split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    const [target] = linkTargets(cells[1] ?? "");
    if (line.startsWith("|") && target !== undefined) {
      rows.push({ answers: plainText(cells[2] ?? ""), target });
    }
  }
  return rows;
};

const dirOf = (file: string) => file.slice(0, file.lastIndexOf("/"));

/** The folder README a developer page sits under, if it is not docs/ itself. */
const parentOf = (file: string, files: ReadonlySet<string>): string | null => {
  const dir = dirOf(file);
  const readme = `${dir}/README.md`;
  return dir !== "docs" && readme !== file && files.has(readme) ? readme : null;
};

/** The two menu groups, each in its index's order. */
export const navGroups = (
  files: readonly string[],
  read: (file: string) => string,
  title: (file: string) => string,
): NavGroup[] => {
  const all = new Set(files);
  const item = (file: string, children: NavItem[] = []): NavItem => ({
    children,
    file,
    href: routeOf(file) ?? "",
    title: title(file),
  });
  const guide = files.filter(
    (f) => f.startsWith("docs/guide/") && f !== GUIDE_INDEX,
  );
  const dev = files.filter(
    (f) => !f.startsWith("docs/guide/") && routeOf(f) !== null,
  );
  const top = dev.filter((f) => parentOf(f, all) === null);
  const childrenOf = (readme: string) => {
    const kids = dev.filter((f) => parentOf(f, all) === readme);
    return orderByIndex(readme, read(readme), kids).map((f) => item(f));
  };
  return [
    {
      id: "guide",
      items: orderByIndex(GUIDE_INDEX, read(GUIDE_INDEX), guide).map((f) =>
        item(f),
      ),
      label: "Leitfaden",
    },
    {
      id: "dev",
      items: [
        { children: [], file: DEV_INDEX, href: WISSEN_DEV, title: "Überblick" },
        ...orderByIndex(DEV_INDEX, documentsSection(read(DEV_INDEX)), top).map(
          (f) => item(f, f.endsWith("/README.md") ? childrenOf(f) : []),
        ),
      ],
      label: "Entwicklung (englisch)",
    },
  ];
};
