#!/usr/bin/env bun
/**
 * Validates every file in `data/` against `lib/schema.ts`, then checks the
 * cross references and completeness the schemas cannot see. Runs in CI before
 * the build.
 */
import type { z } from "zod";

import { FILES } from "../lib/schema";
import { fold } from "../lib/search";
import type { Pass, Tour, Town } from "../lib/types";
import { renderJsonSchema, schemaFileFor } from "./emit-json-schema";

const DATA = new URL("../data/", import.meta.url);
const errors: string[] = [];
const warnings: string[] = [];

// ── 1. Shape: every file against its schema ──────────────────────────────────

const HAND_MAINTAINED = ["passes.json", "tours.json", "towns.json"] as const;

async function load<K extends keyof typeof FILES>(
  file: K,
): Promise<z.infer<(typeof FILES)[K]> | null> {
  const raw = await Bun.file(new URL(file, DATA)).text();
  const data: unknown = JSON.parse(raw);
  // Hand-maintained files keep one canonical layout so diffs stay readable.
  if (
    HAND_MAINTAINED.includes(file as never) &&
    raw !== `${JSON.stringify(data, null, 1)}\n`
  )
    errors.push(
      `${file}: nicht kanonisch formatiert (JSON.stringify(data, null, 1) + Zeilenumbruch)`,
    );
  const result = FILES[file].safeParse(data);
  if (result.success) return result.data as z.infer<(typeof FILES)[K]>;
  for (const issue of result.error.issues) {
    const path = issue.path
      .map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`))
      .join("")
      .replace(/^\./u, "");
    errors.push(`${file} › ${path || "(root)"}: ${issue.message}`);
  }
  return null;
}

const [passes, tours, towns, routes, profiles, climate] = await Promise.all([
  load("passes.json"),
  load("tours.json"),
  load("towns.json"),
  load("generated/routes.json"),
  load("generated/profiles.json"),
  load("generated/climate.json"),
]);

for (const file of Object.keys(FILES) as (keyof typeof FILES)[]) {
  const target = Bun.file(new URL(`schema/${schemaFileFor(file)}`, DATA));
  const current = (await target.exists()) ? await target.text() : null;
  if (current !== renderJsonSchema(file))
    errors.push(
      `data/schema/${schemaFileFor(file)} ist veraltet (bun run data:schema)`,
    );
}

// ── 2. References and completeness ──────────────────────────────────────────

const dupes = (list: { slug: string }[], what: string) => {
  const seen = new Set<string>();
  for (const x of list) {
    if (seen.has(x.slug)) errors.push(`${what}: doppelter Slug ${x.slug}`);
    seen.add(x.slug);
  }
};

function checkPasses(list: Pass[]) {
  dupes(list, "Pässe");
  // Aliases: never a name or another alias – search would find two passes.
  const names = new Map<string, string>();
  for (const p of list) names.set(fold(p.name), p.slug);
  for (const p of list)
    for (const alias of p.aliases ?? []) {
      const key = fold(alias);
      const owner = names.get(key);
      if (owner === p.slug)
        errors.push(`${p.slug}: Alias "${alias}" ist bereits der Name`);
      else if (owner)
        errors.push(`${p.slug}: Alias "${alias}" gehört zu ${owner}`);
      else names.set(key, p.slug);
    }
  for (const p of list) {
    if (!p.ascents.length)
      warnings.push(`${p.slug}: keine Auffahrt hinterlegt`);
    p.ascents.forEach((_, i) => {
      const key = `${p.slug}:${i}`;
      if (routes && !(key in routes))
        warnings.push(`${key}: Route fehlt (bun run data:build)`);
      else if (profiles && !(key in profiles))
        warnings.push(`${key}: Profil fehlt`);
    });
    if (climate && !(p.slug in climate))
      warnings.push(`${p.slug}: Klimareihe fehlt`);
  }
}

function checkTours(list: Tour[], slugs: Set<string>) {
  dupes(list, "Touren");
  for (const t of list) {
    for (const s of t.passes)
      if (!slugs.has(s)) errors.push(`Tour ${t.slug}: unbekannter Pass ${s}`);
    if (routes && !(`tour:${t.slug}` in routes))
      warnings.push(`Tour ${t.slug}: Route fehlt`);
  }
}

function checkTowns(list: Town[]) {
  dupes(list, "Orte");
}

if (passes) checkPasses(passes);
// Without a valid pass list every reference would read as unknown.
if (tours && passes) checkTours(tours, new Set(passes.map((p) => p.slug)));
if (towns) checkTowns(towns);

// Generated keys that no longer belong to a pass or tour are stale, not wrong.
if (passes && tours) {
  const known = new Set([
    ...passes.flatMap((p) => p.ascents.map((_, i) => `${p.slug}:${i}`)),
    ...tours.map((t) => `tour:${t.slug}`),
  ]);
  for (const key of Object.keys(routes ?? {}))
    if (!known.has(key)) warnings.push(`routes.json: verwaiste Route ${key}`);
  for (const key of Object.keys(profiles ?? {}))
    if (!known.has(key))
      warnings.push(`profiles.json: verwaistes Profil ${key}`);
  const slugs = new Set(passes.map((p) => p.slug));
  for (const key of Object.keys(climate ?? {}))
    if (!slugs.has(key))
      warnings.push(`climate.json: verwaiste Klimareihe ${key}`);
}

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`FEHLER ${e}`);
console.log(
  `${passes?.length ?? 0} Pässe, ${tours?.length ?? 0} Touren, ${towns?.length ?? 0} Orte · ` +
    `${errors.length} Fehler, ${warnings.length} Warnungen`,
);
if (errors.length) process.exit(1);
