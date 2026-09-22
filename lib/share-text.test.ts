import { describe, expect, test } from "bun:test";

import { entityDescription, entityTitle } from "@/lib/share-text";
import type { Destination } from "@/lib/types";
import { makePass, makeTour, makeTown } from "@/test/fixtures";

/**
 * The sentences a link preview shows, in both languages (plan 08). The
 * German ones are the source and stay byte for byte; the English ones read
 * the same data through `share.entity` and the English vocabulary.
 */
const pass = makePass("col-du-galibier", 0, {
  country: "FR",
  elevation: 2642,
  name: "Col du Galibier",
  note: "Wintersperre meist Ende Oktober bis Anfang Juni. Danach folgt mehr.",
  region: "Westalpen",
  type: "pass",
});
const tour = makeTour("sellaronda", ["a", "b", "c", "d"], {
  description: "Vier Pässe um den Sella. Ein Klassiker.",
  elevationGain: 1780,
  km: 55,
  name: "Sellaronda",
});
const town = makeTown("bormio", 0, {
  country: "IT",
  name: "Bormio",
  why: "Stilfser Joch, Gavia und Mortirolo vor der Tür. Und Thermen.",
});
const destination = {
  character: "Das Oisans ist rau. Und hoch.",
  country: "FR",
  multiDay: "Eine Woche reicht nicht. Zwei auch nicht.",
  name: "Oisans",
} as unknown as Destination;

describe("entityTitle", () => {
  test("German, the default", () => {
    expect(entityTitle({ kind: "pass", pass })).toBe(
      "Col du Galibier · 2.642\u00A0m",
    );
    expect(entityTitle({ kind: "tour", tour })).toBe("Sellaronda · Rundtour");
    expect(entityTitle({ kind: "town", town })).toBe("Bormio · Rad-Ort");
    expect(entityTitle({ destination, kind: "destination" })).toBe(
      "Oisans · Reiseziel",
    );
  });

  test("English", () => {
    expect(entityTitle({ kind: "pass", pass }, "en")).toBe(
      "Col du Galibier · 2,642\u00A0m",
    );
    expect(entityTitle({ kind: "tour", tour }, "en")).toBe("Sellaronda · Loop");
    expect(entityTitle({ kind: "town", town }, "en")).toBe(
      "Bormio · Cycling town",
    );
    expect(entityTitle({ destination, kind: "destination" }, "en")).toBe(
      "Oisans · Destination",
    );
  });
});

describe("entityDescription", () => {
  test("German: the type, the range, the country, then the season and the first sentence", () => {
    expect(entityDescription({ kind: "pass", pass })).toMatch(
      /^Pass in den Alpen \(FR\)\. .+ Wintersperre meist Ende Oktober bis Anfang Juni\.$/u,
    );
    expect(entityDescription({ kind: "tour", tour })).toBe(
      "Rundtour, ca. 55 km und 1.780 hm über 4 Pässe. Vier Pässe um den Sella.",
    );
    expect(entityDescription({ kind: "town", town })).toBe(
      "Rad-Ort (IT). Stilfser Joch, Gavia und Mortirolo vor der Tür.",
    );
    expect(entityDescription({ destination, kind: "destination" })).toBe(
      "Reiseziel (FR). Das Oisans ist rau. Eine Woche reicht nicht.",
    );
  });

  test("English: the same shape in English words and numbers", () => {
    expect(entityDescription({ kind: "pass", pass }, "en")).toMatch(
      /^Pass in the Alps \(FR\)\. .+ Wintersperre meist Ende Oktober bis Anfang Juni\.$/u,
    );
    expect(entityDescription({ kind: "tour", tour }, "en")).toBe(
      "Loop, about 55 km and 1,780 m of climbing over 4 passes. Vier Pässe um den Sella.",
    );
    expect(entityDescription({ kind: "town", town }, "en")).toBe(
      "Cycling town (IT). Stilfser Joch, Gavia und Mortirolo vor der Tür.",
    );
    expect(entityDescription({ destination, kind: "destination" }, "en")).toBe(
      "Destination (FR). Das Oisans ist rau. Eine Woche reicht nicht.",
    );
  });
});
