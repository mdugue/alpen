# 07 · Profile interactivity

**Status:** proposed · **Effort:** S–M · **Depends on:** 02 (so that only the
selected pass's profile data ships) · **Priority:** low under the destination
goal; do it when the detail panel gets attention anyway

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

Each profile sample needs a coordinate. Add `pts: [lat, lon][]` (100 pairs,
about 2.4 KB per ascent) and `maxKmGradient: number` (steepest 1 km window)
to `ElevationProfile` in `scripts/build-data.ts`; the sample indices are the
same `Math.round(i * step)` positions already used for the elevation request.
Existing profiles get the fields through a one-off `--format`-style migration
that recomputes them from `routes.json` without any API call.

With plan 02 a route ships only the selected pass's profiles, so the extra
bytes do not matter; without plan 02 they would add ~400 KB to the start page,
which is why this plan waits.

### Profile component

`components/panel/elevation-profile.tsx` becomes a client component:

- Pointer move / touch move over the SVG maps x → sample index; a vertical
  cursor line and a small label (km, m, %) render inside the SVG.
- Keyboard: the figure is focusable with `role="slider"`, arrow keys move the
  cursor by one sample, Home/End jump; `aria-valuetext` reads "km 8,4, 2.100 m,
  7,2 %".
- `onCursor(index | null)` bubbles up with the coordinate from `pts`.
- Click flies the map to that point at zoom 13 (hairpin inspection).

### Map

`pass-map.tsx` gets a `cursor: LatLon | null` prop backed by a one-point
GeoJSON source and a circle layer (paper fill, ink stroke, radius 6) plus an
optional elevation label. `setData` with one point is cheap.

### Stats line

"17,2 km · 1.434 hm · Ø 7,2 % · steilster km 11,4 % · 1.402 → 2.639 m".

## Steps

1. Build-script fields + migration + `check-data` (lengths match).
2. Interactive profile with keyboard support; keep the static SVG for the
   server-rendered shell (plan 02) and hydrate the interaction.
3. Cursor source/layer in the map, prop plumbing through the explorer context.
4. Screenshots and a keyboard walkthrough in the PR.

## Acceptance criteria

- Moving over the profile moves a marker along the drawn ascent on the map.
- Works with touch and with keyboard only; the values are announced.
- The steepest-km figure matches a manual check for two known passes
  (Mortirolo, Zoncolan).
