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
  type: "pass",
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

describe("passHaystack carries the road vocabulary", () => {
  /**
   * Plan 14's acceptance queries: a road is found by what it *is*, not only by
   * what it is called. The three entries are the ones the real data gives
   * these labels to.
   *
   * Their own table rather than the alias table above, because "Autofrei"
   * folds to "autofrei" and that contains "fr" – a carfree road in the list up
   * there would turn up under the country code for France.
   */
  const roads: Pass[] = [
    pass({
      country: "AT",
      name: "Ötztaler Gletscherstraße",
      region: "Ostalpen",
      slug: "oetztaler-gletscherstrasse",
      tags: ["glacier", "toll"],
      type: "spur",
    }),
    pass({
      country: "CH",
      name: "Große Scheidegg",
      region: "Zentralalpen",
      slug: "grosse-scheidegg",
      tags: ["carfree"],
    }),
    pass({
      name: "Colle del Nivolet",
      region: "Westalpen",
      slug: "colle-del-nivolet",
      tags: ["reservoir", "carfree"],
      type: "spur",
    }),
  ];
  const findRoad = (query: string) =>
    roads.filter((p) => matches(passHaystack(p), query)).map((p) => p.slug);

  test("the acceptance queries from plan 14", () => {
    expect(findRoad("stichstrasse")).toEqual([
      "oetztaler-gletscherstrasse",
      "colle-del-nivolet",
    ]);
    expect(findRoad("autofrei")).toEqual([
      "grosse-scheidegg",
      "colle-del-nivolet",
    ]);
    expect(findRoad("gletscher")).toEqual(["oetztaler-gletscherstrasse"]);
  });

  test("the German labels are found as they are typed", () => {
    // "Stichstraße" and "Stausee" reach the haystack folded, so both
    // spellings of the ß and any case find them.
    expect(findRoad("Stichstraße")).toEqual([
      "oetztaler-gletscherstrasse",
      "colle-del-nivolet",
    ]);
    expect(findRoad("stausee")).toEqual(["colle-del-nivolet"]);
    expect(findRoad("maut")).toEqual(["oetztaler-gletscherstrasse"]);
    // A label the road does not carry finds nothing.
    expect(findRoad("schlucht")).toEqual([]);
    expect(findRoad("tunnel")).toEqual([]);
  });

  test("a label answers where the name says nothing", () => {
    const scheidegg = roads[1]!;
    expect(matches(passHaystack(scheidegg), "autofrei")).toBe(true);
    // Nothing in "Große Scheidegg" is about cars: the label is what answers.
    expect(matches(fold(scheidegg.name), "autofrei")).toBe(false);
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
    aliases: ["Valtellina", "Veltlin"],
    country: "IT",
    lat: 46.4,
    lon: 10.3,
    name: "Bormio",
    slug: "bormio",
    tags: ["hub", "workshops"],
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
  test("a town is found through the valley it sits in and through its labels", () => {
    expect(matches(townHaystack(town), "veltlin")).toBe(true);
    expect(matches(townHaystack(town), "valtellina")).toBe(true);
    // The labels are prose in the haystack, so a stem finds them too.
    expect(matches(townHaystack(town), "werkstatt")).toBe(true);
    expect(matches(townHaystack(town), "mekka")).toBe(true);
    expect(matches(townHaystack(town), "bahnanschluss")).toBe(false);
  });
});
