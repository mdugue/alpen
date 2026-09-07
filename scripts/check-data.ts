#!/usr/bin/env bun
/** Checks references and completeness. Runs in CI before the build. */
import passes from "../data/passes.json" with { type: "json" };
import tours from "../data/tours.json" with { type: "json" };
import towns from "../data/towns.json" with { type: "json" };
import routes from "../data/generated/routes.json" with { type: "json" };
import profiles from "../data/generated/profiles.json" with { type: "json" };
import climate from "../data/generated/climate.json" with { type: "json" };
import type { Pass, Tour, Town } from "../lib/types";

const errors: string[] = [];
const warnings: string[] = [];
const slugs = new Set((passes as Pass[]).map((p) => p.slug));

const dupes = (list: { slug: string }[], what: string) => {
  const seen = new Set<string>();
  for (const x of list) {
    if (seen.has(x.slug)) errors.push(`${what}: doppelter Slug ${x.slug}`);
    seen.add(x.slug);
  }
};
dupes(passes as Pass[], "Pässe");
dupes(tours as Tour[], "Touren");
dupes(towns as Town[], "Orte");

for (const p of passes as Pass[]) {
  if (p.lat < 43 || p.lat > 49 || p.lon < 4 || p.lon > 16) errors.push(`${p.slug}: Koordinaten außerhalb der Alpen`);
  if (p.elevation < 300 || p.elevation > 3500) errors.push(`${p.slug}: unplausible Höhe ${p.elevation}`);
  for (const key of ["beauty", "fame", "difficulty", "traffic"] as const) {
    const v = p[key];
    if (!Number.isInteger(v) || v < 1 || v > 5) errors.push(`${p.slug}: ${key} = ${v}`);
  }
  if (p.season && p.season.opens >= p.season.closes) errors.push(`${p.slug}: Saisonfenster verdreht`);
  if (!p.ascents.length) warnings.push(`${p.slug}: keine Auffahrt hinterlegt`);
  p.ascents.forEach((_, i) => {
    const key = `${p.slug}:${i}`;
    if (!(key in routes)) warnings.push(`${key}: Route fehlt (bun run data:build)`);
    else if (!(key in profiles)) warnings.push(`${key}: Profil fehlt`);
  });
  if (!(p.slug in climate)) warnings.push(`${p.slug}: Klimareihe fehlt`);
}

for (const t of tours as Tour[]) {
  for (const s of t.passes) if (!slugs.has(s)) errors.push(`Tour ${t.slug}: unbekannter Pass ${s}`);
  if (!(`tour:${t.slug}` in routes)) warnings.push(`Tour ${t.slug}: Route fehlt`);
}

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`FEHLER ${e}`);
console.log(
  `${(passes as Pass[]).length} Pässe, ${(tours as Tour[]).length} Touren, ${(towns as Town[]).length} Orte · ` +
    `${errors.length} Fehler, ${warnings.length} Warnungen`,
);
if (errors.length) process.exit(1);
