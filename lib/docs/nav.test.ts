import { expect, test } from "bun:test";

import { documentsTable, navGroups, orderByIndex } from "./nav";

const AGENTS = [
  "# AGENTS.md",
  "",
  "Some [link](docs/roadmap.md) before the table does not count.",
  "",
  "## The documents",
  "",
  "| Document | Read it when you want to know |",
  "| --- | --- |",
  "| [`docs/scales.md`](docs/scales.md) | the 1–5 scales, the `SIGNALS` |",
  "| [`docs/plans/README.md`](docs/plans/README.md) | what to build next |",
  "| [`README.md`](README.md) | quick start |",
  "",
  "## Conventions",
  "",
  "[x](docs/data-model.md)",
].join("\n");

const FILES = [
  "docs/data-model.md",
  "docs/guide/README.md",
  "docs/guide/de/data-sources.md",
  "docs/guide/de/how-it-works.md",
  "docs/plans/00-a.md",
  "docs/plans/01-b.md",
  "docs/plans/README.md",
  "docs/roadmap.md",
  "docs/scales.md",
];

const MARKDOWN: Record<string, string> = {
  "AGENTS.md": AGENTS,
  "docs/guide/README.md":
    "1. [h](de/how-it-works.md)\n2. [d](de/data-sources.md)\n\n[dev](../../AGENTS.md)",
  "docs/plans/README.md": "[1](01-b.md) [0](00-a.md)",
};

test("an index gives the order, the rest follows alphabetically", () => {
  expect(
    orderByIndex("docs/plans/README.md", "[1](01-b.md)", [
      "docs/plans/00-a.md",
      "docs/plans/01-b.md",
    ]),
  ).toEqual(["docs/plans/01-b.md", "docs/plans/00-a.md"]);
});

test("the documents table is read row by row, and only that table", () => {
  expect(documentsTable(AGENTS)).toEqual([
    { answers: "the 1–5 scales, the SIGNALS", target: "docs/scales.md" },
    { answers: "what to build next", target: "docs/plans/README.md" },
    { answers: "quick start", target: "README.md" },
  ]);
});

test("the menu: the guide in its index's order, the docs in AGENTS.md's", () => {
  const [guide, dev] = navGroups(
    FILES,
    (f) => MARKDOWN[f] ?? "",
    (f) => f,
  );
  expect(guide?.items.map((i) => i.href)).toEqual([
    "/wissen/how-it-works",
    "/wissen/data-sources",
  ]);
  expect(dev?.items.map((i) => i.href)).toEqual([
    "/wissen/dev",
    "/wissen/dev/scales",
    "/wissen/dev/plans",
    "/wissen/dev/data-model",
    "/wissen/dev/roadmap",
  ]);
  expect(dev?.items[2]?.children.map((i) => i.href)).toEqual([
    "/wissen/dev/plans/01-b",
    "/wissen/dev/plans/00-a",
  ]);
});
