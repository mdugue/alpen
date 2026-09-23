import { readFileSync } from "node:fs";
import path from "node:path";

import rehypeShiki from "@shikijs/rehype";
import type { Element, Root as HastRoot } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { toString as hastText } from "hast-util-to-string";
import type { Root as MdastRoot } from "mdast";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { diagramKey } from "@/lib/docs/diagrams";
import { resolveHref } from "@/lib/docs/routes";

import { Diagram } from "../_components/diagram";

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface RenderedDoc {
  content: ReactNode;
  toc: TocEntry[];
}

/** The text of an mdast node, for the heading a diagram sits under. */
const mdText = (node: { value?: unknown; children?: unknown[] }): string => {
  if (typeof node.value === "string") {
    return node.value;
  }
  return (node.children ?? [])
    .map((c) => mdText(c as { value?: unknown; children?: unknown[] }))
    .join("");
};

/**
 * Each ```mermaid block becomes its committed SVG (scripts/render-diagrams.ts).
 * A missing one fails the build rather than shipping a code listing – the
 * freshness test (lib/docs/diagrams.test.ts) says the same thing earlier. The
 * heading above a diagram becomes its title in the zoom dialog.
 */
const remarkDiagrams = () => (tree: MdastRoot) => {
  let heading: string | null = null;
  visit(tree, (node, index, parent) => {
    if (node.type === "heading") {
      heading = mdText(node).trim();
      return;
    }
    if (node.type !== "code" || !parent || index === undefined) {
      return;
    }
    if (node.lang !== "mermaid") {
      return;
    }
    const key = diagramKey(node.value);
    // DIAGRAM_DIR, spelled out: a static path keeps the trace to docs/.
    const file = path.join(process.cwd(), "docs", "diagrams", `${key}.svg`);
    let svg: string;
    try {
      svg = readFileSync(file, "utf-8").trim();
    } catch {
      throw new Error(
        `No rendered diagram docs/diagrams/${key}.svg – run \`bun run docs:diagrams\``,
      );
    }
    const box =
      /viewBox="[\d.-]+ [\d.-]+ (?<width>[\d.]+) (?<height>[\d.]+)"/u.exec(
        svg,
      )?.groups;
    const attrs = [
      `data-width="${Math.round(Number(box?.width ?? 0))}"`,
      `data-height="${Math.round(Number(box?.height ?? 0))}"`,
      heading ? `data-title="${heading.replaceAll('"', "&quot;")}"` : "",
    ].join(" ");
    parent.children[index] = {
      type: "html",
      value: `<figure class="diagram" ${attrs}>${svg}</figure>`,
    };
  });
};

/** Links are written for GitHub; on the site they go to the page or to GitHub. */
const rehypeLinks =
  (file: string, pages: ReadonlySet<string>) => () => (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a" || typeof node.properties.href !== "string") {
        return;
      }
      const resolved = resolveHref(file, node.properties.href, pages);
      node.properties.href = resolved.href;
      if (resolved.kind === "external") {
        node.properties.rel = ["noopener"];
      }
    });
  };

/**
 * Wide tables scroll inside their own box instead of widening the page. Not
 * typeset's `typeset-scroll`: that one sets tables to max-content, which
 * turns this repo's prose tables into single endless lines.
 */
const rehypeTableScroll = () => (tree: HastRoot) => {
  visit(tree, "element", (node: Element, index, parent) => {
    if (node.tagName !== "table" || !parent || index === undefined) {
      return;
    }
    parent.children[index] = {
      children: [node],
      properties: { className: ["doc-table"] },
      tagName: "div",
      type: "element",
    };
  });
};

const tocOf = (tree: HastRoot): TocEntry[] => {
  const toc: TocEntry[] = [];
  visit(tree, "element", (node: Element) => {
    if (
      (node.tagName === "h2" || node.tagName === "h3") &&
      node.properties.id
    ) {
      toc.push({
        depth: node.tagName === "h2" ? 2 : 3,
        id: node.properties.id,
        text: hastText(node),
      });
    }
  });
  return toc;
};

const DocLink = ({ children, href = "", ...rest }: ComponentProps<"a">) =>
  href.startsWith("/") ? (
    <Link href={href} {...rest}>
      {children}
    </Link>
  ) : (
    <a href={href} {...rest}>
      {children}
    </a>
  );

/** One docs file, rendered: Markdown → hast → React, on the server only. */
export const renderDoc = async (
  file: string,
  markdown: string,
  pages: ReadonlySet<string>,
): Promise<RenderedDoc> => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDiagrams)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeLinks(file, pages))
    .use(rehypeTableScroll)
    .use(rehypeShiki, {
      defaultColor: false,
      defaultLanguage: "text",
      fallbackLanguage: "text",
      // Both schemes as variables; wissen.css picks one by the OS scheme,
      // like every other colour here.
      themes: { dark: "github-dark", light: "github-light" },
    });
  // unified's processor types are too deep for the type-aware lint pass; the
  // plugin chain above ends in hast, which is all this needs to know.
  const run: unknown = await processor.run(processor.parse(markdown));
  const tree = run as HastRoot;
  // Typed against the global JSX namespace React 19 no longer declares, so
  // the result arrives untyped; it is React nodes by construction.
  const rendered: unknown = toJsxRuntime(tree, {
    Fragment,
    components: {
      a: DocLink,
      figure: (
        props: ComponentProps<"figure"> & {
          "data-width"?: string;
          "data-height"?: string;
          "data-title"?: string;
        },
      ) =>
        props.className === "diagram" ? (
          <Diagram
            height={Number(props["data-height"] ?? 0)}
            title={props["data-title"] ?? null}
            width={Number(props["data-width"] ?? 0)}
          >
            {props.children}
          </Diagram>
        ) : (
          <figure {...props} />
        ),
    },
    jsx,
    jsxs,
  });
  return { content: rendered as ReactNode, toc: tocOf(tree) };
};
