import { expect, test } from "bun:test";

import { hasRoadSummit, isTraverse, rangeRows } from "@/lib/regions";

test("a Steige is climbed to its marker, and its marker is the road's top", () => {
  expect(isTraverse("climb")).toBe(false);
  expect(hasRoadSummit({ type: "climb" })).toBe(true);
});

test("the range chips read as one row until each trip holds a choice", () => {
  expect(rangeRows(["Alpen", "Vogesen"])).toEqual([
    { row: ["Alpen", "Vogesen"], trip: null },
  ]);
  // The holiday ranges come first even in one row.
  expect(rangeRows(["Vogesen", "Jura", "Alpen"])).toEqual([
    { row: ["Alpen", "Vogesen", "Jura"], trip: null },
  ]);
  expect(rangeRows(["Alpen", "Vogesen", "Jura", "Pyrenäen"])).toEqual([
    { row: ["Alpen", "Pyrenäen"], trip: "holiday" },
    { row: ["Vogesen", "Jura"], trip: "weekend" },
  ]);
});
