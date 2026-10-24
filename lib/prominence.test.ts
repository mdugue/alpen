import { expect, test } from "bun:test";

import { rankOf } from "@/lib/prominence";
import type { RoadType } from "@/lib/types";

const road = (fame: number, type: RoadType = "pass", beauty = 4) => ({
  beauty,
  fame,
  type,
});

test("a dead end counts a step lower, a pearl a step higher, a classic stays", () => {
  expect(rankOf(road(3))).toBe(3);
  expect(rankOf(road(3, "spur"))).toBe(2);
  expect(rankOf(road(2, "valley"))).toBe(1);
  expect(rankOf(road(1, "balcony"))).toBe(0);
  expect(rankOf(road(3, "pass", 5))).toBe(4);
  expect(rankOf(road(2, "spur", 5))).toBe(2);
  expect(rankOf(road(4, "spur"))).toBe(4);
  expect(rankOf(road(5, "spur", 5))).toBe(5);
});
