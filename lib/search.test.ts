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
  ...over,
});

/** The alias table from plan 05: what people type → which pass they mean. */
const passes: Pass[] = [
  pass({
    aliases: ["Stilfser Joch", "Stilfserjoch", "Stelvio"],
    ascents: [
      { from: { lat: 46.6, lon: 10.4 }, label: "Bormio" },
      { from: { lat: 46.6, lon: 10.5 }, label: "Prad (Nord)" },
    ],
    name: "Passo dello Stelvio",
    slug: "passo-dello-stelvio",
  }),
  pass({
    aliases: ["Grossglockner", "Glockner"],
    country: "AT",
    name: "Großglockner Hochalpenstraße",
    region: "Ostalpen",
    slug: "grossglockner-hochalpenstrasse",
  }),
  pass({
    aliases: ["Werschetz"],
    country: "SI",
    name: "Vršič",
    region: "Ostalpen",
    slug: "vrsic",
  }),
  pass({
    aliases: ["Drei Zinnen", "Auronzohütte"],
    name: "Tre Cime di Lavaredo",
    region: "Dolomiten",
    slug: "tre-cime-di-lavaredo",
  }),
  pass({
    aliases: ["Col Agnel"],
    country: "IT/FR",
    name: "Colle dell'Agnello",
    note: "Der höchste Grenzpass. Zweiter Satz über Chianale.",
    region: "Westalpen",
    slug: "colle-dell-agnello",
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
    expect(fold("GROẞGLOCKNER")).toBe("grossglockner");
    expect(fold("Stelvio, Bormio (Nord): ja!")).toBe("stelvio bormio nord ja");
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
    color: "#000000",
    description: "Ab Bormio",
    elevationGain: 2500,
    km: 80,
    name: "Stilfserjoch-Umbrail-Runde",
    passes: ["passo-dello-stelvio"],
    season: "",
    slug: "stelvio-runde",
    waypoints: [],
  };
  const town: Town = {
    country: "IT",
    lat: 46.4,
    lon: 10.3,
    name: "Bormio",
    slug: "bormio",
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
