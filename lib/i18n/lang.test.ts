import { describe, expect, test } from "bun:test";

import { langCookie, preferredLang } from "@/lib/i18n/lang";

describe("preferredLang", () => {
  test("a picked language wins over the browser's", () => {
    expect(preferredLang("de", "en-US,en;q=0.9")).toBe("de");
    expect(preferredLang("en", "de-DE,de;q=0.9")).toBe("en");
  });

  test("a cookie that is no language is ignored", () => {
    expect(preferredLang("fr", "en-GB")).toBe("en");
  });

  test("the browser's first language the app speaks, by quality", () => {
    expect(preferredLang(undefined, "en-US,en;q=0.9,de;q=0.8")).toBe("en");
    expect(preferredLang(undefined, "de-CH,de;q=0.9,en;q=0.8")).toBe("de");
    expect(preferredLang(undefined, "fr-FR,fr;q=0.9,en;q=0.8")).toBe("en");
    expect(preferredLang(undefined, "en;q=0.5,de;q=0.7")).toBe("de");
    // Equal quality: the order the browser listed them in.
    expect(preferredLang(undefined, "en,de")).toBe("en");
  });

  test("German without a match, and for what says nothing", () => {
    expect(preferredLang(undefined, null)).toBe("de");
    expect(preferredLang(undefined, "")).toBe("de");
    expect(preferredLang(undefined, "fr-FR,it;q=0.8")).toBe("de");
    expect(preferredLang(undefined, "*")).toBe("de");
    expect(preferredLang(undefined, "en;q=0,fr")).toBe("de");
    expect(preferredLang(undefined, "en;q=abc")).toBe("de");
  });
});

test("the cookie is the one the proxy reads, for the whole site", () => {
  expect(langCookie("en", 0)).toMatchObject({
    name: "NEXT_LOCALE",
    path: "/",
    value: "en",
  });
  expect(langCookie("en", 0).expires).toBeGreaterThan(300 * 86_400_000);
});
