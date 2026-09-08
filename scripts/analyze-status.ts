#!/usr/bin/env bun
import climateJson from "../data/generated/climate.json" with { type: "json" };
/**
 * Calibration for the climate-aware status heuristic (docs/plans/04).
 *
 *   bun run scripts/analyze-status.ts            # cohort table before/after + changed pairs
 *   bun run scripts/analyze-status.ts --changes  # only the changed (pass, period) pairs
 *
 * "Before" is the heuristic without the climate series, "after" the one with
 * it. Snow and frost may only turn "meist offen" into "wetterabhängig" – a
 * closure is something only the opening window knows – so every change here
 * must be a shoulder-season shift, never a mid-summer surprise.
 */
import passesJson from "../data/passes.json" with { type: "json" };
import {
  bestPeriods,
  passStatus,
  periodLabel,
  PERIODS,
  STATUS_LABEL,
} from "../lib/status";
import type { ClimateYear, Pass, Status } from "../lib/types";

const passes = passesJson as Pass[];
const climate = climateJson as unknown as Record<string, ClimateYear>;
const changesOnly = process.argv.includes("--changes");

interface Cohort {
  n: number;
  snowSum: number;
  snowHigh: number;
}

const empty = (): Record<Status, Cohort> => ({
  closed: { n: 0, snowHigh: 0, snowSum: 0 },
  open: { n: 0, snowHigh: 0, snowSum: 0 },
  risky: { n: 0, snowHigh: 0, snowSum: 0 },
});

const before = empty();
const after = empty();
const changes: string[] = [];

for (const pass of passes) {
  const series = climate[pass.slug];
  for (const [i, t] of PERIODS.entries()) {
    const bucket = series?.[i] ?? null;
    const snow = bucket?.snowPct ?? 0;
    const b = passStatus(pass, t);
    const a = passStatus(pass, t, bucket);
    for (const [cohort, status] of [
      [before, b],
      [after, a],
    ] as const) {
      cohort[status].n += 1;
      cohort[status].snowSum += snow;
      if (snow >= 20) cohort[status].snowHigh += 1;
    }
    if (a !== b) {
      changes.push(
        `${pass.name.padEnd(28)} ${periodLabel(t).padEnd(16)} ${STATUS_LABEL[b]} → ${STATUS_LABEL[a]}` +
          `  (Schnee ${snow} %, Frost ${bucket?.frostPct ?? 0} %)`,
      );
    }
  }
}

const table = (title: string, cohorts: Record<Status, Cohort>) => {
  console.log(`\n${title}`);
  console.log(
    "| Verdict | n | mean snow-day share | share with snow ≥ 20 % of days |",
  );
  console.log("| --- | --- | --- | --- |");
  for (const status of ["open", "risky", "closed"] as Status[]) {
    const c = cohorts[status];
    const mean = c.n ? Math.round(c.snowSum / c.n) : 0;
    const high = c.n ? Math.round((c.snowHigh / c.n) * 100) : 0;
    console.log(`| ${STATUS_LABEL[status]} | ${c.n} | ${mean} % | ${high} % |`);
  }
};

if (!changesOnly) {
  table("Before (window, altitude, calendar):", before);
  table("After (plus the climate series):", after);
}

console.log(
  `\n${changes.length} of ${passes.length * PERIODS.length} (pass, period) pairs change:`,
);
for (const line of changes.toSorted()) console.log(`  ${line}`);

if (!changesOnly) {
  const best = passes.map((p) => [p, bestPeriods(p, climate[p.slug])] as const);
  const withBest = best.filter(([, b]) => b);
  console.log(
    `\nBeste Zeit: ${withBest.length} of ${passes.length} passes have one.`,
  );
  for (const [p, b] of best) {
    if (!b) console.log(`  none: ${p.name} (${p.elevation} m)`);
  }
}
