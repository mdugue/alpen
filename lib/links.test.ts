import { describe, expect, test } from "bun:test";

import { komootHref, quaeldichHref } from "@/lib/links";
import type { Pass } from "@/lib/types";

const pass = (over: Partial<Pass> & { slug: string; name: string }): Pass => ({
  ascents: [],
  beauty: 5,
  classicAscent: "",
  country: "IT",
  difficulty: 5,
  elevation: 2757,
  fame: 5,
  lat: 46.5,
  lon: 10.4,
  note: "",
  region: "Zentralalpen",
  season: null,
  traffic: 4,
  type: "pass",
  ...over,
});

describe("quaeldichHref", () => {
  test("goes to the pass page when the slug is curated", () => {
    expect(
      quaeldichHref(
        pass({
          name: "Passo dello Stelvio",
          quaeldich: "stilfser-joch",
          slug: "passo-dello-stelvio",
        }),
      ),
    ).toBe("https://www.quaeldich.de/paesse/stilfser-joch/");
  });

  test("falls back to the search, whose parameter is suchwort", () => {
    // "q" is silently ignored and returns an empty result page.
    expect(
      quaeldichHref(
        pass({ name: "Passo Crocedomini", slug: "passo-crocedomini" }),
      ),
    ).toBe("https://www.quaeldich.de/suche/?suchwort=Passo+Crocedomini");
  });

  test("the search keeps umlauts and ß encoded, spaces as +", () => {
    expect(
      quaeldichHref(
        pass({
          name: "Roßfeld-Panoramastraße",
          slug: "rossfeld-panoramastrasse",
        }),
      ),
    ).toBe(
      "https://www.quaeldich.de/suche/?suchwort=Ro%C3%9Ffeld-Panoramastra%C3%9Fe",
    );
  });
});

describe("komootHref", () => {
  test("carries the coordinates in the path, not in the query", () => {
    expect(komootHref("Col du Galibier", 45.064, 6.408)).toBe(
      "https://www.komoot.com/de-de/discover/Col%20du%20Galibier/@45.064,6.408/tours?sport=racebike",
    );
  });

  test("encodes what a pass name brings along", () => {
    expect(komootHref("Alpe d'Huez", 45.0923, 6.0703)).toBe(
      "https://www.komoot.com/de-de/discover/Alpe%20d'Huez/@45.0923,6.0703/tours?sport=racebike",
    );
  });
});
