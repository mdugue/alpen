import { describe, expect, test } from "bun:test";

import { ascentKey, entityKey, parseRouteKey, tourKey } from "./route-key";

describe("parseRouteKey", () => {
  test("is the inverse of the two builders", () => {
    expect(parseRouteKey(ascentKey("col-du-galibier", 1))).toEqual({
      index: 1,
      kind: "ascent",
      slug: "col-du-galibier",
    });
    expect(parseRouteKey(tourKey("marmotte"))).toEqual({
      kind: "tour",
      slug: "marmotte",
    });
  });

  test("a tour slug that looks like an ascent key is still a tour", () => {
    expect(parseRouteKey("tour:route-66")).toEqual({
      kind: "tour",
      slug: "route-66",
    });
  });

  test("anything neither builder could have written is no key", () => {
    for (const key of ["", "tour:", "stilfser-joch", "stilfser-joch:", ":0"])
      expect(parseRouteKey(key)).toBeNull();
  });

  test("an entity key is not a route key", () => {
    expect(parseRouteKey(entityKey("pass", "stilfser-joch"))).toBeNull();
    expect(parseRouteKey(entityKey("town", "bormio"))).toBeNull();
  });
});
