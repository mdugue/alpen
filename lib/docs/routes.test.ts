import { describe, expect, test } from "bun:test";

import {
  joinPath,
  langOf,
  REPO_URL,
  resolveHref,
  routeOf,
  segmentsOf,
} from "./routes";

describe("routeOf", () => {
  test.each([
    ["docs/guide/README.md", "/wissen"],
    ["docs/guide/de/data-sources.md", "/wissen/data-sources"],
    ["docs/scales.md", "/wissen/dev/scales"],
    ["docs/plans/README.md", "/wissen/dev/plans"],
    ["docs/plans/08-english-toggle.md", "/wissen/dev/plans/08-english-toggle"],
  ])("%s → %s", (file, route) => {
    expect(routeOf(file)).toBe(route);
  });

  test.each([
    "AGENTS.md",
    "docs/prototype.html",
    "docs/diagrams/abc.svg",
    "docs/guide/en/data-sources.md",
    "docs/guide/de/README.md",
    "docs/guide/de/dev.md",
    "docs/guide/de/a/b.md",
  ])("%s is not a page", (file) => {
    expect(routeOf(file)).toBeNull();
  });

  test("segments are the route under /wissen", () => {
    expect(segmentsOf("/wissen")).toEqual([]);
    expect(segmentsOf("/wissen/dev/plans")).toEqual(["dev", "plans"]);
  });

  test("the guide is German, the developer docs English", () => {
    expect(langOf("docs/guide/de/glossary.md")).toBe("de");
    expect(langOf("docs/guide/README.md")).toBe("de");
    expect(langOf("docs/scales.md")).toBe("en");
  });
});

describe("resolveHref", () => {
  const pages = new Set([
    "docs/scales.md",
    "docs/plans/README.md",
    "docs/guide/de/glossary.md",
  ]);

  test("a link between docs goes to the page, anchor kept", () => {
    expect(
      resolveHref("docs/guide/de/x.md", "../../scales.md#reach", pages),
    ).toEqual({ href: "/wissen/dev/scales#reach", kind: "page" });
    expect(resolveHref("docs/guide/de/x.md", "glossary.md", pages)).toEqual({
      href: "/wissen/glossary",
      kind: "page",
    });
  });

  test("AGENTS.md's links resolve from the repository root", () => {
    expect(resolveHref("AGENTS.md", "docs/scales.md", pages)).toEqual({
      href: "/wissen/dev/scales",
      kind: "page",
    });
  });

  test("a folder link finds its README", () => {
    expect(resolveHref("docs/scales.md", "./plans/", pages)).toEqual({
      href: "/wissen/dev/plans",
      kind: "page",
    });
  });

  test("anything unpublished goes to GitHub", () => {
    expect(resolveHref("docs/scales.md", "../lib/status.ts", pages)).toEqual({
      href: `${REPO_URL}/blob/main/lib/status.ts`,
      kind: "external",
    });
    expect(resolveHref("docs/scales.md", "../scripts/", pages)).toEqual({
      href: `${REPO_URL}/tree/main/scripts`,
      kind: "external",
    });
  });

  test("absolute URLs and in-page anchors stay as written", () => {
    for (const href of ["https://example.org/x", "mailto:a@b.c", "#top"]) {
      expect(resolveHref("docs/scales.md", href, pages).href).toBe(href);
    }
  });

  test("joinPath normalises like POSIX path.join", () => {
    expect(joinPath("docs/guide/de", "../../x.md")).toBe("docs/x.md");
    expect(joinPath("", "docs/./a/../b.md")).toBe("docs/b.md");
  });
});
