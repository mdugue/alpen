import { expect, test } from "bun:test";

import {
  minzoomOf,
  PROMINENCE,
  prominenceFilter,
  prominenceWord,
} from "@/lib/prominence";

test("famous passes are always drawn, the rest join by fame", () => {
  expect(minzoomOf(5)).toBe(0);
  expect(minzoomOf(4)).toBe(0);
  expect(minzoomOf(3)).toBe(PROMINENCE[1].fromZoom);
  expect(minzoomOf(2)).toBe(PROMINENCE[2].fromZoom);
  expect(minzoomOf(1)).toBe(PROMINENCE[2].fromZoom);
});

test("the legend names the level and falls silent once everything is drawn", () => {
  expect(prominenceWord(6.5)).toBe("berühmte Pässe");
  expect(prominenceWord(7.5)).toBe("bekannte Pässe");
  expect(prominenceWord(8.49)).toBe("bekannte Pässe");
  expect(prominenceWord(8.5)).toBeNull();
  expect(prominenceWord(12)).toBeNull();
});

test("the filter is one top-level step on the zoom with a branch per level", () => {
  const f = prominenceFilter((minFame) =>
    minFame === null ? true : [">=", ["get", "fame"], minFame],
  );
  expect(f).toEqual([
    "step",
    ["zoom"],
    [">=", ["get", "fame"], 4],
    7.5,
    [">=", ["get", "fame"], 3],
    8.5,
    true,
  ]);
});
