import { expect, test } from "bun:test";

import { rovingTarget } from "@/lib/use-roving";

/**
 * Where a key takes the focus inside a list of 201 rows – the arithmetic of
 * the composite widget, without the DOM the hook attaches it to.
 */
const ROWS = 201;

test("the arrows move by one, Page by ten, Home and End to the ends", () => {
  expect(rovingTarget("ArrowDown", 0, ROWS)).toBe(1);
  expect(rovingTarget("ArrowUp", 7, ROWS)).toBe(6);
  expect(rovingTarget("PageDown", 0, ROWS)).toBe(10);
  expect(rovingTarget("PageUp", 12, ROWS)).toBe(2);
  expect(rovingTarget("Home", 12, ROWS)).toBe(0);
  expect(rovingTarget("End", 12, ROWS)).toBe(ROWS - 1);
});

test("neither end runs past itself", () => {
  expect(rovingTarget("ArrowUp", 0, ROWS)).toBe(0);
  expect(rovingTarget("PageUp", 4, ROWS)).toBe(0);
  expect(rovingTarget("ArrowDown", ROWS - 1, ROWS)).toBe(ROWS - 1);
  expect(rovingTarget("PageDown", ROWS - 4, ROWS)).toBe(ROWS - 1);
});

test("a key the list has no use for stays the platform's", () => {
  // Enter opens the row, Tab leaves the widget, a letter goes to the search
  // field: none of them is a move inside the list, and none is swallowed.
  for (const key of ["Enter", " ", "Tab", "a", "Escape"])
    expect(rovingTarget(key, 3, ROWS)).toBeNull();
});

test("with the focus outside the rows the first move lands on the first row", () => {
  // -1 is "no row has the focus" – the list itself was tabbed into.
  expect(rovingTarget("ArrowDown", -1, ROWS)).toBe(0);
  expect(rovingTarget("ArrowUp", -1, ROWS)).toBe(0);
  // An empty list has nowhere to move to at all.
  expect(rovingTarget("ArrowDown", -1, 0)).toBeNull();
  expect(rovingTarget("End", -1, 0)).toBeNull();
});
