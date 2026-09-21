import { describe, expect, test } from "bun:test";

import {
  fitInset,
  NO_INSET,
  sameInset,
  shellEdge,
  toInset,
} from "@/lib/map-camera";

test("toInset fills in the sides MapLibre leaves out", () => {
  expect(toInset({ left: 400 })).toEqual({
    bottom: 0,
    left: 400,
    right: 0,
    top: 0,
  });
  expect(toInset()).toEqual(NO_INSET);
});

test("sameInset compares all four edges", () => {
  const a = { bottom: 440, left: 12, right: 0, top: 0 };
  expect(sameInset(a, { ...a })).toBe(true);
  expect(sameInset(a, { ...a, bottom: 80 })).toBe(false);
  expect(sameInset(a, { ...a, top: 1 })).toBe(false);
});

describe("fitInset", () => {
  test("is the plain breathing room while the padding stays put", () => {
    const now = { bottom: 80, left: 12, right: 0, top: 0 };
    expect(fitInset(now, now, 60)).toEqual({
      bottom: 60,
      left: 60,
      right: 60,
      top: 60,
    });
  });

  test("the sheet growing takes half of the growth off each edge", () => {
    // The detail sheet opens: 80 px of padding below become 440.
    const fit = fitInset(
      { bottom: 80, left: 0, right: 0, top: 0 },
      { bottom: 440, left: 0, right: 0, top: 0 },
      60,
    );
    // The box loses the 360 px the sheet took …
    expect(fit.top + fit.bottom).toBe(60 + 60 + 360);
    // … and stays centred where the camera lands, so the sides keep their
    // difference – here zero.
    expect(fit.top).toBe(fit.bottom);
    expect(fit.left).toBe(60);
    expect(fit.right).toBe(60);
  });

  test("a panel that folds away gives the space back", () => {
    const fit = fitInset(
      { bottom: 0, left: 760, right: 0, top: 0 },
      { bottom: 0, left: 396, right: 0, top: 0 },
      48,
    );
    expect(fit.left + fit.right).toBe(48 + 48 - 364);
    expect(fit.top).toBe(48);
  });
});

describe("shellEdge", () => {
  test("a phone's bar carries the controls and covers its height", () => {
    expect(shellEdge(true, 96, 400, 12)).toEqual({
      controls: 96,
      cover: 96,
      left: 0,
    });
  });
  test("a desktop card stands beside the panels and covers the gap too", () => {
    expect(shellEdge(false, 80, 396, 12)).toEqual({
      controls: 0,
      cover: 92,
      left: 396,
    });
  });
  test("with no panel open the card keeps the gap from the left edge", () => {
    expect(shellEdge(false, 80, 0, 12).left).toBe(12);
  });
});
