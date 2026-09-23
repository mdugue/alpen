/**
 * Where each file under docs/ is published, and where a link between them
 * goes. The site mirrors the folder, so there is nothing to keep in sync:
 *
 *   docs/guide/README.md       → /wissen             the entry
 *   docs/guide/de/<page>.md    → /wissen/<page>      the German guide
 *   docs/<path>.md             → /wissen/dev/<path>  the developer docs
 *   docs/<dir>/README.md       → /wissen/dev/<dir>
 *
 * German is prefix-free like the rest of the site; an English guide
 * (docs/guide/en/) would follow plan 08 under /en/wissen and is not published
 * yet. The developer docs have no index file of their own: AGENTS.md is the
 * index, and its documents table is what /wissen/dev lists (lib/docs/nav.ts).
 *
 * A link to anything else (AGENTS.md, a script, a skill) points at the file on
 * GitHub, so the Markdown stays written for GitHub and the site follows it.
 */

export const WISSEN = "/wissen";
export const WISSEN_DEV = `${WISSEN}/dev`;
export const REPO_URL = "https://github.com/mdugue/alpen";

export type Lang = "de" | "en";

const GUIDE = "docs/guide/";
const GUIDE_DE = `${GUIDE}de/`;

/** The published route of a docs file, or null if it is not a page. */
export const routeOf = (file: string): string | null => {
  if (!(file.startsWith("docs/") && file.endsWith(".md"))) {
    return null;
  }
  if (file.startsWith("docs/diagrams/")) {
    return null;
  }
  if (file === `${GUIDE}README.md`) {
    return WISSEN;
  }
  if (file.startsWith(GUIDE)) {
    const page = file.startsWith(GUIDE_DE)
      ? file.slice(GUIDE_DE.length, -3)
      : "";
    // `dev` is where the developer docs start, so no guide page may take it.
    const flat = page !== "" && !page.includes("/");
    return flat && page !== "README" && page !== "dev"
      ? `${WISSEN}/${page}`
      : null;
  }
  const inner = file.slice("docs/".length, -3).replace(/(?:^|\/)README$/u, "");
  return inner ? `${WISSEN_DEV}/${inner}` : WISSEN_DEV;
};

/** The route's segments under /wissen, as `generateStaticParams` wants them. */
export const segmentsOf = (route: string): string[] =>
  route === WISSEN ? [] : route.slice(WISSEN.length + 1).split("/");

/** The language a page is written in: the guide German, the rest English. */
export const langOf = (file: string): Lang =>
  file.startsWith(GUIDE) ? "de" : "en";

/** POSIX `join` + `normalize` without node:path, for the browserless core. */
export const joinPath = (dir: string, rel: string): string => {
  const out: string[] = [];
  for (const part of `${dir}/${rel}`.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      out.pop();
    } else {
      out.push(part);
    }
  }
  return out.join("/");
};

const dirOf = (file: string) => file.split("/").slice(0, -1).join("/");

export type Resolved =
  | { kind: "page"; href: string }
  | { kind: "external"; href: string };

/**
 * Where a link written in `from` (a repo-relative file) goes on the site.
 * `pages` is every file that is published.
 */
export const resolveHref = (
  from: string,
  href: string,
  pages: ReadonlySet<string>,
): Resolved => {
  if (/^[a-z][a-z0-9+.-]*:/iu.test(href) || href.startsWith("//")) {
    return { href, kind: "external" };
  }
  if (href.startsWith("#")) {
    return { href, kind: "page" };
  }
  const [target = "", hash] = href.split("#");
  const suffix = hash ? `#${hash}` : "";
  const file = target.startsWith("/")
    ? target.slice(1)
    : joinPath(dirOf(from), target);
  for (const candidate of [file, joinPath(file, "README.md")]) {
    const route = pages.has(candidate) ? routeOf(candidate) : null;
    if (route !== null) {
      return { href: `${route}${suffix}`, kind: "page" };
    }
  }
  const isDir = target.endsWith("/") || !/\.[a-z0-9]+$/iu.test(file);
  return {
    href: `${REPO_URL}/${isDir ? "tree" : "blob"}/main/${file}${suffix}`,
    kind: "external",
  };
};

/** The file on GitHub, for the "view source" link. */
export const sourceUrl = (file: string) => `${REPO_URL}/blob/main/${file}`;
