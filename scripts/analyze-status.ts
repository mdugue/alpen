#!/usr/bin/env bun
import climateJson from "../data/generated/climate.json" with { type: "json" };
import profilesJson from "../data/generated/profiles.json" with { type: "json" };
/**
 * Calibration for the rideability heuristic (docs/plans/04 and 13).
 *
 *   bun run scripts/analyze-status.ts            # everything below
 *   bun run scripts/analyze-status.ts --changes  # only the changed (pass, period) pairs
 *
 * Sections:
 *   1. The plan 04 cohort table: the window/altitude heuristic alone against
 *      the one with the climate series, by snow-day share.
 *   2. Distributions per half-month of the summer signals over the pairs the
 *      window, altitude and calendar leave open: derived valley tmax, rain
 *      days, summit tmax and day length.
 *   3. Threshold counts: for every signal the pairs and passes hit at the
 *      chosen constant and one step either side, so a change is a one-line
 *      diff with visible consequences.
 *   4. Changes: every pair whose verdict or first reason differs from the
 *      plan 04 heuristic (window, altitude, snow, frost), grouped by the
 *      reason that decided, and the "Beste Zeit" run lengths. Read the lists adversarially: heat should
 *      name valleys, wet the Dolomites, nothing should turn amber in July for
 *      a reason a rider would not recognise.
 */
import passesJson from "../data/passes.json" with { type: "json" };
import { dayLength } from "../lib/daylight";
import { valleyElevations } from "../lib/profile";
import {
  bestPeriods,
  COLD_DESCENT_TMAX,
  HEAT_VALLEY_TMAX,
  passVerdict,
  periodLabel,
  PERIODS,
  REASON_ORDER,
  SHORT_DAY_HOURS,
  signalsOf,
  STATUS_LABEL,
  valleyTmax,
  WET_LIMITED_PCT,
} from "../lib/status";
import type { Signals, StatusReason, StatusVerdict } from "../lib/status";
import type {
  ClimateBucket,
  ClimateYear,
  ElevationProfile,
  Pass,
  Period,
  Status,
} from "../lib/types";

const passes = passesJson as Pass[];
const climate = climateJson as unknown as Record<string, ClimateYear>;
const valleys = valleyElevations(
  passes,
  profilesJson as unknown as Record<string, ElevationProfile>,
);
const signals: Signals = { climate, valleys };
const changesOnly = process.argv.includes("--changes");

interface Pair {
  pass: Pass;
  t: Period;
  bucket: ClimateBucket | null;
  valley: number | undefined;
  /** Window, altitude and calendar alone (plan 04's "before"). */
  bare: Status;
  /** Plus snow and frost (plan 04's "after", the heuristic before plan 13). */
  base: Status;
  baseReason: StatusReason | undefined;
  status: Status;
  reason: StatusReason | undefined;
}

const WINTER = new Set<StatusReason>([
  "outside-window",
  "window-edge",
  "snow",
  "frost",
  "altitude",
]);

/** The verdict as plan 04 knew it: only the winter reasons count. */
const winterOnly = (v: StatusVerdict): StatusVerdict => {
  const reasons = v.reasons.filter((r) => WINTER.has(r));
  return {
    reasons,
    status:
      v.status === "closed" ? "closed" : reasons.length ? "risky" : "open",
  };
};

const pairs: Pair[] = [];
for (const pass of passes) {
  const own = signalsOf(signals, pass.slug);
  for (const [i, t] of PERIODS.entries()) {
    const bucket = own.climate?.[i] ?? null;
    const bare = winterOnly(passVerdict(pass, t));
    const full = passVerdict(pass, t, { bucket, valley: own.valley });
    const base = winterOnly(full);
    pairs.push({
      bare: bare.status,
      base: base.status,
      baseReason: base.reasons[0],
      bucket,
      pass,
      reason: full.reasons[0],
      status: full.status,
      t,
      valley: own.valley ?? undefined,
    });
  }
}

// ── 1. Plan 04 cohort table ──────────────────────────────────────────────────

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
const cohortTable = (title: string, pick: (p: Pair) => Status) => {
  const cohorts = empty();
  for (const p of pairs) {
    const c = cohorts[pick(p)];
    const snow = p.bucket?.snowPct ?? 0;
    c.n += 1;
    c.snowSum += snow;
    if (snow >= 20) c.snowHigh += 1;
  }
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

// ── 2. Distributions of the summer signals ───────────────────────────────────

const quantile = (values: number[], q: number) => {
  const s = values.toSorted((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] ?? 0;
};
const distribution = (
  title: string,
  value: (p: Pair) => number | null,
  digits = 1,
) => {
  console.log(`\n${title} – over the pairs plan 04 calls "gut"`);
  console.log("| Half-month | n | p10 | p25 | median | p75 | p90 | max |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const t of PERIODS) {
    const values = pairs
      .filter((p) => p.t === t && p.base === "open")
      .map(value)
      .filter((v): v is number => v !== null);
    if (values.length === 0) continue;
    const f = (q: number) => quantile(values, q).toFixed(digits);
    console.log(
      `| ${periodLabel(t)} | ${values.length} | ${f(0.1)} | ${f(0.25)} | ${f(0.5)} | ${f(0.75)} | ${f(0.9)} | ${f(1)} |`,
    );
  }
};

const valleyOf = (p: Pair) =>
  p.bucket ? valleyTmax(p.pass, p.bucket, p.valley) : null;

// ── 3. Threshold counts ──────────────────────────────────────────────────────

const thresholdCounts = (
  title: string,
  thresholds: number[],
  hits: (p: Pair, threshold: number) => boolean,
) => {
  console.log(`\n${title}`);
  console.log("| threshold | pairs | passes | half-months hit |");
  console.log("| --- | --- | --- | --- |");
  for (const th of thresholds) {
    const hit = pairs.filter((p) => p.base === "open" && hits(p, th));
    const byPeriod = new Map<Period, number>();
    for (const p of hit) byPeriod.set(p.t, (byPeriod.get(p.t) ?? 0) + 1);
    const months = PERIODS.filter((t) => byPeriod.has(t))
      .map((t) => `${periodLabel(t)} ${byPeriod.get(t)}`)
      .join(" · ");
    console.log(
      `| ${th} | ${hit.length} | ${new Set(hit.map((p) => p.pass.slug)).size} | ${months} |`,
    );
  }
};

// ── 4. Changes ───────────────────────────────────────────────────────────────

const changes = pairs.filter(
  (p) => p.status !== p.base || p.reason !== p.baseReason,
);

const describe = (p: Pair) => {
  const valley = valleyOf(p);
  return (
    `${p.pass.name.padEnd(28)} ${periodLabel(p.t).padEnd(16)} ` +
    `${STATUS_LABEL[p.base]}${p.baseReason ? ` (${p.baseReason})` : ""} → ` +
    `${STATUS_LABEL[p.status]}${p.reason ? ` (${p.reason})` : ""}` +
    `  [Schnee ${p.bucket?.snowPct ?? "–"} %, Frost ${p.bucket?.frostPct ?? "–"} %, ` +
    `Regen ${p.bucket?.wetPct ?? "–"} %, Gipfel ${p.bucket?.tmax ?? "–"} °C, ` +
    `Tal ${valley === null ? "–" : valley.toFixed(1)} °C, Tag ${dayLength(p.pass.lat, p.t).toFixed(1)} h]`
  );
};

if (!changesOnly) {
  cohortTable("1a. Window, altitude and calendar alone:", (p) => p.bare);
  cohortTable("1b. Plus snow and frost (plan 04):", (p) => p.base);
  cohortTable("1c. With every signal (plan 13):", (p) => p.status);

  distribution("2a. Valley tmax (derived, °C)", valleyOf);
  distribution("2b. Rain days (%)", (p) => p.bucket?.wetPct ?? null, 0);
  distribution("2c. Summit tmax (°C)", (p) => p.bucket?.tmax ?? null);
  distribution("2d. Day length (h)", (p) => dayLength(p.pass.lat, p.t), 2);

  thresholdCounts(
    `3a. Heat: valley tmax ≥ threshold (HEAT_VALLEY_TMAX = ${HEAT_VALLEY_TMAX})`,
    [HEAT_VALLEY_TMAX - 2, HEAT_VALLEY_TMAX, HEAT_VALLEY_TMAX + 2],
    (p, th) => (valleyOf(p) ?? -99) >= th,
  );
  thresholdCounts(
    `3b. Wet: rain days ≥ threshold (WET_LIMITED_PCT = ${WET_LIMITED_PCT})`,
    [WET_LIMITED_PCT - 5, WET_LIMITED_PCT, WET_LIMITED_PCT + 5],
    (p, th) => (p.bucket?.wetPct ?? -1) >= th,
  );
  thresholdCounts(
    `3c. Short days: day length < threshold (SHORT_DAY_HOURS = ${SHORT_DAY_HOURS})`,
    [SHORT_DAY_HOURS - 0.5, SHORT_DAY_HOURS, SHORT_DAY_HOURS + 0.5],
    (p, th) => dayLength(p.pass.lat, p.t) < th,
  );
  thresholdCounts(
    `3d. Cold descent: summit tmax < threshold (COLD_DESCENT_TMAX = ${COLD_DESCENT_TMAX})`,
    [COLD_DESCENT_TMAX - 2, COLD_DESCENT_TMAX, COLD_DESCENT_TMAX + 2],
    (p, th) => (p.bucket?.tmax ?? 99) < th,
  );
}

console.log(
  `\n4. ${changes.length} of ${pairs.length} (pass, period) pairs change against plan 04:`,
);
for (const reason of REASON_ORDER) {
  const list = changes.filter((p) => p.reason === reason);
  if (list.length === 0) continue;
  console.log(
    `\n  ${reason}: ${list.length} pairs, ${new Set(list.map((p) => p.pass.slug)).size} passes`,
  );
  for (const p of list.toSorted(
    (a, b) => a.t - b.t || a.pass.name.localeCompare(b.pass.name),
  ))
    console.log(`    ${describe(p)}`);
}

if (!changesOnly) {
  const runs = passes.map((p) => {
    const best = bestPeriods(p, signalsOf(signals, p.slug));
    if (!best) return { length: 0, p };
    const [from, to] = best.map((t) => PERIODS.indexOf(t)) as [number, number];
    return { best, length: ((to - from + 24) % 24) + 1, p };
  });
  const withBest = runs.filter((r) => r.length > 0);
  console.log(
    `\nBeste Zeit: ${withBest.length} of ${passes.length} passes have one; run lengths ` +
      `${runs
        .map((r) => r.length)
        .toSorted((a, b) => a - b)
        .join(",")}`,
  );
  for (const r of runs) {
    if (r.length === 0) console.log(`  none: ${r.p.name} (${r.p.elevation} m)`);
  }
}
