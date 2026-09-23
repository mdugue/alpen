import { describe, expect, test } from "bun:test";

import { DE, messagesOf } from "@/lib/i18n/dictionaries";
import { fill, placeholdersOf } from "@/lib/i18n/fill";

/**
 * Every message of a dictionary by its path, "status.reason.heat" → the
 * message; `null` where a language deliberately says nothing (the legal
 * pages' note is English only).
 */
const leaves = (value: unknown, path = ""): [string, string | null][] => {
  if (typeof value === "string" || value === null) return [[path, value]];
  if (typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, v]) =>
    leaves(v, path ? `${path}.${key}` : key),
  );
};

const de = new Map(leaves(DE));
const en = new Map(leaves(messagesOf("en")));

describe("the two dictionaries", () => {
  test("say the same things: one English message for every German one", () => {
    // The type holds the layout; this holds what the type cannot see, such
    // as a list of a different length.
    expect([...en.keys()].toSorted()).toEqual([...de.keys()].toSorted());
  });

  test("carry the same placeholders, so `fill` has something to fill", () => {
    for (const [path, message] of de)
      expect(
        placeholdersOf(en.get(path) ?? "").toSorted(),
        `${path}: ${en.get(path)}`,
      ).toEqual(placeholdersOf(message ?? "").toSorted());
  });
});

describe("fill", () => {
  test("replaces every placeholder, however often it appears", () => {
    expect(fill("{n} von {n}", { n: 3 })).toBe("3 von 3");
    expect(fill("{a}–{b}", { a: "x", b: 2 })).toBe("x–2");
  });

  test("leaves what it was not given standing, so a missing value shows", () => {
    expect(fill("{a} {b}", { a: 1 })).toBe("1 {b}");
  });
});
