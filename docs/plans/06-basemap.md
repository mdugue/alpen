# 06 · A basemap that matches the theme

**Status:** proposed · **Effort:** M · **Depends on:** – · **Unblocks:** 08
(map labels per language), better screenshots and share images

## Goal

The default basemap is a vector style generated from the app's own palette,
with a dark variant that follows `prefers-color-scheme`, German labels, muted
roads so status colours dominate, and no dependency on the OpenStreetMap
raster tile servers for default traffic.

## Why now

- In dark mode the panels are dark and the map is a bright OSM raster; the
  screenshot pair in the analysis shows the mismatch.
- `tile.openstreetmap.org` is the default base layer. The OSM tile usage
  policy discourages apps from using it as their default, and the raster
  cannot be restyled.
- Vector tiles are lighter than 256 px raster tiles at Alpine zoom levels and
  allow the status colours, tour colours and labels to be tuned against a
  known background.

## Non-goals

Replacing the terrain source (Terrarium DEM stays for hillshade and 3D) or
removing the raster alternatives (OpenTopoMap, CyclOSM, Esri, satellite stay
selectable in the layer popover).

## Design

### Tiles

OpenFreeMap: free, no key, no registration, OpenMapTiles schema.

- TileJSON: `https://tiles.openfreemap.org/planet` (verified reachable, tiles
  under `/planet/<date>/{z}/{x}/{y}.pbf`).
- Fonts: `https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf`.
- Sprites: `https://tiles.openfreemap.org/sprites/ofm_f384/ofm`.
- Reference styles for derivation: `/styles/positron` (muted), `/styles/liberty`.
- Attribution: "© OpenFreeMap © OpenMapTiles Data from OpenStreetMap".

Fallback plan if OpenFreeMap changes terms: a Protomaps PMTiles extract of the
Alps (roughly 43–49° N, 4–16° E, a few hundred MB) hosted on Vercel Blob or
Cloudflare R2, read with the `pmtiles` protocol. Same OpenMapTiles-like
schema family, so the style needs small edits only.

### Style generation

`scripts/build-map-style.ts` writes `public/map/style-light.json` and
`public/map/style-dark.json` from a small template plus the palette in
`lib/palette.ts` (sRGB values mirroring `app/globals.css`, the same list
`app/opengraph-image.tsx` keeps today; moving it to one module is plan 11,
item 14). Runs with the other pre-build scripts.

Style intent:

- Land, water, glaciers, wood in three quiet tones per scheme; hillshade from
  the existing DEM layer on top with low exaggeration.
- Roads: only `motorway`–`tertiary` and `minor` at zoom ≥ 11, thin, neutral;
  no road labels below zoom 12; mountain roads are what the app draws itself.
- Labels: `["coalesce", ["get", "name:de"], ["get", "name"]]`; place labels
  city/town/village by zoom; peaks with elevation at zoom ≥ 10 (the
  `mountain_peak` layer, nice for orientation); no POIs.
- Borders: subtle country borders (the app is multi-country).
- Dark variant: same layers, palette swapped, label halos from `--card`.

### Switching

- Initial style: `style-dark.json` when `matchMedia("(prefers-color-scheme: dark)")`
  matches, else light.
- On change: `map.setStyle(url, { transformStyle })`, where `transformStyle`
  merges the app's own sources and layers (`dem`, `routes`, `tours`,
  `passes`, `towns` and their layers) into the new style so nothing has to be
  re-added. Re-read the colour tokens (`readColors`) and update the paint
  properties of the app layers, since `--status-*` differ per scheme.
- The base-layer radio in the popover gains "Karte (hell/dunkel automatisch)"
  as the default option; the raster layers stay as before.

### Self-hosted glyphs

The app's own labels use `fonts.openmaptiles.org` today. Point them at the
OpenFreeMap fonts, or self-host the Latin ranges of Open Sans under
`public/map/fonts/` (about 1.5 MB, git-tracked or generated). Prefer
self-hosting: one external dependency less, matching the "stay static"
principle.

## Steps

1. Palette module + style generator with the light variant; wire into
   `dev`/`build`; add `public/map` to `.gitignore` (shared with plan 01).
2. Switch the default base layer to the generated style; keep raster options.
3. Dark variant + live switching with `transformStyle`; token re-read.
4. Glyph self-hosting.
5. Screenshots light/dark at zoom 6.5, 9 and 12 in the PR; compare tile bytes
   per view before/after (Playwright resource timing).

## Acceptance criteria

- Dark mode shows a dark map; toggling the OS scheme switches the map without
  losing routes, selection or camera.
- Pass labels, status colours and tour colours pass contrast checks on both
  backgrounds (WCAG AA for text with halo).
- No request to `tile.openstreetmap.org` unless the user selects that layer.
- Tile bytes for the overview view are lower than with raster.

## Risks and open questions

- Style tuning is the real effort; start from Positron and change as little as
  possible.
- OpenFreeMap has no contour lines; OpenTopoMap remains the choice for that.
- `setStyle` + `transformStyle` behaviour with terrain enabled needs a check
  (terrain source must survive the merge).
