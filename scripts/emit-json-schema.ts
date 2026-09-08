#!/usr/bin/env bun
/**
 * Writes `data/schema/*.schema.json` from the zod schemas in `lib/schema.ts`,
 * so that editors (see `.vscode/settings.json`, `json.schemas`) complete and
 * check the hand-maintained files. Run after changing `lib/schema.ts`;
 * `bun run data:check` fails while the files are stale.
 *
 *   bun run data:schema           # write
 *   bun run data:schema --check   # exit 1 if any file differs
 */
import { z } from "zod";

import { FILES } from "../lib/schema";

const OUT = new URL("../data/schema/", import.meta.url);
const CHECK = process.argv.includes("--check");

/** `passes.json` → `passes.schema.json`, `generated/routes.json` → `routes.schema.json`. */
export const schemaFileFor = (file: string) =>
  `${file.replace(/^generated\//u, "").replace(/\.json$/u, "")}.schema.json`;

export function renderJsonSchema(file: keyof typeof FILES): string {
  const json = z.toJSONSchema(FILES[file], {
    target: "draft-2020-12",
    // Refinements (season window, dist/ele length) have no JSON Schema
    // counterpart; the editor gets the structure, check-data the full rules.
    unrepresentable: "any",
  });
  return `${JSON.stringify({ $id: schemaFileFor(file), ...json }, null, 2)}\n`;
}

if (import.meta.main) {
  let stale = 0;
  for (const file of Object.keys(FILES) as (keyof typeof FILES)[]) {
    const target = new URL(schemaFileFor(file), OUT);
    const next = renderJsonSchema(file);
    const current = (await Bun.file(target).exists())
      ? await Bun.file(target).text()
      : null;
    if (current === next) continue;
    stale++;
    if (CHECK) console.error(`FEHLER ${schemaFileFor(file)} ist veraltet`);
    else await Bun.write(target, next);
  }
  if (CHECK && stale) {
    console.error("bun run data:schema ausführen und die Dateien einchecken.");
    process.exit(1);
  }
  if (!CHECK) console.log(`${stale} Schema-Dateien geschrieben`);
}
