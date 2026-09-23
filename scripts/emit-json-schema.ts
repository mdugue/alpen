#!/usr/bin/env bun
/**
 * Writes `data/schema/*.schema.json` from the zod schemas in `lib/schema.ts`,
 * so that editors (see `.vscode/settings.json`, `json.schemas`) complete and
 * check the hand-maintained files. Run after changing `lib/schema.ts`;
 * `bun run data:check` fails while the files are stale (it renders them with
 * `renderJsonSchema` and compares).
 */
import { z } from "zod";

import { FILES } from "../lib/schema";

const OUT = new URL("../data/schema/", import.meta.url);

/**
 * `passes.json` → `passes.schema.json`, `generated/routes.json` →
 * `routes.schema.json`, `i18n/en/passes.json` → `passes.en.schema.json`.
 */
export const schemaFileFor = (file: string) =>
  `${file
    .replace(/^generated\//u, "")
    .replace(
      /^i18n\/(?<lang>\w+)\/(?<name>\w+)\.json$/u,
      "$<name>.$<lang>.json",
    )
    .replace(/\.json$/u, "")}.schema.json`;

export const renderJsonSchema = (file: keyof typeof FILES): string => {
  const json = z.toJSONSchema(FILES[file].schema, {
    target: "draft-2020-12",
    // Refinements (season window, dist/ele length) have no JSON Schema
    // counterpart; the editor gets the structure, check-data the full rules.
    unrepresentable: "any",
  });
  return `${JSON.stringify({ $id: schemaFileFor(file), ...json }, null, 2)}\n`;
};

if (import.meta.main) {
  let written = 0;
  for (const file of Object.keys(FILES) as (keyof typeof FILES)[]) {
    const target = new URL(schemaFileFor(file), OUT);
    const next = renderJsonSchema(file);
    const current = (await Bun.file(target).exists())
      ? await Bun.file(target).text()
      : null;
    if (current === next) continue;
    written += 1;
    await Bun.write(target, next);
  }
  console.log(`${written} Schema-Dateien geschrieben`);
}
