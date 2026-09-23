import { describe, expect, test } from "bun:test";

import { boxOf, simplify, sketch } from "./sketch";

describe("simplify", () => {
  test("drops what lies within the tolerance, keeps the corners", () => {
    expect(
      simplify(
        [
          [0, 0],
          [5, 0.2],
          [10, 0],
          [10, 10],
        ],
        0.5,
      ),
    ).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
  });
});

describe("sketch", () => {
  const box = [6, 45, 8, 47] as const;

  test("north is up, west is left, the height follows the projection", () => {
    const { height, summits } = sketch([], [[46, 7]], box, 200);
    // Web Mercator stretches latitude: 2° of it at 46° N are taller than wide.
    expect(height).toBeGreaterThan(200);
    const [x, y] = summits[0] ?? [0, 0];
    expect(x).toBe(100);
    expect(y).toBeGreaterThan(height / 2 - 5);
    expect(y).toBeLessThan(height / 2 + 5);
  });

  test("a road becomes one relative path, thinned to whole pixels", () => {
    const { roads } = sketch(
      [
        [
          [46, 6.5],
          [46, 6.5001],
          [46, 7],
          [46.5, 7],
        ],
      ],
      [],
      box,
      200,
    );
    expect(roads).toMatch(/^M50 \d+l50 0l0-\d+$/u);
  });

  test("roads and summits outside the box are left out", () => {
    const out = sketch([[[40, 1]]], [[40, 1]], box, 200);
    expect(out.roads).toBe("");
    expect(out.summits).toEqual([]);
  });

  test("the box around points grows by its padding", () => {
    expect(
      boxOf(
        [
          [45, 6],
          [47, 8],
        ],
        0.5,
      ),
    ).toEqual([5, 44, 9, 48]);
  });
});
