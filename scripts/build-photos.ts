#!/usr/bin/env bun
/**
 * Precomputation of the detail-panel photos.
 *
 *   bun run data:photos                    # fill the gaps
 *   bun run data:photos --refresh          # ask Commons again for everything
 *   bun run data:photos --only stelvio     # restrict to matching slugs
 *   bun run data:photos --blur             # only the placeholders, again
 *
 * Writes `data/generated/photos.json`: per pass, town and tour a handful of
 * Wikimedia Commons photos with the author, licence and file page their
 * licences oblige us to print (`lib/photos.ts`). Nothing is fetched at runtime
 * and no binary enters the repo – only the thumbnail URLs on Wikimedia's CDN,
 * plus the one thing that has to be there before the CDN answers: a 20-px-wide
 * rendering of each photo, inlined as a data URI so the panel opens on the
 * photo's colours rather than on an empty box. Half a kilobyte each, and it is
 * a binary only in the sense that base64 is – the alternative, a placeholder
 * fetched at runtime, would lose the race it exists to win.
 *
 * There is no editorial step. Commons is asked for what stands within a few
 * hundred metres of the pass point, the obvious non-photographs are filtered
 * out by name and format, and what is left is ranked by how well the file name
 * matches the entity and how close it was found. A picture of the pass under a
 * metre of snow is a fair answer to "what does it look like up there" and stays
 * in; the rank only has to keep the road signs and the maps out.
 *
 * What this file does is read, write and print. Which places are asked about,
 * what is chosen from the answers and which placeholder is still wanted are in
 * `scripts/lib/photo-pipeline.ts`, where they are tested against a table of
 * cases instead of against the API.
 *
 * Rate limit. The Commons API and its file CDN are two hosts of the transport
 * (`scripts/lib/transport.ts`): serial, paced, and backing off when one of
 * them answers 429 anyway. If the API keeps saying 429 the run stops and
 * reports how many entities are left rather than hammering – what it had is
 * already on disk, and the next run picks up there. Every entity is written as
 * it arrives for the same reason: an interrupted run must not throw away an
 * hour of requests.
 */
import { mustRead, writeData } from "./lib/data-files";
import { runPhotos } from "./lib/photo-pipeline";
import type { PhotoFlags, StoredPhotos } from "./lib/photo-pipeline";
import { liveTransport } from "./lib/transport";

const argOf = (name: string) =>
  process.argv.includes(name)
    ? process.argv[process.argv.indexOf(name) + 1]
    : undefined;

const flags: PhotoFlags = {
  only: argOf("--only"),
  reblur: process.argv.includes("--blur"),
  refresh: process.argv.includes("--refresh"),
};

/** Validated and laid out by the one writer, like every other file in `data/`. */
const save = (photos: StoredPhotos) =>
  writeData("generated/photos.json", photos);

const { asked, photos, stopped, todo } = await runPhotos({
  curated: {
    passes: await mustRead("passes.json"),
    tours: await mustRead("tours.json"),
    towns: await mustRead("towns.json"),
  },
  flags,
  log: (line) => {
    console.log(line);
  },
  save,
  state: await mustRead("generated/photos.json"),
  transport: liveTransport(),
  warn: (line) => {
    console.warn(line);
  },
});

const all = Object.values(photos).flat();
console.log(
  `\n${Object.keys(photos).length} Einträge, ${all.length} Fotos, ${asked} von ${todo} abgefragt, ` +
    `${all.filter((p) => p.blur).length} mit Vorschau.`,
);
if (stopped)
  console.warn(
    `${stopped} – ${todo - asked} offen, "bun run data:photos" später erneut ausführen.`,
  );
