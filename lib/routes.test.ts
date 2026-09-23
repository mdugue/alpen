import { describe, expect, test } from "bun:test";

import { withoutLegacySelection } from "@/lib/hash";
import { hrefFor, selectionOf } from "@/lib/routes";

describe("entity routes (plan 02)", () => {
  test("a path per kind, and back", () => {
    for (const sel of [
      { kind: "pass", slug: "col-du-galibier" },
      { kind: "tour", slug: "sellaronda" },
      { kind: "town", slug: "bormio" },
      { kind: "destination", slug: "oisans" },
    ] as const) {
      expect(selectionOf(hrefFor(sel, "de"))).toEqual(sel);
      expect(selectionOf(hrefFor(sel, "en"))).toEqual(sel);
    }
    expect(hrefFor({ kind: "town", slug: "bormio" }, "de")).toBe("/ort/bormio");
    expect(hrefFor({ kind: "destination", slug: "oisans" }, "de")).toBe(
      "/ziel/oisans",
    );
  });

  test("the start page and the legal pages name no entity", () => {
    expect(selectionOf("/")).toBeNull();
    expect(selectionOf("/impressum")).toBeNull();
    expect(selectionOf("/pass")).toBeNull();
    expect(selectionOf("/pass/x/y")).toBeNull();
    expect(selectionOf("/blog/x")).toBeNull();
    expect(selectionOf("/pass/%E0")).toBeNull();
  });

  test("an old link's selection leaves the hash, the rest stays", () => {
    expect(withoutLegacySelection("#pass=col-du-galibier&t=6&z=9")).toBe(
      "#t=6&z=9",
    );
    expect(withoutLegacySelection("#town=bormio")).toBe("");
    expect(withoutLegacySelection("")).toBe("");
  });
});
