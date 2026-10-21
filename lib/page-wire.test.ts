import { describe, expect, test } from "bun:test";

import climateJson from "@/data/generated/climate.json" with { type: "json" };
import profilesJson from "@/data/generated/profiles.json" with { type: "json" };
import passesJson from "@/data/passes.json" with { type: "json" };
import toursJson from "@/data/tours.json" with { type: "json" };
import type { PageData } from "@/lib/page-data";
import { packPage, unpackPage } from "@/lib/page-wire";
import { valleyElevations } from "@/lib/profile";
import { passYear, signalsOf, tourYear } from "@/lib/status";
import type { Signals, Year } from "@/lib/status";
import type { ClimateYear, Pass, Tour } from "@/lib/types";

const passes = passesJson as Pass[];
const tours = toursJson as Tour[];
const climate = climateJson as unknown as Record<string, ClimateYear>;
const signals: Signals = {
  climate,
  valleys: valleyElevations(passes, profilesJson),
};

/** The years of the real data, the way `getYears` (lib/data.ts) grades them. */
const passYears: Record<string, Year> = Object.fromEntries(
  passes.map((p) => [p.slug, passYear(p, signalsOf(signals, p.slug))]),
);
const tourYears: Record<string, Year> = Object.fromEntries(
  tours.map((t) => [t.slug, tourYear(t, passYears)]),
);

/**
 * Only the two packed parts matter here; the rest of the page data passes
 * through untouched, so one stand-in field shows that it does.
 */
const page = {
  climate,
  passes,
  years: { passes: passYears, tours: tourYears },
} as unknown as PageData;

describe("packPage", () => {
  // Strict: a tour cell's empty `limiting` list must not come back missing,
  // nor a missing snow cover as `undefined`.
  test("unpacks to the page data it packed, for every pass and tour", () => {
    expect(unpackPage(packPage(page))).toStrictEqual(page);
  });

  test("is a fraction of the unpacked size", () => {
    const before = JSON.stringify({ climate, years: page.years }).length;
    const { climate: c, years } = packPage(page);
    const after = JSON.stringify({ climate: c, years }).length;
    expect(after).toBeLessThan(before / 3);
  });
});
