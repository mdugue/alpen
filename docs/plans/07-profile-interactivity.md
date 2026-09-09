# 07 · Profile interactivity

**Status:** [done](https://github.com/mdugue/alpen/pull/11) · **Effort:** S–M ·
**Depends on:** ~~02~~ – dropped, see "Data" · **Priority:** low under the
destination goal; do it when the detail panel gets attention anyway

## Goal

Hovering, touching or keyboard-scrubbing the elevation profile shows the
position on the map and the exact km / elevation / gradient; the ascent stats
gain "steilster Kilometer".

## Why now

The profile is the one place where the app is already better than a table,
but it is passive: segment values sit in `<title>` tooltips that touch users
never see, and there is no link between profile and map. For destination
planning this is a detail, hence the low priority. It is cheap.

## Non-goals

Route editing, GPX export, turn-by-turn anything.

## Design

### Data

Each profile sample needs a coordinate. **As built, none are stored.**
`routes.json` already ships to the client in full (the map draws every ascent
from it), and the sample indices are deterministic – `Math.round(i * step)`
over the route geometry, the same positions the elevation request used. So
`lib/profile.ts` holds that sampling as one function, `profileCoords`, that
`scripts/build-data.ts` and the panel both call: build and runtime cannot
drift, and the payload does not grow by a byte. That is what removes the
dependency on plan 02, which existed only because of the ~400 KB `pts` would
have added.

`maxKmGradient` (steepest 1 km window) is added to `ElevationProfile`.
Existing profiles pick it up through `bun run data:build --backfill`, which
recomputes everything derivable from the route and the samples without an API
call.

That backfill also **corrected `dist`, `km` and `avgGradient`**: they were
measured from sample to sample, and a chord chain through the Stelvio's 48
hairpins is two kilometres short (24,3 km of road came out as 21,7 km, and
every gradient derived from it was too steep). `profileDistances` measures
along the full geometry instead.

The steepest kilometre stays an estimate. A hundred DEM samples a few hundred
metres apart carry ±20 m of noise, and taking the maximum over ninety windows
picks the worst of it – a raw endpoint delta puts the Stelvio at 15,5 %.
`steepestKm` smooths over three samples and fits a line through each window,
which brings it to 12,5 % against a measured ~11 %. It still leans high, so
the "Auffahrten" section carries an info tooltip saying so.

### Profile component

`components/panel/elevation-profile.tsx` becomes a client component:

- Pointer move / touch drag over the SVG maps x → sample index; a vertical
  cursor line and a small label (km, m, %) render inside the SVG. Touch scrubs
  only while held (`touch-action: pan-y`), so the sheet still scrolls.
- Keyboard: the figure is focusable with `role="slider"`, arrow keys move the
  cursor by one sample, PageUp/Down by ten, Home/End jump; `aria-valuetext`
  reads "km 8,4 · 2.100 m · 7,2 %".
- `onCursor(point | null)` bubbles up with the coordinate from `profileCoords`.
- Click, or Enter on the focused figure, flies the map to that point at zoom 13
  (hairpin inspection).

### Map

`pass-map.tsx` gets a `profileCursor: LatLon | null` prop backed by a one-point
GeoJSON source and a topmost circle layer (paper fill, ink stroke, radius 6);
`setData` with one point is cheap enough for every pointer move. A second prop,
`profileZoom`, carries the fly-to request. The elevation label stays in the
figure – on the map it would only fight the pass labels.

### Stats line

"17,2 km · 1.434 hm · Ø 7,2 % · steilster km 11,4 % · 1.402 → 2.639 m".

## Steps

1. Build-script fields + `--backfill` migration + `check-data` (the schema
   refinement keeps `dist` and `ele` the same length; `lib/profile.test.ts`
   checks the stored values against a recomputation).
2. Interactive profile with keyboard support.
3. Cursor source/layer in the map, prop plumbing through the explorer.
4. Screenshots and a keyboard walkthrough in the PR.

## Acceptance criteria

- Moving over the profile moves a marker along the drawn ascent on the map.
- Works with touch and with keyboard only; the values are announced.
- The steepest-km figure matches a manual check for two known passes
  (Mortirolo, Zoncolan). Partly: the terrain model is too coarse for a
  measurement-grade figure. Stelvio lands at 12,5 % (measured ~11 %),
  Mortirolo at 17,3 % and Zoncolan at 17,9 % – the right order, still high in
  absolute terms, which the section's info tooltip says.
