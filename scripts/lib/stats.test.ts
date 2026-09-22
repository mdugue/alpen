import { describe, expect, test } from "bun:test";

import { quantile } from "./stats";

describe("quantile", () => {
  const sample = [5, 1, 4, 2, 3];

  test("reads the ends of the distribution off the ends of the data", () => {
    expect(quantile(sample, 0)).toBe(1);
    expect(quantile(sample, 1)).toBe(5);
  });

  test("takes the value at the share, never one past it", () => {
    expect(quantile(sample, 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(quantile(sample, 0.9)).toBe(4);
  });

  test("of one value is that value, of none is nothing", () => {
    expect(quantile([7], 0.25)).toBe(7);
    expect(quantile([], 0.5)).toBe(0);
  });
});
