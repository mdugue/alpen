import { describe, expect, test } from "bun:test";

import { DE, messagesOf } from "@/lib/i18n/dictionaries";
import {
  isPeriod,
  periodAt,
  periodIndex,
  periodLabel,
  PERIODS,
  todayPeriod,
} from "@/lib/period";

describe("periods", () => {
  test("24 half-months round trip through index and label", () => {
    expect(PERIODS).toHaveLength(24);
    expect(PERIODS.map(periodIndex)).toEqual(
      Array.from({ length: 24 }, (_, i) => i),
    );
    expect(PERIODS.map((t) => periodAt(periodIndex(t)))).toEqual(PERIODS);
    expect(periodLabel(1, DE)).toBe("Anfang Januar");
    expect(periodLabel(10, DE)).toBe("Anfang Oktober");
    expect(periodLabel(10.5, DE)).toBe("Ende Oktober");
    expect(periodLabel(12.5, DE)).toBe("Ende Dezember");
  });

  test("the English label says early and late", () => {
    const en = messagesOf("en");
    expect(periodLabel(1, en)).toBe("early January");
    expect(periodLabel(10.5, en)).toBe("late October");
  });

  test("periodAt wraps around the year", () => {
    expect(periodAt(24)).toBe(1);
    expect(periodAt(-1)).toBe(12.5);
  });

  test("isPeriod guards values from the hash or storage", () => {
    expect(isPeriod(6)).toBe(true);
    expect(isPeriod(6.5)).toBe(true);
    expect(isPeriod(0)).toBe(false);
    expect(isPeriod(13)).toBe(false);
    expect(isPeriod(6.25)).toBe(false);
    expect(isPeriod("6")).toBe(false);
    expect(isPeriod(Number.NaN)).toBe(false);
  });

  test("todayPeriod splits the month at the 15th, in Europe/Berlin", () => {
    expect(todayPeriod(new Date("2026-05-01T12:00:00Z"))).toBe(5);
    expect(todayPeriod(new Date("2026-05-15T12:00:00Z"))).toBe(5);
    expect(todayPeriod(new Date("2026-05-16T12:00:00Z"))).toBe(5.5);
    expect(todayPeriod(new Date("2026-12-31T12:00:00Z"))).toBe(12.5);
    // 00:30 Berlin time on 1 June is still 22:30 UTC on 31 May.
    expect(todayPeriod(new Date("2026-05-31T22:30:00Z"))).toBe(6);
  });
});
