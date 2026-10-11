import { describe, expect, test } from "bun:test";

import type { LatLon } from "../../lib/types";
import { makePass } from "../../test/fixtures";
import { boxAround, branchesOf, rankBranches } from "./branches";
import type { OsmElement } from "./hosts";

/**
 * A route due north along lon 10, and three roads off it:
 *
 * - node 10 → 11 → 12: a dead end east, the detour;
 * - node 20 → 21 → 22, back onto the route 2 km further on: a parallel road;
 * - node 30 → 31 → 32 west, out to the edge of the box: a road elsewhere.
 */
const route: [number, number][] = [
  [46, 10],
  [46.01, 10],
  [46.02, 10],
  [46.03, 10],
];
const node = (id: number, lat: number, lon: number): OsmElement => ({
  id,
  lat,
  lon,
  type: "node",
});
const way = (id: number, nodes: number[], name?: string): OsmElement => ({
  id,
  nodes,
  tags: name ? { name } : undefined,
  type: "way",
});
const box = boxAround([route], 3);
const elements: OsmElement[] = [
  node(1, 46, 10),
  node(2, 46.01, 10),
  node(3, 46.02, 10),
  node(4, 46.03, 10),
  way(100, [1, 2, 3, 4], "Passstraße"),
  node(11, 46.011, 10.005),
  node(12, 46.012, 10.01),
  way(101, [2, 11, 12], "Gipfelstraße"),
  node(21, 46.005, 10.003),
  node(22, 46.015, 10.003),
  way(102, [1, 21, 22, 3]),
  node(31, 46.02, 9.99),
  node(32, 46.02, box.minLon + 0.001),
  way(103, [3, 31, 32]),
  {
    id: 900,
    lat: 46.012,
    lon: 10.0101,
    tags: { name: "Aussicht" },
    type: "node",
  },
];

describe("branchesOf", () => {
  test("keeps the dead end and drops the parallel road and the road out of the box", () => {
    const branches = branchesOf([route], elements, box);
    expect(branches).toHaveLength(1);
    expect(branches[0]!.junction).toEqual({ lat: 46.01, lon: 10 });
    expect(branches[0]!.ends.map((e) => e.name)).toEqual(["Gipfelstraße"]);
    expect(branches[0]!.ends[0]!.km).toBeGreaterThan(0.7);
  });
});

/** The junction at 1500 m, every end at `top`. */
const heights = (top: number) => (p: LatLon) =>
  p.lat === 46.01 && p.lon === 10 ? 1500 : top;

describe("rankBranches", () => {
  const branches = branchesOf([route], elements, box);
  const places = [{ lat: 46.012, lon: 10.0101, name: "Aussicht" }];

  test("names the end after the place there and says whether it is listed", () => {
    const [c] = rankBranches(branches, heights(1700), places, []);
    expect(c).toMatchObject({ gain: 200, listed: null, name: "Aussicht" });
    const listed = makePass("aussicht", 0, { lat: 46.012, lon: 10.01 });
    expect(
      rankBranches(branches, heights(1700), places, [listed])[0]!.listed,
    ).toBe("aussicht");
  });

  test("drops a dead end that does not climb enough", () => {
    expect(rankBranches(branches, heights(1550), places, [])).toEqual([]);
  });
});
