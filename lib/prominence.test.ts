import { expect, test } from "bun:test";

import { DE } from "@/lib/i18n/dictionaries";
import { PASS_LABELS } from "@/lib/layer-ids";
import {
  minzoomOf,
  newcomerBelow,
  PROMINENCE,
  prominenceFilter,
  prominenceWord,
  rankOf,
  SIZE_STOPS,
} from "@/lib/prominence";
import type { RoadType } from "@/lib/types";

test("classics are always drawn, the rest join one rank per step", () => {
  expect(minzoomOf(5)).toBe(0);
  expect(minzoomOf(4)).toBe(0);
  expect(minzoomOf(3)).toBe(PROMINENCE[1].fromZoom);
  expect(minzoomOf(2)).toBe(PROMINENCE[2].fromZoom);
  expect(minzoomOf(1)).toBe(PROMINENCE[3].fromZoom);
  expect(minzoomOf(0)).toBe(PROMINENCE[3].fromZoom);
});

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
  // A known pearl joins the classics on the overview, drawn whole there.
  expect(rankOf(road(3, "pass", 5))).toBe(4);
  expect(minzoomOf(rankOf(road(3, "pass", 5)))).toBe(0);
  expect(newcomerBelow(PROMINENCE[1].fromZoom)).toBe(4);
  expect(rankOf(road(2, "spur", 5))).toBe(2);
  expect(rankOf(road(4, "spur"))).toBe(4);
  expect(rankOf(road(5, "spur", 5))).toBe(5);
});

test("every step is a whole zoom, which is where MapLibre evaluates a filter", () => {
  for (const p of PROMINENCE) expect(Number.isInteger(p.fromZoom)).toBe(true);
});

test("a name never appears before its dot", () => {
  for (const { minzoom, rank } of PASS_LABELS)
    expect(minzoom).toBeGreaterThanOrEqual(minzoomOf(rank));
  // The last label layer names every rank below it too.
  expect(PASS_LABELS.at(-1)!.minzoom).toBeGreaterThanOrEqual(minzoomOf(0));
});

test("the legend names the level and falls silent once everything is drawn", () => {
  expect(prominenceWord(7.9, DE)).toBe(
    "Klassiker und die schönsten bekannten Pässe",
  );
  expect(prominenceWord(8, DE)).toBe("Klassiker und bekannte Pässe");
  expect(prominenceWord(8.99, DE)).toBe("Klassiker und bekannte Pässe");
  expect(prominenceWord(9, DE)).toBe("die meisten Straßen");
  expect(prominenceWord(10, DE)).toBeNull();
  expect(prominenceWord(12, DE)).toBeNull();
});

test("the filter is one top-level step on the zoom with a branch per level", () => {
  const f = prominenceFilter((minRank) =>
    minRank === null ? true : [">=", ["get", "rank"], minRank],
  );
  expect(f).toEqual([
    "step",
    ["zoom"],
    [">=", ["get", "rank"], 4],
    8,
    [">=", ["get", "rank"], 3],
    9,
    [">=", ["get", "rank"], 2],
    10,
    true,
  ]);
});

test("a rank is quiet at the step it joins and whole one step later", () => {
  expect(SIZE_STOPS).toEqual([6, 8, 9, 10, 11, 12]);
  expect(newcomerBelow(6)).toBeNull();
  // At 8 the rank-3 roads have just joined; the classics are whole.
  expect(newcomerBelow(8)).toBe(4);
  expect(newcomerBelow(9)).toBe(3);
  expect(newcomerBelow(10)).toBe(2);
  expect(newcomerBelow(11)).toBeNull();
  // The stops ascend, or MapLibre refuses the interpolate.
  expect(SIZE_STOPS.toSorted((a, b) => a - b)).toEqual([...SIZE_STOPS]);
});
