import { describe, expect, test } from "bun:test";

import {
  docUnit,
  misquoted,
  misquotedIn,
  quotes,
  spellKm,
  spellM,
  spellPct,
} from "./quoted";

describe("the spellings the documents use", () => {
  test("distances, heights and shares read like the prose", () => {
    expect(spellKm(0.5)).toBe("500 m");
    expect(spellKm(0.1)).toBe("100 m");
    expect(spellKm(2)).toBe("2 km");
    expect(spellKm(60)).toBe("60 km");
    expect(spellM(80)).toBe("80 m");
    expect(spellM(3000)).toBe("3 000 m");
    expect(spellM(1_250_000)).toBe("1 250 000 m");
    expect(spellPct(0.15)).toBe("15 %");
    expect(spellPct(1 - 0.75)).toBe("25 %");
  });

  test("the day length is the one unit the table abbreviates", () => {
    expect(docUnit("10,75 Stunden")).toBe("10,75 h");
    expect(docUnit("20 %")).toBe("20 %");
    expect(docUnit("26 °C")).toBe("26 °C");
  });
});

describe("quotes", () => {
  test("finds a value as a whole number only", () => {
    expect(quotes("summit tmax < 8 °C", "8 °C")).toBe(true);
    expect(quotes("summit tmax < 18 °C", "8 °C")).toBe(false);
    expect(quotes("fewer than 10 % snow days", "10 %")).toBe(true);
    expect(quotes("about 110 % of it", "10 %")).toBe(false);
    expect(quotes("lapse 0,65 °C", "0,65 °C")).toBe(true);
    expect(quotes("10,65 °C", "0,65 °C")).toBe(false);
  });
});

describe("misquoted", () => {
  const list = [
    { constant: "X", files: ["a.md", "b.md"], text: "60 km" },
    { constant: "Y", files: ["a.md"], text: "80 m" },
  ];
  test("names the document and the constant whose number it lacks", () => {
    const docs: Record<string, string> = {
      "a.md": "at most 60 km, top within 80 m",
      "b.md": "at most 50 km",
    };
    expect(misquoted((f) => docs[f]!, list)).toEqual([
      "b.md nennt X nicht als „60 km“ – die Zahl im Text nachziehen (scripts/lib/quoted.ts sagt, wo)",
    ]);
  });

  test("is silent when every document carries the current number", () => {
    expect(misquoted(() => "60 km and 80 m", list)).toEqual([]);
  });

  test("the real documents quote every constant as it is today", async () => {
    expect(await misquotedIn(new URL("../../", import.meta.url))).toEqual([]);
  });
});
