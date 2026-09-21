import { expect, test } from "bun:test";

import type { Pass } from "../../lib/types";
import { coverageOf, coverageQuery, reportLines } from "./coverage";
import type { OverpassNode } from "./locate";

/** Bormio. */
const base = { lat: 46.468, lon: 10.372 };

const pass = (
  slug: string,
  lat: number,
  lon: number,
  ascents = 2,
  type: Pass["type"] = "pass",
): Pass =>
  ({
    ascents: Array.from({ length: ascents }, () => ({
      from: { lat, lon },
      label: "x",
    })),
    beauty: 3,
    classicAscent: "",
    country: "IT",
    difficulty: 3,
    elevation: 2000,
    fame: 3,
    lat,
    lon,
    name: slug,
    note: "",
    region: "Zentralalpen",
    season: null,
    slug,
    traffic: 2,
    type,
  }) as Pass;

const node = (
  id: number,
  lat: number,
  lon: number,
  tags: Record<string, string> = {},
): OverpassNode => ({ id, lat, lon, tags, type: "node" });

test("a node within 500 m of a marker is that entry; the rest are candidates by band", () => {
  const stelvio = pass("stelvio", 46.5286, 10.4529);
  const nodes = [
    node(1, 46.5288, 10.453, { ele: "2758", name: "Passo dello Stelvio" }),
    // About 11 km (door), 31 km (day), 65 km (trip) and beyond reach.
    node(2, 46.5, 10.5, { ele: "2100", name: "Passo Alto" }),
    node(3, 46.75, 10.372, { ele: "1900", name: "Passo Medio" }),
    node(4, 47.05, 10.372, { ele: "1800", name: "Passo Lontano" }),
    node(5, 47.4, 10.372, { ele: "3000" }),
  ];
  const cov = coverageOf(base, nodes, [stelvio], 1000);
  expect(cov.listed.door.map((l) => l.slug)).toEqual(["stelvio"]);
  expect(cov.candidates.door.map((c) => c.name)).toEqual(["Passo Alto"]);
  expect(cov.candidates.day.map((c) => c.name)).toEqual(["Passo Medio"]);
  expect(cov.candidates.trip.map((c) => c.name)).toEqual(["Passo Lontano"]);
});

test("the floor drops low candidates, never listed entries", () => {
  const low = pass("low", 46.49, 10.4);
  const nodes = [
    node(1, 46.49, 10.4, { ele: "900" }),
    node(2, 46.5, 10.5, { ele: "950", name: "Colle Basso" }),
  ];
  const cov = coverageOf(base, nodes, [low], 1000);
  expect(cov.listed.door).toHaveLength(1);
  expect(cov.candidates.door).toHaveLength(0);
  expect(coverageOf(base, nodes, [low], 600).candidates.door).toHaveLength(1);
});

test("two nodes of one saddle count once; a name match names the entry", () => {
  const bernina = pass("berninapass", 46.4, 10.05);
  const nodes = [
    node(1, 46.4104, 10.0245, { ele: "2328", name: "Passo del Bernina" }),
    node(2, 46.4105, 10.0246, {
      ele: "2328",
      name: "Passo del Bernina",
      natural: "saddle",
    }),
    node(3, 46.42, 10.02, { ele: "2300", name: "Berninapass" }),
  ];
  const cov = coverageOf(base, nodes, [bernina], 1000);
  const all = Object.values(cov.candidates).flat();
  expect(all.map((c) => c.name)).toEqual(["Passo del Bernina", "Berninapass"]);
  expect(all[1]?.near?.slug).toBe("berninapass");
});

test("an entry without a node in OSM is still listed, and single-sided passes are counted", () => {
  const toll = pass("toll", 46.49, 10.4, 1);
  const spur = pass("spur", 46.5, 10.42, 1, "spur");
  const cov = coverageOf(base, [], [toll, spur], 1000);
  expect(cov.listed.door.map((l) => l.slug)).toEqual(["toll", "spur"]);
  expect(cov.singleSided.map((p) => p.slug)).toEqual(["toll"]);
  const lines = reportLines({ country: "IT", name: "Bormio" }, cov, 6);
  expect(lines[0]).toBe("Bormio (IT)");
  expect(lines.at(-1)).toContain("einseitige Pässe im Umkreis: 1 (toll)");
});

test("the query asks for paved roads on the server", () => {
  const q = coverageQuery(base);
  expect(q).toContain("around:75000,46.468,10.372");
  expect(q).toContain('["mountain_pass"="yes"]');
  expect(q).toContain("node.p(around.r:300)");
  expect(q).not.toContain("track");
});
