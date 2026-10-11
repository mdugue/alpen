#!/usr/bin/env bun
import routesJson from "../data/generated/routes.json" with { type: "json" };
/**
 * Detour report per road: the paved dead ends that leave a stored route and
 * climb – candidates for a `branchOf` spur, the way the Edelweißspitze and the
 * Kaiser-Franz-Josefs-Höhe leave the Großglockner Hochalpenstraße.
 *
 *   bun run analyze:branches                       # every road with a stored route
 *   bun run analyze:branches stilfser gavia        # matching slugs only
 *   bun run analyze:branches --min-gain 200        # only detours that climb that much
 *   bun run analyze:branches --refresh             # ask Overpass and Open-Meteo again
 *
 * In the family of analyze-coverage.ts: it prints, it writes nothing under
 * data/. For every road it asks Overpass once for the paved ways in a box
 * around its stored routes, finds the components that leave the route and end
 * (`branchesOf`, `scripts/lib/branches.ts`), asks Open-Meteo for the height of
 * each junction and end, and prints the ends that climb, highest gain first,
 * with the name of what lies there. An end within 500 m of an entry's marker
 * says so – that detour is in the data already.
 *
 * The answers are recorded per request in scripts/.cache/branches
 * (git-ignored) by the fixture transport, so the second run is offline and
 * free. OVERPASS_URL picks a mirror when overpass-api.de refuses.
 */
import passesJson from "../data/passes.json" with { type: "json" };
import { ascentKey } from "../lib/route-key";
import * as S from "../lib/schema";
import type { LatLon } from "../lib/types";
import {
  boxAround,
  branchesOf,
  branchQuery,
  rankBranches,
} from "./lib/branches";
import { OVERPASS_URL, openMeteo, overpass } from "./lib/hosts";
import { fixtureTransport, liveTransport } from "./lib/transport";

const passes = S.Passes.parse(passesJson);
const routes = routesJson as unknown as Record<string, [number, number][]>;

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(name);
  const v = i === -1 ? Number.NaN : Number(args[i + 1]);
  return Number.isFinite(v) ? v : fallback;
};
const MIN_GAIN = flag("--min-gain", 120);
const MAX_KM = flag("--max-km", 15);
const REFRESH = args.includes("--refresh");
const only = args.filter(
  (a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"),
);
const selected = passes.filter(
  (p) =>
    p.branchOf === undefined &&
    (!only.length || only.some((o) => p.slug.includes(o))),
);

/** Recorded answers; `--refresh` asks the hosts again and overwrites them. */
const transport = fixtureTransport(
  new URL(".cache/branches/", import.meta.url),
  { live: liveTransport(), record: REFRESH },
);

const key = (p: LatLon) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
const pct = (gain: number, km: number) =>
  km > 0 ? `${(gain / (km * 10)).toFixed(1).replace(".", ",")} %` : "–";

console.log(
  `Abstecher je Straße, ab ${MIN_GAIN} Hm (--min-gain), bis ${MAX_KM} km (--max-km), ${selected.length} Straßen, Overpass: ${new URL(OVERPASS_URL).host}\n`,
);

let found = 0;
let fresh = 0;
for (const pass of selected) {
  const own = pass.ascents
    .map((_, i) => routes[ascentKey(pass.slug, i)])
    .filter((r) => r !== undefined);
  if (!own.length) continue;
  const box = boxAround(own);
  let elements;
  try {
    elements = await overpass.query(transport, branchQuery(box));
  } catch (error) {
    console.error(
      `${pass.name}: Overpass antwortet nicht (${(error as Error).message}) – OVERPASS_URL=… wählt einen Spiegel`,
    );
    process.exit(1);
  }
  const branches = branchesOf(own, elements, box);
  const points = branches.flatMap((b) => [b.junction, ...b.ends]);
  const heights = new Map<string, number>();
  if (points.length) {
    const ele = await openMeteo.elevation(transport, points);
    for (const [i, p] of points.entries()) heights.set(key(p), ele[i]!);
  }
  const places = elements.flatMap((e) =>
    e.type === "node" && e.tags?.name
      ? [{ lat: e.lat, lon: e.lon, name: e.tags.name }]
      : [],
  );
  const candidates = rankBranches(
    branches,
    (p) => heights.get(key(p)),
    places,
    passes,
    { maxKm: MAX_KM, minGain: MIN_GAIN },
  );
  if (!candidates.length) continue;
  console.log(`${pass.name} (${pass.slug})`);
  for (const c of candidates) {
    found += 1;
    if (!c.listed) fresh += 1;
    console.log(
      `  ${(c.name ?? "ohne Namen").padEnd(34)} ${c.end.km.toFixed(1).padStart(5)} km ${String(c.gain).padStart(5)} Hm ${pct(c.gain, c.end.km).padStart(7)}  ${c.junction.ele} → ${c.end.ele} m  ab ${c.junction.lat.toFixed(4)}, ${c.junction.lon.toFixed(4)} bis ${c.end.lat.toFixed(4)}, ${c.end.lon.toFixed(4)}${c.listed ? `  = ${c.listed}` : ""}`,
    );
  }
  console.log();
}
console.log(
  `${found} Abstecher, ${fresh} davon nicht in den Daten · ${transport.recorded} Anfragen, ${transport.replayed} aus dem Cache`,
);
