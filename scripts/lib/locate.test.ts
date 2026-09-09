import { describe, expect, test } from "bun:test";

import {
  candidatesQuery,
  distanceToWays,
  rankCandidates,
  roadsQuery,
} from "./locate";
import type { OverpassNode, OverpassWay } from "./locate";

const node = (
  id: number,
  lat: number,
  lon: number,
  tags: Record<string, string>,
): OverpassNode => ({ id, lat, lon, tags, type: "node" });

const way = (id: number, coords: [number, number][]): OverpassWay => ({
  geometry: coords.map(([lat, lon]) => ({ lat, lon })),
  id,
  tags: { highway: "primary" },
  type: "way",
});

describe("distanceToWays", () => {
  // A stretch of the Hochalpenstraße just south of the Hochtor tunnel.
  const road = way(1, [
    [47.0836, 12.8428],
    [47.0826, 12.8432],
    [47.0816, 12.8438],
  ]);

  test("a point on the road is at distance ~0", () => {
    expect(distanceToWays({ lat: 47.0826, lon: 12.8432 }, [road])).toBeLessThan(
      0.005,
    );
  });

  test("the old Großglockner point is ~1 km off the road", () => {
    const d = distanceToWays({ lat: 47.081, lon: 12.831 }, [road]);
    expect(d).toBeGreaterThan(0.85);
    expect(d).toBeLessThan(1.05);
  });

  test("measures to the segment, not only to its vertices", () => {
    const straight = way(2, [
      [46, 10],
      [46, 10.1],
    ]);
    // 10 m north of the middle of a 7.7 km segment.
    const d = distanceToWays({ lat: 46.00009, lon: 10.05 }, [straight]);
    expect(d).toBeGreaterThan(0.009);
    expect(d).toBeLessThan(0.011);
  });

  test("no ways means infinitely far", () => {
    expect(distanceToWays({ lat: 46, lon: 10 }, [])).toBe(Infinity);
  });
});

describe("queries", () => {
  test("roadsQuery batches one around() per point", () => {
    const q = roadsQuery([
      { lat: 47.1, lon: 12.8 },
      { lat: 46.9, lon: 11.1 },
    ]);
    expect(q.match(/around:300,/gu)).toHaveLength(2);
    expect(q).toContain("out geom");
  });

  test("candidatesQuery asks for passes and saddles", () => {
    const q = candidatesQuery({ lat: 47.1, lon: 12.8 });
    expect(q).toContain('"mountain_pass"="yes"');
    expect(q).toContain('"natural"="saddle"');
    expect(q).toContain("around:6000,47.1,12.8");
  });
});

describe("rankCandidates", () => {
  const pass = {
    aliases: ["Grossglockner", "Glockner"],
    elevation: 2504,
    lat: 47.081,
    lon: 12.831,
    name: "Großglockner Hochalpenstraße",
  };
  test("name match beats elevation beats distance", () => {
    const ranked = rankCandidates(pass, [
      node(1, 47.1237, 12.8298, { ele: "2571", name: "Edelweißspitze" }),
      node(2, 47.0836, 12.8428, { ele: "2504", name: "Hochtor" }),
      node(3, 47.09, 12.84, { ele: "2500", name: "Glockner Hochtor" }),
      node(4, 47.082, 12.832, {}),
    ]);
    expect(ranked.map((c) => c.osm)).toEqual([3, 2, 1, 4]);
    expect(ranked[0]!.nameMatch).toBe(1);
    expect(ranked[3]!.ele).toBeNull();
  });

  test("an alias in any language is a full match", () => {
    const [best] = rankCandidates(
      { ...pass, aliases: ["Passo del Rombo"], name: "Timmelsjoch" },
      [
        node(1, 46.9, 11.1, { name: "Passo del Rombo" }),
        node(2, 46.9, 11.1, {
          name: "Timmelsjoch",
          "name:it": "Passo del Rombo",
        }),
      ],
    );
    expect(best!.nameMatch).toBe(2);
  });

  test("a decimal ele tag with a comma is read", () => {
    const [c] = rankCandidates(pass, [
      node(1, 47.08, 12.84, { ele: "2503,6" }),
    ]);
    expect(c!.ele).toBe(2504);
  });
});
