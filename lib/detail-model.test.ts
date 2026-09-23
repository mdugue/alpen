import { describe, expect, test } from "bun:test";

import { detailModel } from "@/lib/detail-model";
import type { DetailState } from "@/lib/detail-state";
import { DE } from "@/lib/i18n/dictionaries";
import { entityKey } from "@/lib/route-key";
import {
  bundleOf,
  makePass,
  makeTour,
  makeTown,
  PERIOD,
  yearsOf,
} from "@/test/fixtures";

const passes = [makePass("stilfser-joch", 0), makePass("gavia", 20)];
const tours = [makeTour("runde", ["stilfser-joch", "gavia"])];
const towns = [makeTown("bormio", 8)];
const years = yearsOf(
  [
    ["stilfser-joch", "best"],
    ["gavia", "limited"],
  ],
  [["runde", "limited"]],
);
const absent: DetailState = { phase: "absent" };

const data = bundleOf(passes, tours, towns, years, {
  nearbyTours: {
    [entityKey("pass", "stilfser-joch")]: [{ km: 3, slug: "runde" }],
    [entityKey("town", "bormio")]: [{ km: 5, slug: "runde" }],
    [entityKey("tour", "runde")]: [{ km: 0, slug: "runde" }],
  },
});

const modelOf = (kind: "pass" | "tour" | "town", slug: string) => {
  const model = detailModel({ kind, slug }, data, {
    detail: absent,
    hovered: null,
    period: PERIOD,
    w: DE,
  });
  // The three kinds with a point of their own; an area has no reach block.
  return model?.kind === "destination" ? null : model;
};

describe("detailModel", () => {
  test("an entity the page does not have resolves to nothing", () => {
    expect(modelOf("pass", "weg")).toBeNull();
    expect(modelOf("tour", "weg")).toBeNull();
    expect(modelOf("town", "weg")).toBeNull();
  });

  test("the kicker is a three-row table, not three branches in JSX", () => {
    expect(modelOf("pass", "stilfser-joch")!.kicker).toContain(
      "Zentralalpen · IT",
    );
    expect(modelOf("tour", "runde")!.kicker).toBe("Rundtour");
    expect(modelOf("town", "bormio")!.kicker).toBe("Rad-Ort · IT");
  });

  test("every German sentence comes out of the model, not out of JSX", () => {
    const m = modelOf("pass", "stilfser-joch")!;
    if (m.kind !== "pass") throw new Error("kind");
    expect(m.sentences.season).toContain("Juni");
    expect(m.sentences.note).toBe("Notiz zu stilfser-joch.");
    // No climate series in this fixture, so the derived paragraph is absent
    // rather than a sentence with holes in it.
    expect(m.sentences.climate).toBeNull();
    expect(m.verdict.year).toBe(years.passes["stilfser-joch"]);
  });

  test("a pass claims the towns, a town claims the passes", () => {
    const pass = modelOf("pass", "stilfser-joch")!;
    if (pass.kind !== "pass") throw new Error("kind");
    expect(pass.reach.towns).toEqual([]);
    expect(pass.bases.total).toBe(1);

    const town = modelOf("town", "bormio")!;
    if (town.kind !== "town") throw new Error("kind");
    expect(town.reach.passes).toEqual([]);
    expect(town.destination.total).toBe(2);
  });

  test("the nearby lists leave the entity itself out", () => {
    const pass = modelOf("pass", "stilfser-joch")!;
    expect(pass.reach.passes.map((r) => r.pass.slug)).toEqual(["gavia"]);
    const town = modelOf("town", "bormio")!;
    expect(town.reach.towns).toEqual([]);
  });

  test("a tour reads its members through the index the explorer already holds", () => {
    const m = modelOf("tour", "runde")!;
    if (m.kind !== "tour") throw new Error("kind");
    expect(m.members.map(({ pass }) => pass.slug)).toEqual([
      "stilfser-joch",
      "gavia",
    ]);
    expect(m.members[1]!.cell.status).toBe("risky");
  });

  test("the tours within reach are the ones the server measured for this entity", () => {
    expect(modelOf("pass", "gavia")!.reach.tours).toEqual([]);
    expect(
      modelOf("pass", "stilfser-joch")!.reach.tours.map((r) => r.tour.slug),
    ).toEqual(["runde"]);
  });
});
