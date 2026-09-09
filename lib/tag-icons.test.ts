import { describe, expect, test } from "bun:test";

import { TOWN_TAGS } from "@/lib/regions";
import { TAG_ICON, tagIconSvg } from "@/lib/tag-icons";

describe("TAG_ICON", () => {
  test("every label has a glyph and every glyph a label", () => {
    expect(Object.keys(TAG_ICON).toSorted()).toEqual([...TOWN_TAGS].toSorted());
  });

  test("the copied Lucide nodes carry no React key", () => {
    for (const node of Object.values(TAG_ICON))
      for (const [element, attrs] of node) {
        expect(["circle", "path"]).toContain(element);
        expect(attrs).not.toHaveProperty("key");
      }
  });
});

describe("tagIconSvg", () => {
  test("markup MapLibre can put into a popup", () => {
    const svg = tagIconSvg("workshops");
    expect(svg).toStartWith("<svg ");
    expect(svg).toEndWith("</svg>");
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('width="12"');
    expect(svg).toContain("<path ");
    // Nothing from the data files reaches it, so nothing needs escaping.
    expect(svg).not.toContain("&");
  });

  test("the size is the only thing that varies", () => {
    expect(tagIconSvg("season", 16)).toContain('height="16"');
  });
});
