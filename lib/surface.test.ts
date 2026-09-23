import { describe, expect, test } from "bun:test";

import { surfaceWord } from "@/lib/i18n";
import { DE } from "@/lib/i18n/dictionaries";
import { isUnpaved, surfaceOfRoads } from "@/lib/regions";
import {
  COVER_CLOSED_PCT,
  COVER_LIMITED_PCT,
  passVerdict,
  statusWord,
} from "@/lib/status";
import type { ClimateBucket } from "@/lib/types";
import { makePass } from "@/test/fixtures";

/**
 * The surface (plan 27): one field that decides the closing rung. A barrier
 * closes asphalt; the snow cover closes a track – and only where the series
 * carries the cover, so a gravel road without it is never closed on a guess.
 */

const bucket = (over: Partial<ClimateBucket> = {}): ClimateBucket => ({
  frostPct: 0,
  snowPct: 0,
  tmax: 15,
  tmin: 5,
  wetPct: 10,
  ...over,
});

describe("the surface vocabulary", () => {
  test("a loop is ridden with what its roads demand", () => {
    expect(surfaceOfRoads(["asphalt", "asphalt"])).toBe("asphalt");
    expect(surfaceOfRoads(["gravel"])).toBe("gravel");
    expect(surfaceOfRoads(["asphalt", "gravel"])).toBe("mixed");
    expect(surfaceOfRoads(["mixed", "asphalt"])).toBe("mixed");
    expect(surfaceOfRoads([])).toBe("asphalt");
  });

  test("asphalt says nothing, everything else says its word", () => {
    expect(surfaceWord("asphalt", DE)).toBeNull();
    expect(surfaceWord("gravel", DE)).toBe("Schotter");
    expect(isUnpaved("mixed")).toBe(true);
  });
});

describe("the snow-cover rung", () => {
  // No window and high summer, so nothing but the cover can speak.
  const gravel = makePass("assietta", 0, {
    elevation: 2470,
    season: null,
    surface: "gravel",
  });
  const paved = makePass("galibier", 0, { elevation: 2470, season: null });

  test("closes an unpaved road above the closing share and limits it above the other", () => {
    const closed = passVerdict(gravel, 7, {
      bucket: bucket({ coverPct: COVER_CLOSED_PCT }),
      valley: 1000,
    });
    expect(closed).toEqual({ reasons: ["snow-cover"], status: "closed" });
    const limited = passVerdict(gravel, 7, {
      bucket: bucket({ coverPct: COVER_LIMITED_PCT }),
      valley: 1000,
    });
    expect(limited.status).toBe("risky");
    expect(limited.reasons[0]).toBe("snow-cover");
    expect(statusWord("risky", "snow-cover", DE)).toBe(
      "eingeschränkt: zugeschneit",
    );
  });

  test("leaves a paved road alone, and a track without the value unclosed", () => {
    expect(
      passVerdict(paved, 7, { bucket: bucket({ coverPct: 90 }), valley: 1000 })
        .status,
    ).toBe("open");
    expect(
      passVerdict(gravel, 7, { bucket: bucket(), valley: 1000 }).status,
    ).toBe("open");
  });
});
