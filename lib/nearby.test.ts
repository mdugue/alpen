import { expect, test } from "bun:test";

import { nearbyTours } from "@/lib/nearby";
import type { Pass, RouteGeometry, Tour, Town } from "@/lib/types";

// One degree of latitude is ~111 km; 0.5° ≈ 56 km, 1° ≈ 111 km.
const tour = {
  slug: "runde",
  waypoints: [
    { lat: 46, lon: 9 },
    { lat: 46.5, lon: 9 },
  ],
} as Tour;
const routes: Record<string, RouteGeometry> = {
  "tour:runde": [
    [46, 9],
    [46.25, 9],
    [46.5, 9],
  ],
};

test("a tour counts as nearby when any point of its road is within reach", () => {
  const out = nearbyTours(
    [
      { lat: 46.75, lon: 9, slug: "nah" } as Pass,
      { lat: 47.2, lon: 9, slug: "fern" } as Pass,
    ],
    [tour],
    [{ lat: 46.25, lon: 9.3, slug: "ort" } as Town],
    routes,
  );
  expect(out).toEqual({
    "pass:fern": [],
    "pass:nah": ["runde"],
    "tour:runde": ["runde"],
    "town:ort": ["runde"],
  });
});

test("without a routed geometry the waypoints stand in for the road", () => {
  const out = nearbyTours(
    [{ lat: 46.25, lon: 9.4, slug: "zwischen" } as Pass],
    [tour],
    [],
    {},
  );
  // 46.25/9.4 is ~44 km from either waypoint – near.
  expect(out["pass:zwischen"]).toEqual(["runde"]);
  expect(
    nearbyTours(
      [{ lat: 46.25, lon: 9.4, slug: "zwischen" } as Pass],
      [tour],
      [],
      {},
      30,
    )["pass:zwischen"],
  ).toEqual([]);
});
