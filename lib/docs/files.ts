import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * Every Markdown file under `docsDir` (the repo's docs/), repo-relative with
 * forward slashes, sorted.
 * The committed diagram SVGs live under docs/ too but are not pages.
 */
export const docFiles = (docsDir: string): string[] =>
  readdirSync(docsDir, { encoding: "utf-8", recursive: true })
    .map((f) => `docs/${f.split(path.sep).join("/")}`)
    .filter((f) => f.endsWith(".md") && !f.startsWith("docs/diagrams/"))
    .toSorted();
