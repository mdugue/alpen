import { describe, expect, test } from "bun:test";

import { sheetCover, shellGeometry } from "@/lib/shell-geometry";
import type { ShellInput } from "@/lib/shell-geometry";

/** A phone: no panels, the season bar along the bottom edge. */
const phone: ShellInput = {
  bars: { header: 56, season: 96 },
  panels: { detail: false, sidebar: false },
  sheet: { inset: 8, snap: 0 },
  viewport: { height: 800, mobile: true, wide: false },
};

/** A desktop at `lg`, both panels open. */
const desktop: ShellInput = {
  bars: { header: 64, season: 80 },
  panels: { detail: true, sidebar: true },
  sheet: { inset: 8, snap: 0 },
  viewport: { height: 900, mobile: false, wide: false },
};

describe("sheetCover", () => {
  test("a fraction is of the viewport, and the drawer's margin comes on top", () => {
    expect(sheetCover({ inset: 8, snap: 0.55 }, 800)).toBe(448);
  });
  test("a snap point above 1 is already in pixels", () => {
    expect(sheetCover({ inset: 8, snap: 80 }, 800)).toBe(88);
  });
  test("no sheet covers nothing at all, margin included", () => {
    expect(sheetCover({ inset: 8, snap: 0 }, 800)).toBe(0);
  });
});

describe("shellGeometry · a phone", () => {
  test("the bars are the padding and the corner controls stand on the bar", () => {
    const { inset, vars } = shellGeometry(phone);
    expect(inset).toEqual({ bottom: 96, left: 0, right: 0, top: 56 });
    expect(vars["--shell-bottom"]).toBe("96px");
    expect(vars["--shell-left"]).toBe("0px");
  });

  test("the drawer in front of the map outweighs the bar behind it", () => {
    const { inset } = shellGeometry({
      ...phone,
      sheet: { inset: 8, snap: 0.55 },
    });
    expect(inset.bottom).toBe(448);
  });

  test("a drawer on its peek row covers less than the bar, which still counts", () => {
    const { inset } = shellGeometry({
      ...phone,
      sheet: { inset: 8, snap: 80 },
    });
    expect(inset.bottom).toBe(96);
  });

  test("no panel takes the left, whatever the desktop panels would say", () => {
    const { inset } = shellGeometry({
      ...phone,
      panels: { detail: true, sidebar: true },
    });
    expect(inset.left).toBe(0);
  });
});

describe("shellGeometry · a desktop", () => {
  test("both panels: their widths, the gaps, and the card beside them", () => {
    const { inset, vars } = shellGeometry(desktop);
    // 12 + 384 + 12 + 352 + 12
    expect(inset.left).toBe(772);
    // The card stands a gap above the bottom edge, so it covers that too.
    expect(inset.bottom).toBe(92);
    expect(inset.top).toBe(64);
    expect(vars["--shell-sidebar"]).toBe("384px");
    expect(vars["--shell-detail"]).toBe("352px");
    expect(vars["--shell-detail-left"]).toBe("408px");
    expect(vars["--shell-left"]).toBe("772px");
    // The controls sit at the edge, in the corner the card leaves free.
    expect(vars["--shell-bottom"]).toBe("0px");
    expect(vars["--shell-right"]).toBe("160px");
  });

  test("one panel: the sidebar alone, and the detail alone", () => {
    const sidebar = shellGeometry({
      ...desktop,
      panels: { detail: false, sidebar: true },
    });
    expect(sidebar.inset.left).toBe(408);
    expect(sidebar.vars["--shell-detail-left"]).toBe("408px");

    const detail = shellGeometry({
      ...desktop,
      panels: { detail: true, sidebar: false },
    });
    expect(detail.inset.left).toBe(376);
    // With no sidebar the detail panel stands at the gap itself.
    expect(detail.vars["--shell-detail-left"]).toBe("12px");
  });

  test("no panel: nothing on the left, and the card keeps the gap", () => {
    const { inset, vars } = shellGeometry({
      ...desktop,
      panels: { detail: false, sidebar: false },
    });
    expect(inset.left).toBe(0);
    expect(vars["--shell-left"]).toBe("12px");
  });

  test("the wider step grows both panels, and everything derived from them", () => {
    const { inset, vars } = shellGeometry({
      ...desktop,
      viewport: { ...desktop.viewport, wide: true },
    });
    expect(inset.left).toBe(852);
    expect(vars["--shell-sidebar"]).toBe("416px");
    expect(vars["--shell-detail"]).toBe("400px");
    expect(vars["--shell-detail-left"]).toBe("440px");
  });
});
