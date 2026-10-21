import { expect, test } from "bun:test";

import { DE } from "@/lib/i18n/dictionaries";
import {
  minzoomOf,
  newcomerBelow,
  PROMINENCE,
  prominenceFilter,
  prominenceWord,
  rankOf,
  SIZE_STOPS,
} from "@/lib/prominence";

test("classics are always drawn, the rest join one rank per step", () => {
  expect(minzoomOf(5)).toBe(0);
  expect(minzoomOf(4)).toBe(0);
  expect(minzoomOf(3)).toBe(PROMINENCE[1].fromZoom);
  expect(minzoomOf(2)).toBe(PROMINENCE[2].fromZoom);
  expect(minzoomOf(1)).toBe(PROMINENCE[3].fromZoom);
  expect(minzoomOf(0)).toBe(PROMINENCE[3].fromZoom);
});

test("a dead end counts a step lower, a classic never does", () => {
  expect(rankOf({ fame: 3, type: "pass" })).toBe(3);
  expect(rankOf({ fame: 3, type: "spur" })).toBe(2);
  expect(rankOf({ fame: 2, type: "valley" })).toBe(1);
  expect(rankOf({ fame: 1, type: "balcony" })).toBe(0);
  expect(rankOf({ fame: 4, type: "spur" })).toBe(4);
  expect(rankOf({ fame: 5, type: "spur" })).toBe(5);
});

test("the legend names the level and falls silent once everything is drawn", () => {
  expect(prominenceWord(6.5, DE)).toBe("Klassiker");
  expect(prominenceWord(7.5, DE)).toBe("Klassiker und bekannte Straßen");
  expect(prominenceWord(8.49, DE)).toBe("Klassiker und bekannte Straßen");
  expect(prominenceWord(8.5, DE)).toBe("die meisten Straßen");
  expect(prominenceWord(9.5, DE)).toBeNull();
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
    7.5,
    [">=", ["get", "rank"], 3],
    8.5,
    [">=", ["get", "rank"], 2],
    9.5,
    true,
  ]);
});

test("a rank is quiet at the step it joins and whole one step later", () => {
  expect(SIZE_STOPS).toEqual([6, 7.5, 8.5, 9.5, 10.5, 12]);
  expect(newcomerBelow(6)).toBeNull();
  // At 7.5 the rank-3 roads have just joined; the classics are whole.
  expect(newcomerBelow(7.5)).toBe(4);
  expect(newcomerBelow(8.5)).toBe(3);
  expect(newcomerBelow(9.5)).toBe(2);
  expect(newcomerBelow(10.5)).toBeNull();
  // The stops ascend, or MapLibre refuses the interpolate.
  expect(SIZE_STOPS.toSorted((a, b) => a - b)).toEqual([...SIZE_STOPS]);
});
