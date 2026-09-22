import { describe, expect, test } from "bun:test";

import type { OsmElement, OverpassNode, OverpassWay } from "./hosts";
import {
  candidatesQuery,
  distanceToWays,
  mapBbox,
  passNodesWithin,
  rankCandidates,
  roadsQuery,
  waysWithGeometry,
} from "./locate";

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

describe("the map API's shape", () => {
  // The Umbrail pass node with a stretch of the road under it, as the OSM map
  // API sends it: ways carry node ids, the nodes come separately.
  const elements: OsmElement[] = [
    { id: 10, lat: 46.5416, lon: 10.4332, type: "node" },
    { id: 11, lat: 46.5426, lon: 10.4334, type: "node" },
    { id: 12, lat: 46.5436, lon: 10.4336, type: "node" },
    {
      id: 20,
      nodes: [10, 11, 12],
      tags: { highway: "secondary" },
      type: "way",
    },
    {
      id: 21,
      nodes: [10, 11],
      tags: { highway: "path" },
      type: "way",
    },
    node(30, 46.5416, 10.4332, { mountain_pass: "yes", name: "Umbrail" }),
    node(31, 46.62, 10.44, { name: "weit weg", natural: "saddle" }),
    node(32, 46.5418, 10.4334, { name: "kein Sattel", natural: "peak" }),
  ];

  test("a way's node ids become its geometry", () => {
    const [road, ...rest] = waysWithGeometry(elements);
    expect(rest).toHaveLength(0);
    expect(road!.geometry).toHaveLength(3);
    expect(
      distanceToWays({ lat: 46.5426, lon: 10.4334 }, [road!]),
    ).toBeLessThan(0.005);
  });

  test("a path is no road, whatever it is tagged on", () => {
    expect(waysWithGeometry(elements).map((w) => w.id)).toEqual([20]);
  });

  test("pass and saddle nodes inside the radius, nothing else", () => {
    const found = passNodesWithin({ lat: 46.5416, lon: 10.4332 }, 6, elements);
    expect(found.map((n) => n.id)).toEqual([30]);
  });

  test("the bbox is a box around the point, lon first", () => {
    const [minLon, minLat, maxLon, maxLat] = mapBbox(
      { lat: 46.5416, lon: 10.4332 },
      6,
    )
      .split(",")
      .map(Number) as [number, number, number, number];
    expect(minLat).toBeLessThan(46.5416);
    expect(maxLat).toBeGreaterThan(46.5416);
    // 6 km of latitude is 0.054°; the same in longitude is wider at 46°.
    expect(maxLat - minLat).toBeCloseTo(0.108, 2);
    expect(maxLon - minLon).toBeGreaterThan(maxLat - minLat);
  });
});
