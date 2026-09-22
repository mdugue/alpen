/**
 * The whole build, offline: `plan` decides, `execute` answers from recorded
 * files and `apply` writes, on two passes and a tour.
 *
 * The 90 subtlest lines of the pipeline used to run only in production. A
 * candidate that fails the gate beside a route that already passed needs one
 * router to refuse a road the other routes; a rejection that keeps its measured
 * values needs a geometry that is wrong in exactly one way. Neither is
 * something a live run can be asked for, so both are here – with the hosts
 * behind `fixtureTransport` and the state written into a temporary directory
 * and read back through the same schemas `data/generated` is validated with.
 *
 * The answers under `scripts/fixtures/` are committed. They were written by
 * hand from geometry already stored in `data/generated/routes.json` rather
 * than recorded from the hosts, so their coordinates are real and their shape
 * is what `scripts/lib/hosts.ts` parses – but the numbers around them (the DEM
 * heights, the elevation ramp, the two OSM ways) are chosen. Whoever can reach
 * the hosts refreshes them all in one run:
 *
 *   ORS_KEY=… RECORD_FIXTURES=1 bun test scripts/pipeline.test.ts
 *
 * and commits what changed.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { curated, flags, KEYS, seed, TODAY } from "./fixtures/scenario";
import { readData } from "./lib/data-files";
import { plan } from "./lib/decide";
import type { Stored } from "./lib/decide";
import { reportLine, runPipeline, saveTo } from "./lib/pipeline";
import { fixtureTransport, liveTransport } from "./lib/transport";

const FIXTURES = new URL("fixtures/", import.meta.url);
/** Ask the hosts again and overwrite what is on disk. */
const RECORD = process.env.RECORD_FIXTURES === "1";

const state: Stored = seed();
const before = seed();
const log: string[] = [];
let dir = new URL("file:///");
let replayed = 0;

beforeAll(async () => {
  dir = pathToFileURL(
    `${await mkdtemp(path.join(tmpdir(), "alpen-pipeline-"))}/`,
  );
  const transport = fixtureTransport(FIXTURES, {
    live: RECORD ? liveTransport() : undefined,
    record: RECORD,
  });
  await runPipeline({
    curated,
    flags,
    log: (line) => {
      log.push(line);
    },
    save: saveTo(dir),
    state,
    stopped: () => null,
    today: TODAY,
    transport,
  });
  replayed = transport.replayed + transport.recorded;
});
afterAll(() => rm(dir, { force: true, recursive: true }));

/** What the run actually wrote, read back through the schemas of `data/`. */
const written = async () => {
  const [routes, meta, profiles, rejected, summits] = await Promise.all([
    readData("generated/routes.json", dir),
    readData("generated/routes-meta.json", dir),
    readData("generated/profiles.json", dir),
    readData("generated/rejected.json", dir),
    readData("generated/summits.json", dir),
  ]);
  for (const r of [routes, meta, profiles, rejected, summits])
    expect(r.problems).toEqual([]);
  return {
    meta: meta.data!,
    profiles: profiles.data!,
    rejected: rejected.data!,
    routes: routes.data!,
    summits: summits.data!,
  };
};

describe("plan", () => {
  test("says what the run will do before anything is asked", () => {
    const { counts, routes } = plan(curated, before, flags);
    // Both markers are unmeasured, so nothing is blocked yet and every road is
    // either a gap or – the Lautaret side – a car route to be upgraded.
    expect(
      Object.fromEntries(routes.map(({ job, verdict }) => [job.key, verdict])),
    ).toEqual({
      [KEYS.accepted]: { act: "fetch", replace: false, upgrade: false },
      [KEYS.kept]: { act: "fetch", replace: false, upgrade: true },
      [KEYS.rejected]: { act: "fetch", replace: false, upgrade: false },
      [KEYS.tour]: { act: "fetch", replace: false, upgrade: false },
    });
    expect(counts.routes).toBe(4);
    expect(counts.summits).toBe(2);
    expect(counts.climate).toBe(0);
  });

  test("and renders it as the sentence --status prints", () => {
    expect(
      reportLine(plan(curated, before, flags).counts, {
        budget: 4500,
        upgradeOsrm: true,
      }),
    ).toBe(
      "Fehlend: 4 Routen, 0 Profile, 0 Klimareihen, 2 Gipfelhöhen, 2 Straßenabstände (≈ 302 Open-Meteo-Calls ≈ 1 Läufe à 4500)",
    );
  });
});

describe("the run", () => {
  test("asks each host once for each question and nothing twice", () => {
    // Two cheap batches for the markers, four routes, one profile.
    expect(replayed).toBe(7);
  });

  test("measures the markers before it routes anything", async () => {
    const { summits } = await written();
    expect(summits).toEqual({
      "fixtur-galibier": { dem: 2642, lat: 45.064, lon: 6.408, roadDist: 0 },
      "fixtur-lautaret": { dem: 2058, lat: 45.034, lon: 6.405, roadDist: 0 },
    });
    expect(log).toContain("Gipfelhöhen: 2 gemessen");
    expect(log).toContain("Straßenabstände: 2 gemessen");
  });

  test("stores the route that passes and the profile it paid for", async () => {
    const { meta, profiles, routes } = await written();
    expect(routes[KEYS.accepted]).toHaveLength(60);
    expect(meta[KEYS.accepted]).toEqual({
      fetchedAt: TODAY,
      inputs: plan(curated, before, flags).routes[0]!.job.inputs,
      source: "ors",
    });
    const profile = profiles[KEYS.accepted]!;
    expect(profile.top).toBe(2642);
    expect(profile.start).toBe(1430);
    expect(profile.km).toBe(15.8);
    // The profile is judged too: the summit is at the end and the height
    // matches, which is what `withProfile` measures and `checkAscent` weighs.
    expect(profile.ele.at(-1)).toBe(2642);
    expect(
      log.some((l) => l.includes("Profil: Fixtur-Galibier ab Valloire")),
    ).toBe(true);
  });

  test("a tour is routed and judged, and earns no profile", async () => {
    const { profiles, routes } = await written();
    expect(routes[KEYS.tour]).toHaveLength(80);
    expect(profiles[KEYS.tour]).toBeUndefined();
    expect(
      log.some((l) => l.includes("Route: Tour Fixtur-Runde (ors, 35.38 km)")),
    ).toBe(true);
  });

  test("a candidate that fails is rejected with what was measured", async () => {
    const { rejected, routes } = await written();
    const r = rejected[KEYS.rejected]!;
    expect(r.reasons).toEqual(["Ende 2.3 km vom Passpunkt entfernt > 500 m"]);
    expect(r.metrics).toEqual({
      endDist: 2.335,
      gain: null,
      km: 2.77,
      peakAt: null,
      startDist: 0,
      topDelta: null,
    });
    expect(r.firstSeen).toBe(TODAY);
    expect(r.lastSeen).toBe(TODAY);
    expect(r.source).toBe("ors");
    // Nothing was stored for it, and no profile was paid for a geometry that
    // ends in the wrong place.
    expect(routes[KEYS.rejected]).toBeUndefined();
  });

  test("a failing candidate does not evict the route it was to replace", async () => {
    const { meta, profiles, rejected, routes } = await written();
    // The ORS candidate stops 2 km below the summit; the stored OSRM route,
    // its meta and its profile all stay exactly as they were.
    expect(rejected[KEYS.kept]?.source).toBe("ors");
    expect(rejected[KEYS.kept]?.metrics.endDist).toBe(1.983);
    expect(routes[KEYS.kept]).toEqual(before.routes[KEYS.kept]);
    expect(meta[KEYS.kept]).toEqual(before.meta[KEYS.kept]);
    expect(profiles[KEYS.kept]).toEqual(before.profiles[KEYS.kept]);
    expect(
      log.some((l) =>
        l.includes(
          "Abgewiesen: Fixtur-Galibier ab Lautaret (ors) – die gespeicherte osrm-Route bleibt",
        ),
      ),
    ).toBe(true);
  });

  test("the plan of the next run reads the outcome of this one", () => {
    const { counts, routes } = plan(curated, state, flags);
    expect(
      Object.fromEntries(routes.map(({ job, verdict }) => [job.key, verdict])),
    ).toEqual({
      [KEYS.accepted]: { act: "keep" },
      // Both rejections stand: the inputs have not changed and the stored
      // metrics still break the same limit, so asking again buys the same
      // answer. Only the kept one still has a route on the map.
      [KEYS.kept]: {
        act: "skip",
        why: `abgewiesen seit ${TODAY}, Eingaben und Grenzen unverändert`,
      },
      [KEYS.rejected]: {
        act: "skip",
        why: `abgewiesen seit ${TODAY}, Eingaben und Grenzen unverändert`,
      },
      [KEYS.tour]: { act: "keep" },
    });
    expect(counts.rejected).toBe(2);
    expect(counts.kept).toBe(1);
    expect(counts.pending).toBe(0);
    expect(reportLine(counts, { budget: 4500, upgradeOsrm: true })).toBe(
      "Fehlend: 0 Routen, 0 Profile, 0 Klimareihen, 0 Gipfelhöhen, 0 Straßenabstände · 2 abgewiesen (rejected.json) · 1 davon OSRM-Routen, deren ORS-Kandidat abgewiesen wurde",
    );
  });
});
