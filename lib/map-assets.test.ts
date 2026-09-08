import { describe, expect, test } from "bun:test";

import {
  bounds,
  mapAssets,
  routeFeatures,
  simplify,
  tourFeatures,
} from "@/lib/map-assets";
import type { Pass, RouteGeometry, Tour } from "@/lib/types";

/** A straight road with a bump of `bumpM` metres in the middle. */
const road = (bumpM: number): RouteGeometry => {
  const degPerM = 1 / 111_320;
  return [
    [46, 9],
    [46 + 100 * degPerM, 9],
    [46 + 200 * degPerM, 9 + (bumpM * degPerM) / 0.7],
    [46 + 300 * degPerM, 9],
    [46 + 400 * degPerM, 9],
  ];
};

describe("simplify", () => {
  test("keeps the endpoints and drops collinear points", () => {
    const out = simplify(road(0));
    expect(out).toEqual([road(0)[0]!, road(0)[4]!]);
  });

  test("keeps a point that deviates by more than the tolerance", () => {
    // The 20 m bump stays; its neighbours sit 10 m off the new diagonals and go.
    const out = simplify(road(20), 12);
    expect(out).toHaveLength(3);
    expect(out[1]).toEqual(road(20)[2]!);
    // At 5 m those neighbours are kept as well.
    expect(simplify(road(20), 5)).toHaveLength(5);
  });

  test("drops a point that deviates by less than the tolerance", () => {
    expect(simplify(road(2), 5)).toHaveLength(2);
  });

  test("leaves a two-point line alone", () => {
    const two: RouteGeometry = [
      [46, 9],
      [46.1, 9.1],
    ];
    expect(simplify(two)).toBe(two);
  });
});

test("bounds are west, south, east, north", () => {
  expect(
    bounds([
      [46.5, 9.2],
      [46.1, 9.9],
      [46.3, 9],
    ]),
  ).toEqual([9, 46.1, 9.9, 46.5]);
});

const pass = {
  ascents: [
    { from: { lat: 46, lon: 9 }, label: "Nord" },
    { from: { lat: 46.2, lon: 9 }, label: "Süd" },
  ],
  name: "Testpass",
  slug: "testpass",
} as Pass;
const tour = {
  color: "#123456",
  elevationGain: 3000,
  km: 120,
  name: "Testrunde",
  slug: "testrunde",
} as Tour;
const routes: Record<string, RouteGeometry> = {
  "testpass:0": road(0),
  "tour:testrunde": road(20),
};

describe("features", () => {
  test("ascents without a route are left out, coordinates are lon/lat", () => {
    const f = routeFeatures([pass], routes);
    expect(f).toHaveLength(1);
    expect(f[0]!.id).toBe("testpass:0");
    expect(f[0]!.properties).toEqual({
      id: "testpass:0",
      kind: "route",
      name: "Testpass",
      slug: "testpass",
      subtitle: "Auffahrt ab Nord",
    });
    expect(f[0]!.geometry.coordinates[0]).toEqual([9, 46]);
  });

  test("tours carry colour and a German subtitle", () => {
    const f = tourFeatures([tour], routes);
    expect(f[0]!.properties).toEqual({
      color: "#123456",
      id: "testrunde",
      kind: "tour",
      name: "Testrunde",
      slug: "testrunde",
      subtitle: "ca. 120 km · 3.000 hm",
    });
    expect(tourFeatures([{ ...tour, slug: "ohne-route" }], routes)).toEqual([]);
  });
});

describe("mapAssets", () => {
  test("names files by content and lists bounds only for routed tours", () => {
    const { assets, files } = mapAssets(
      [pass],
      [tour, { ...tour, slug: "ohne-route" }],
      routes,
    );
    expect(files.map((f) => f.name)).toEqual([
      expect.stringMatching(/^routes\.[0-9a-f]{8}\.geojson$/u),
      expect.stringMatching(/^tours\.[0-9a-f]{8}\.geojson$/u),
    ]);
    expect(assets.routesUrl).toBe(`/map/${files[0]!.name}`);
    expect(assets.toursUrl).toBe(`/map/${files[1]!.name}`);
    expect(Object.keys(assets.tourBounds)).toEqual(["testrunde"]);
    expect(JSON.parse(files[1]!.body).features).toHaveLength(1);
  });

  test("the same content gives the same name, other content another", () => {
    const a = mapAssets([pass], [tour], routes).files[0]!.name;
    const b = mapAssets([pass], [tour], routes).files[0]!.name;
    const c = mapAssets([{ ...pass, name: "Anders" }], [tour], routes).files[0]!
      .name;
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
