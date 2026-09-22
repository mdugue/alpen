import { describe, expect, test } from "bun:test";

import { applyScene, popupHtml } from "@/components/map/apply-scene";
import type { SceneHost } from "@/components/map/apply-scene";
import { ALL_SHOWN } from "@/lib/app-state";
import { LAYERS, SOURCE } from "@/lib/layer-ids";
import { buildScene } from "@/lib/map-scene";
import type { SceneInput } from "@/lib/map-scene";
import { ascentKey } from "@/lib/route-key";
import type { PassRow, TownRow } from "@/lib/rows";
import { makePass, makeTown } from "@/test/fixtures";

/**
 * The applier against a host that only writes down what it was asked to do.
 * What is under test is the arithmetic of the diff: a scene is rebuilt on
 * every render and on every pointer move, and a `setData` on a source of two
 * hundred points re-tiles it in the worker – so what changed nothing must
 * cost nothing.
 */
interface Call {
  what: "data" | "filter" | "label" | "state";
  id: string;
}

const recorder = () => {
  const calls: Call[] = [];
  const host: SceneHost = {
    label: (content) => {
      calls.push({ id: content?.name ?? "—", what: "label" });
    },
    setData: (source) => {
      calls.push({ id: source, what: "data" });
    },
    setFeatureState: (target) => {
      calls.push({ id: target.id, what: "state" });
    },
    setFilter: (layer) => {
      calls.push({ id: layer, what: "filter" });
    },
  };
  return { calls, host };
};

const of = (calls: Call[], what: Call["what"]) =>
  calls.filter((c) => c.what === what).map((c) => c.id);

const galibier = makePass("galibier", 0, { name: "Col du Galibier" });
const stelvio = makePass("stelvio", 40, { name: "Stilfser Joch" });
const bormio = makeTown("bormio", 20, { name: "Bormio" });
const REACH: Record<string, [number, number][]> = {
  bormio: [
    [10, 46],
    [10.2, 46],
    [10.1, 46.2],
  ],
};

const row = (pass: typeof galibier): PassRow => ({
  favorite: false,
  pass,
  reason: null,
  season: [],
  status: "open",
});
const town: TownRow = { favorite: false, town: bormio };

const scene = (extra: Partial<SceneInput> = {}) =>
  buildScene({
    env: { coarse: false },
    hovered: null,
    profileCursor: null,
    rows: { pass: [row(galibier), row(stelvio)], tour: [], town: [town] },
    selection: null,
    shown: ALL_SHOWN,
    tourBounds: {},
    townReach: REACH,
    ...extra,
  });

describe("the first scene", () => {
  test("is applied whole: nothing has been said to the map yet", () => {
    const { calls, host } = recorder();
    applyScene(host, null, scene());
    expect(of(calls, "filter")).toEqual([
      LAYERS.route.mark,
      LAYERS.route.hit,
      LAYERS.tour.mark,
      ...LAYERS.tour.labels,
      LAYERS.tour.hit,
    ]);
    expect(of(calls, "state")).toEqual([
      ascentKey("galibier", 0),
      ascentKey("stelvio", 0),
    ]);
    expect(of(calls, "data")).toEqual([
      SOURCE.passes,
      SOURCE.towns,
      SOURCE.hover,
      SOURCE.cursor,
      SOURCE.reach,
    ]);
    expect(of(calls, "label")).toEqual(["—"]);
  });
});

describe("the difference", () => {
  test("a scene that says the same thing costs nothing", () => {
    const { calls, host } = recorder();
    // Two scenes built from equal inputs: the case of a pointer moving across
    // one dot, or a render nothing on the map depends on.
    applyScene(host, scene(), scene());
    expect(calls).toEqual([]);
  });

  test("a hover moves two lines, the ring and the label – and nothing else", () => {
    const { calls, host } = recorder();
    applyScene(
      host,
      scene({ hovered: { kind: "pass", slug: "galibier" } }),
      scene({ hovered: { kind: "pass", slug: "stelvio" } }),
    );
    // The one that was left and the one that was entered, never all of them.
    expect(of(calls, "state")).toEqual([
      ascentKey("galibier", 0),
      ascentKey("stelvio", 0),
    ]);
    // The marks stay where they are: no source is rewritten but the ring's.
    expect(of(calls, "data")).toEqual([SOURCE.hover]);
    expect(of(calls, "filter")).toEqual([]);
    expect(of(calls, "label")).toEqual(["Stilfser Joch"]);
  });

  test("a town hovered draws its reach, and letting go clears it", () => {
    const hovering = recorder();
    applyScene(
      hovering.host,
      scene(),
      scene({ hovered: { kind: "town", slug: "bormio" } }),
    );
    expect(of(hovering.calls, "data")).toEqual([SOURCE.hover, SOURCE.reach]);

    const leaving = recorder();
    applyScene(
      leaving.host,
      scene({ hovered: { kind: "town", slug: "bormio" } }),
      scene(),
    );
    expect(of(leaving.calls, "data")).toEqual([SOURCE.hover, SOURCE.reach]);
    expect(of(leaving.calls, "label")).toEqual(["—"]);
  });

  test("a filter changes only when what it lets through does", () => {
    const { calls, host } = recorder();
    applyScene(
      host,
      scene(),
      scene({ rows: { pass: [row(galibier)], tour: [], town: [town] } }),
    );
    expect(of(calls, "filter")).toEqual([LAYERS.route.mark, LAYERS.route.hit]);
    // The tours said nothing new, so their three layers were left alone.
    expect(of(calls, "filter")).not.toContain(LAYERS.tour.mark);
  });
});

describe("the label", () => {
  test("carries the name, the line under it and a glyph per label", () => {
    const html = popupHtml({
      anchor: [6.4, 45.06],
      name: "Col du Galibier",
      subtitle: "2.642 m",
      tags: ["hairpins"],
    });
    expect(html).toContain("<b>Col du Galibier</b>");
    expect(html).toContain("2.642 m");
    expect(html).toContain("<svg ");
    expect(html).toContain("Kehrenbauwerk");
  });

  test("escapes what comes out of the data files", () => {
    const html = popupHtml({
      anchor: [0, 0],
      name: '<script>"x"</script>',
      subtitle: null,
      tags: [],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
