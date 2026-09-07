/**
 * Copies the MapLibre web worker into public/ so the browser can load it.
 *
 * MapLibre 6 locates its worker via `import.meta.url`, which Turbopack does not
 * expose as an http(s) URL; the worker then silently fails to start and no
 * GeoJSON layer ever renders. `pass-map.tsx` points `setWorkerUrl` at the copy
 * made here. Runs before `dev` and `build`; the output is git-ignored.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const src = join(import.meta.dir, "..", "node_modules", "maplibre-gl", "dist");
const dest = join(import.meta.dir, "..", "public", "maplibre");

await mkdir(dest, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(join(src, file), join(dest, file));
}
