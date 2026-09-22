#!/usr/bin/env bun
/**
 * Calibration for the destination grade (`gradeOf` in lib/destination.ts).
 *
 *   bun run analyze:destinations
 *
 * A destination's 24 cells are derived from the passes it reaches, so the
 * question "when is this base at its best" needs a rule for turning a count
 * of rideable passes into a grade. This script is the evidence for the rule
 * that was chosen, and the way to re-check it when the data grows.
 *
 * It tabulates and judges nothing: every grade below is `gradeOfBase` with
 * another pair of shares, so no section can drift from the rule it is evidence
 * for.
 *
 * Sections:
 *   1. How many passes each base reaches at all – the spread the rule has to
 *      survive, from Bédoin's two to Cavalese's forty-three.
 *   2. Rideable passes per half-month across all bases, as a distribution.
 *   3. What an **absolute** threshold does to the grade split. This is the
 *      rule that was tried first and abandoned: read the share at the top
 *      grade against section 4, and the strips in section 6.
 *   4. What a **relative** rule does – the grade as a share of each base's own
 *      peak half-month, which is what `gradeOf` now uses.
 *   5. Whether every base still gets a named "beste Zeit" window – the check
 *      that picked the exact share, since a threshold set too high leaves a
 *      base peaking in a single half-month and no window to name.
 *   6. The two readings side by side as strips, for bases of very different
 *      size. This is the section that settles it: under the absolute rule a
 *      sizeable base is a solid block from June to October.
 */
import climateJson from "../data/generated/climate.json" with { type: "json" };
import profilesJson from "../data/generated/profiles.json" with { type: "json" };
import passesJson from "../data/passes.json" with { type: "json" };
import townsJson from "../data/towns.json" with { type: "json" };
import {
  gradeOfBase,
  RIDEABLE_BEST_SHARE,
  RIDEABLE_GOOD_SHARE,
} from "../lib/destination";
import type { GradeShares } from "../lib/destination";
import { haversine, reachBand } from "../lib/geo";
import { valleyElevations } from "../lib/profile";
import { emptyCount } from "../lib/reach";
import * as S from "../lib/schema";
import { passYear, periodLabel, PERIODS, signalsOf } from "../lib/status";
import type { Grade } from "../lib/status";
import { quantile } from "./lib/stats";

const passes = S.Passes.parse(passesJson);
const towns = S.Towns.parse(townsJson);
const signals = {
  climate: S.Climate.parse(climateJson),
  valleys: valleyElevations(passes, S.Profiles.parse(profilesJson)),
};
const years = Object.fromEntries(
  passes.map((p) => [p.slug, passYear(p, signalsOf(signals, p.slug))]),
);

/** Rideable ( = best or good) passes per base per half-month. */
const reach = towns.map((t) =>
  passes.filter((p) => reachBand(haversine(t, p)) !== null),
);
const rideable = reach.map((near) =>
  PERIODS.map(
    (_, i) =>
      near.filter((p) => {
        const g = years[p.slug]?.cells[i]?.grade;
        return g === "best" || g === "good";
      }).length,
  ),
);
const peaks = rideable.map((r) => Math.max(...r));
const cells = rideable.flat();

const pad = (n: number, w = 3) => String(n).padStart(w);
const share = (n: number) =>
  `${((n / cells.length) * 100).toFixed(0)} %`.padStart(5);

console.log("1. Passes within reach per base");
console.log(
  `   n=${towns.length}  min=${Math.min(...reach.map((r) => r.length))}` +
    `  p25=${quantile(
      reach.map((r) => r.length),
      0.25,
    )}` +
    `  median=${quantile(
      reach.map((r) => r.length),
      0.5,
    )}` +
    `  max=${Math.max(...reach.map((r) => r.length))}`,
);

console.log("\n2. Rideable passes per half-month, across bases");
for (const [i, period] of PERIODS.entries()) {
  const col = rideable.map((r) => r[i] ?? 0);
  console.log(
    `   ${periodLabel(period).padEnd(17)}min=${pad(Math.min(...col))}` +
      ` p25=${pad(quantile(col, 0.25))} med=${pad(quantile(col, 0.5))}` +
      ` p75=${pad(quantile(col, 0.75))} max=${pad(Math.max(...col))}`,
  );
}

/**
 * The grade rule itself, so that what section 3 and section 4 compare are two
 * arguments to `gradeOfBase` rather than two copies of its ladder. A count of
 * rideable passes is all it reads, and the absolute rule is the same
 * comparison against a fixed reference, which a peak of one makes it.
 */
const relative = (n: number, peak: number, shares?: GradeShares) =>
  gradeOfBase({ ...emptyCount(), good: n }, peak, shares);
const absolute = (n: number, [good, best]: readonly [number, number]) =>
  gradeOfBase({ ...emptyCount(), good: n }, 1, { best, good });

/** The absolute thresholds that were tried, the first of them the one section 6 draws. */
const ABSOLUTE = [
  [3, 6],
  [3, 8],
  [4, 10],
  [5, 15],
] as const;

const split = (grade: (n: number, peak: number) => Grade) => {
  const tally: Record<Grade, number> = {
    best: 0,
    closed: 0,
    good: 0,
    limited: 0,
  };
  for (const [t] of towns.entries())
    for (const n of rideable[t] ?? []) tally[grade(n, peaks[t] ?? 0)] += 1;
  return `best${share(tally.best)}  good${share(tally.good)}  eingeschränkt${share(tally.limited)}  gesperrt${share(tally.closed)}`;
};

console.log("\n3. An ABSOLUTE rule (the one that was tried first and dropped)");
for (const rule of ABSOLUTE)
  console.log(
    `   gut >= ${pad(rule[0], 2)}  beste Zeit >= ${pad(rule[1], 2)}   ${split(
      (n) => absolute(n, rule),
    )}`,
  );

console.log("\n4. A RELATIVE rule – share of this base's own peak (in use)");
for (const [hi, lo] of [
  [0.85, 0.55],
  [RIDEABLE_BEST_SHARE, RIDEABLE_GOOD_SHARE],
  [0.7, 0.4],
] as const) {
  const mark = hi === RIDEABLE_BEST_SHARE ? " <-" : "";
  console.log(
    `   beste Zeit >= ${hi}  gut >= ${lo}      ${split((n, peak) =>
      relative(n, peak, { best: hi, good: lo }),
    )}${mark}`,
  );
}

console.log("\n5. Does every base still get a named best window?");
const runLength = (flags: readonly boolean[]) => {
  let longest = 0;
  let run = 0;
  for (const f of flags) {
    run = f ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
};
for (const hi of [0.85, 0.8, RIDEABLE_BEST_SHARE, 0.7] as const) {
  const lens = rideable.map((own, t) =>
    runLength(
      own.map(
        (n) =>
          relative(n, peaks[t] ?? 0, {
            best: hi,
            good: RIDEABLE_GOOD_SHARE,
          }) === "best",
      ),
    ),
  );
  console.log(
    `   beste Zeit >= ${hi}   ${pad(lens.filter((l) => l >= 2).length, 2)}/${towns.length} Orte mit Fenster >= 2` +
      `   Median ${quantile(lens, 0.5)}, max ${Math.max(...lens)}${
        hi === RIDEABLE_BEST_SHARE ? " <-" : ""
      }`,
  );
}

console.log(
  "\n6. The same year read both ways  (# beste Zeit, + gut, . eingeschränkt)",
);
const GLYPH: Record<Grade, string> = {
  best: "#",
  closed: " ",
  good: "+",
  limited: ".",
};
for (const name of [
  "Bédoin",
  "Kitzbühel",
  "Innsbruck",
  "St. Moritz",
  "Bormio",
  "Cavalese",
]) {
  const t = towns.findIndex((x) => x.name.startsWith(name));
  if (t === -1) continue;
  const own = rideable[t] ?? [];
  const peak = peaks[t] ?? 0;
  const rel = own.map((n) => GLYPH[relative(n, peak)]).join("");
  const abs = own.map((n) => GLYPH[absolute(n, ABSOLUTE[0])]).join("");
  console.log(
    `   ${name.padEnd(12)} erreicht ${pad(reach[t]?.length ?? 0, 2)}, Spitze ${pad(peak, 2)}` +
      `   relativ |${rel}|   absolut |${abs}|`,
  );
}
console.log(
  `   ${"".padEnd(12)}                              ` +
    "    Monate  |JFMAMJJASOND ×2|",
);
