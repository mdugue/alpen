import { describe, expect, test } from "bun:test";

import {
  fold,
  matches,
  passHaystack,
  tourHaystack,
  townHaystack,
} from "@/lib/search";
import type { Pass, Tour, Town } from "@/lib/types";

const pass = (over: Partial<Pass> & { slug: string; name: string }): Pass => ({
  country: "IT",
  region: "Zentralalpen",
  lat: 46.5,
  lon: 10.4,
  elevation: 2757,
  classicAscent: "",
  beauty: 5,
  fame: 5,
  difficulty: 5,
  traffic: 4,
  season: null,
  note: "",
  ascents: [],
  ...over,
});

/** The alias table from plan 05: what people type → which pass they mean. */
const passes: Pass[] = [
  pass({
    slug: "passo-dello-stelvio",
    name: "Passo dello Stelvio",
    aliases: ["Stilfser Joch", "Stilfserjoch", "Stelvio"],
    ascents: [
      { from: { lat: 46.6, lon: 10.4 }, label: "Bormio" },
      { from: { lat: 46.6, lon: 10.5 }, label: "Prad (Nord)" },
    ],
  }),
  pass({
    slug: "grossglockner-hochalpenstrasse",
    name: "Großglockner Hochalpenstraße",
    aliases: ["Grossglockner", "Glockner"],
    country: "AT",
    region: "Ostalpen",
  }),
  pass({
    slug: "vrsic",
    name: "Vršič",
    aliases: ["Werschetz"],
    country: "SI",
    region: "Ostalpen",
  }),
  pass({
    slug: "tre-cime-di-lavaredo",
    name: "Tre Cime di Lavaredo",
    aliases: ["Drei Zinnen", "Auronzohütte"],
    region: "Dolomiten",
  }),
  pass({
    slug: "colle-dell-agnello",
    name: "Colle dell'Agnello",
    aliases: ["Col Agnel"],
    country: "IT/FR",
    region: "Westalpen",
    note: "Der höchste Grenzpass. Zweiter Satz über Chianale.",
  }),
];

const find = (query: string) =>
  passes.filter((p) => matches(passHaystack(p), query)).map((p) => p.slug);

describe("fold", () => {
  test("strips accents, ß, punctuation and dashes", () => {
    expect(fold("Großglockner Hochalpenstraße")).toBe(
      "grossglockner hochalpenstrasse",
    );
    expect(fold("Vršič")).toBe("vrsic");
    expect(fold("Col de l'Iseran")).toBe("col de liseran");
    expect(fold("Roßfeld-Panoramastraße")).toBe("rossfeld panoramastrasse");
    expect(fold("  CH/IT  ")).toBe("ch it");
    expect(fold("St. Moritz")).toBe("st moritz");
  });
});

describe("matches", () => {
  test("every token has to occur somewhere", () => {
    const hay = passHaystack(passes[0]!);
    expect(matches(hay, "stelvio prad")).toBe(true);
    expect(matches(hay, "stelvio gavia")).toBe(false);
    expect(matches(hay, "")).toBe(true);
  });
});

describe("passHaystack", () => {
  test("the acceptance list from the plan", () => {
    expect(find("grossglockner")).toEqual(["grossglockner-hochalpenstrasse"]);
    expect(find("vrsic")).toEqual(["vrsic"]);
    expect(find("stilfser")).toEqual(["passo-dello-stelvio"]);
    expect(find("bormio")).toEqual(["passo-dello-stelvio"]);
    expect(find("drei zinnen")).toEqual(["tre-cime-di-lavaredo"]);
  });

  test("country codes, German country names, region and the first sentence of the note", () => {
    expect(find("frankreich")).toEqual(["colle-dell-agnello"]);
    expect(find("fr")).toEqual(["colle-dell-agnello"]);
    expect(find("slowenien")).toEqual(["vrsic"]);
    expect(find("dolomiten")).toEqual(["tre-cime-di-lavaredo"]);
    expect(find("grenzpass")).toEqual(["colle-dell-agnello"]);
    expect(find("chianale")).toEqual([]);
  });

  test("the folded haystack is cached per object", () => {
    const p = passes[0]!;
    expect(passHaystack(p)).toBe(passHaystack(p));
  });
});

describe("tourHaystack and townHaystack", () => {
  const tour: Tour = {
    slug: "stelvio-runde",
    name: "Stilfserjoch-Umbrail-Runde",
    color: "#000000",
    km: 80,
    elevationGain: 2500,
    passes: ["passo-dello-stelvio"],
    season: "",
    description: "Ab Bormio",
    waypoints: [],
  };
  const town: Town = {
    slug: "bormio",
    name: "Bormio",
    country: "IT",
    lat: 46.4,
    lon: 10.3,
    why: "Stelvio vor der Tür",
  };
  test("a tour is found through the names of its passes", () => {
    const hay = tourHaystack(tour, ["Passo dello Stelvio"]);
    expect(matches(hay, "stelvio")).toBe(true);
    expect(matches(hay, "stilfserjoch")).toBe(true);
    expect(matches(hay, "galibier")).toBe(false);
  });
  test("a town is found through its country name", () => {
    expect(matches(townHaystack(town), "italien")).toBe(true);
    expect(matches(townHaystack(town), "bormio it")).toBe(true);
  });
});
