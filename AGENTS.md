## What you are working on

A map app for road cyclists planning a holiday in the Alps: passes, their
ascents, loop tours and cycling towns, rated by rideability for a chosen
half-month. The product goal is **finding and comparing destinations**, not
route planning. The questions it must answer well: "which regions are good
in early October if we want to ride a few nice passes", "where should we look
for a hotel so that several passes and a loop are within reach", "which
destinations should we keep an eye on for single-day and multi-day tours".
Turn-by-turn planning, GPX export and navigation are out of scope; Komoot and
friends do that better and the app links out to them.

## Principles

1. **Stay static.** Content data lives in `data/*.json` and
   `data/generated/*.json` and is imported at build time. When in doubt, new
   data is _precomputed_ (`scripts/build-data.ts`) rather than fetched at
   runtime. Runtime fetches need a good reason and belong behind a route with
   `"use cache"` + `cacheLife`; the one exception is a content-hashed static
   file under `public/` (the map geometry), which is precomputed too and
   cached by name.
2. **German in the UI**, English in code, comments and docs. Numbers are
   formatted with `toLocaleString("de-DE")` (see `fmt` in `lib/utils.ts`).
3. **Stay honest.** The 1–5 scales are editorial judgements and the status is
   a heuristic. Both are labelled as such in the scales dialog and must never
   be presented as measured values.
4. **No silent data changes.** Whoever touches `data/*.json` runs
   `bun run data:check`. Routed geometry passes the quality gate in
   `scripts/lib/validate.ts` before it is stored; what fails lands in
   `rejected.json` with its measured values. Judging is separate from measuring
   so `bun run data:check --explain` can re-evaluate every route against a
   changed threshold offline, without spending API calls.
5. **Destination first.** Judge a feature by whether it helps choose where
   and when to go. Overview beats precision: a season strip for 92 passes is
   worth more than a metre-exact profile for one. Route-level detail ranks
   last (see `docs/plans/README.md`).

## Where things live

| Topic                                           | File                                                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rideability heuristic                           | `lib/status.ts` (`passStatus`, `tourStatus`)                                                                                                                |
| Data schemas (zod) and inferred types           | `lib/schema.ts`, `lib/types.ts`, `data/schema/*.schema.json` (`bun run data:schema`)                                                                        |
| Regions and countries (vocabulary)              | `lib/regions.ts`                                                                                                                                            |
| Data access (cached, validated)                 | `lib/data.ts`                                                                                                                                               |
| Profile sampling and derived gradients          | `lib/profile.ts`                                                                                                                                            |
| Filter, selection and URL state (hash keys)     | `lib/app-state.ts`, `components/explorer.tsx`                                                                                                               |
| Town labels: vocabulary, icons, badges          | `lib/regions.ts` (`TOWN_TAGS`), `lib/tag-icons.ts`, `components/town-tags.tsx`                                                                              |
| Search normalisation and haystacks              | `lib/search.ts`                                                                                                                                             |
| Map, layers, 3D, markers, labels, feature state | `components/map/pass-map.tsx`                                                                                                                               |
| Basemap: vector style, palette, glyphs          | `lib/basemap.ts`, `lib/palette.ts`, `scripts/build-map-style.ts` (→ `public/map/style-*.json`), `scripts/build-glyphs.ts` (→ `public/map/fonts`, committed) |
| Map assets: GeoJSON, simplification, hashing    | `lib/map-assets.ts`, `scripts/build-map-assets.ts` (→ `public/map`, git-ignored)                                                                            |
| Tours within reach, town reach hull             | `lib/nearby.ts`, `lib/geo.ts` (computed on the server in `lib/data.ts`)                                                                                     |
| Photos: keys, sizes, licence metadata           | `lib/photos.ts`, `scripts/build-photos.ts` (`bun run data:photos`) → `data/generated/photos.json`                                                           |
| Period scrubber floating over the map           | `components/map/period-scrubber.tsx`                                                                                                                        |
| Season strip (24 half-months)                   | `components/season-strip.tsx`                                                                                                                               |
| Sidebar: search, filters, one list per kind     | `components/sidebar/`, `lib/rows.ts`                                                                                                                        |
| Detail panel incl. profile/weather/climate      | `components/panel/` (collapsible blocks: `components/panel/section.tsx`)                                                                                    |
| Bottom sheet on phones (one per panel)          | `components/mobile-sheet.tsx`                                                                                                                               |
| Precomputation, data checks                     | `scripts/build-data.ts`, `scripts/build-photos.ts`, `scripts/check-data.ts`                                                                                 |
| Route quality gate: checks and thresholds       | `scripts/lib/validate.ts`; pass-point placement `scripts/locate-pass.ts` (`bun run data:locate`), `scripts/lib/locate.ts`                                   |
| Name, claim, colours, mark, base URL            | `lib/brand.ts`, `lib/mark.tsx`                                                                                                                              |
| Icons, share image, manifest, robots, sitemap   | `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`, `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts`                                       |
| Legal pages                                     | `app/impressum/`, `app/datenschutz/`                                                                                                                        |
| Linting and formatting                          | `oxlint.config.ts`, `oxfmt.config.ts`                                                                                                                       |
| Implementation plans                            | `docs/plans/` (index: `docs/plans/README.md`)                                                                                                               |
| Project skills                                  | `.agents/skills/implement-plan`, `curate-data`, `preview-app`                                                                                               |

## Conventions

- **shadcn/ui, style "mira" (`base-mira`).** `components/ui/` holds the
  official components generated from the preset (`bun run ui:init`,
  `bun run ui:add`). They are built on `@base-ui/react`, not Radix, so the
  API differs from older shadcn snippets: `ToggleGroup` takes `multiple`
  instead of `type="multiple"`, `Slider.onValueChange` receives
  `number | number[]`, and button icon sizes are `icon-sm`/`icon-xs`, not
  `iconSm`. Do not edit files in `components/ui/` by hand; domain-specific
  styling (status badges, etc.) goes into the consuming component via
  `className`. Re-running `ui:init` overwrites `app/globals.css`; the domain
  tokens (`--status-open`, `--status-risky`, `--status-closed`, `--tour`,
  `--town` plus their `@theme inline` lines), the `--text-2xs` step below
  Tailwind's `text-xs`, the MapLibre rules at the end, the coarse-pointer
  font-size rule next to them and the dark-mode setup must be restored
  afterwards.
- **Sizes come from the scale, not from pixels.** Font sizes, spacing and radii
  are Tailwind steps; an arbitrary value (`text-[13px]`, `rounded-[3px]`) is
  only for what the scale genuinely cannot express, such as a `calc()` width or
  the inset shadow marking the current row. The dense map furniture needs one
  step below `text-xs`, so the scale carries `text-2xs` (10 px) as a token –
  add to the scale rather than reaching for a pixel value.
- **Touch targets follow the pointer, not the width.** Safari on iOS zooms the
  page in when a focused form control carries a font size below 16 px, and on a
  map that fills the viewport that zoom has no way back. An unlayered rule at
  the end of `app/globals.css` gives every control 16 px on a coarse pointer –
  unlayered because it has to beat the `text-xs` utilities the components carry
  – and `TOUCH_CONTROL`, `TOUCH_SELECT` and `TOUCH_ICON` in `lib/utils.ts` grow
  the boxes to match, on the same `pointer-coarse` condition. With a mouse
  everything stays as dense as it was.
- **Dark mode follows the OS, nothing else.** There is no theme toggle and no
  `next-themes`; the dark tokens sit in a `prefers-color-scheme` media query
  and Tailwind's default `dark:` variant is used. Delete the
  `@custom-variant dark (&:is(.dark *))` line that `ui:init` writes.
- **Layout: the map is the page.** No header, toolbar or footer. On desktop
  the map fills the viewport and two translucent panels float over its left
  edge: the collapsible sidebar (`components/sidebar/`: search, filters, one
  collapsible list per kind) and, while something is selected, the detail
  slide-over next to it. Their widths are mirrored in `explorer.tsx`
  (`SIDEBAR_W`, `DETAIL_W`) and fed to MapLibre as left padding so camera
  targets stay visible. Below `lg` the split is the same, only turned by
  90°: two `MobileSheet`s (`components/mobile-sheet.tsx`, a `Drawer` with snap
  points each) hold the same two panels, the list sheet on its peek row and the
  detail sheet sliding in over it, and the height of whichever is in front is
  fed to MapLibre as bottom padding. Both keep their own state, so a detail
  never takes the list's place and the lists keep their scroll position.
  A sheet sizes itself from `--drawer-snap-point-offset`: the popup is a full
  `100dvh` and padded off at the bottom by that offset, so its content box ends
  at the fold. The peek row carries a **button** that opens the sheet, not the
  search field itself: a field there would have the software keyboard come up
  in the same moment as the sheet moves, and the two animations fight over
  where the field ends up. The field a thumb reaches is always in a sheet that
  already stands still. What floats over the map is one cluster in its top-left
  corner (`MAP_CLUSTER`, next to the panels' left edge): the period scrubber
  and, on the same panel surface, the three map tools – layers, 3D, fit. The
  tools are one segmented column in the same outline as the scrubber's own
  stepper, stretched to its height, so they read as pressable and the cluster
  keeps an even edge; `MAP_TOOL` settles the outline, because `Button` and
  `Toggle` disagree about hover, border token and dark fill. The scrubber
  reaches the map through the `scrubber` prop rather than `children`, which is
  what stays free-floating beside the cluster – today the sidebar's own toggle.
  The scrubber carries the
  24 half-months, the histogram of what is rideable and the "heute" marker,
  and every list row repeats the same 24 cells as a `SeasonStrip`. Map
  visibility is always a `Switch` ("auf der Karte"), one per kind, two-state
  buttons are always a `Toggle`. Without a camera or a selection in the hash
  the map opens on the frame the fit button produces, not on a fixed overview.
- **Charts come from the shadcn `chart` component** (recharts under the hood).
  It is the only heavy dependency in the app, so the one chart that uses it
  (`components/panel/climate-chart.tsx`) is pulled in with `next/dynamic` and
  never reaches the first load. Stat tiles and dense rows use `Item`, stepper
  groups use `ButtonGroup`.
- **Photos are borrowed, not owned.** The detail panel opens with a slideshow
  of Wikimedia Commons photos (`components/panel/photo-carousel.tsx`).
  `scripts/build-photos.ts` picks them once, without an editorial step – a
  geosearch around the pass point, a name filter that keeps signs and maps out,
  a rank by name match – and stores only metadata in
  `data/generated/photos.json`: the thumbnail URL, the author, the licence and
  the file page. The files themselves stay on Wikimedia's CDN and reach the
  browser through a plain `<img>`; they are already the right size and already
  cached, and mirroring them would put ~25 MB of binaries into the repo.
  Attribution is not decoration: every slide carries author and licence,
  baked into the slide rather than derived from the carousel's index, so it
  cannot drift out of sync with what is on screen.
- **A sidebar section adds no surface.** The three collapsible lists
  (`components/sidebar/section.tsx`) carry no background of their own in either
  state – neither a tint on the header nor the ghost trigger's
  `aria-expanded` fill – so the panel's frosted backdrop reads through them
  evenly. That is also why the header does not stick: a pinned header needs a
  background to stay legible over the rows scrolling under it, and a
  `backdrop-blur` cannot supply one, because the panel already filters its
  backdrop and a nested filter never sees the content inside that backdrop
  root.
- **The panel folds.** Every block below the title is a `Section`
  (`components/panel/section.tsx`), open by default. The panel is a column on a
  map and a phone sheet shows two blocks at a time; whoever wants the climate
  should not scroll past two elevation profiles first. Which blocks are folded
  is one `sessionStorage` entry shared by all of them (`SECTIONS_KEY`), keyed
  by section id and holding the _closed_ ones: a fold carries over to the next
  pass looked at, a new section opens by itself, and the next visit starts
  unfolded again. A section title says what the block is and nothing else;
  where a source or its caveat has to be named, one short sentence sits behind
  the `info` tooltip. A header never opens a dialog – the scales dialog belongs
  to the sidebar footer, which is where it stays.
- **A tour is dashed, an ascent is solid.** A tour _is_ the union of several
  ascents – the Sellaronda is its four passes – so as a second solid line of
  its own it and the ascents merely covered each other, and telling them
  apart by width alone both fails at a glance and makes the tour look like
  the more important of the two. It is drawn instead the way a map draws any
  named route that follows roads it does not own: as a dashed line laid over
  them (`tours`), narrower than the ascent and interrupted, so the two are
  told apart by texture rather than by weight. The status colour shows as a
  border along every dash and in full through every gap, and a stretch of
  tour with no ascent under it reads as what it is – connecting road, not a
  rated climb. Its paper casing (`tours-casing`) sits _below_ the ascent, so
  it gives the dash something to stand on over the bare hillshade without
  eating the status colour where there is an ascent. The dash counts in line
  widths, so the casing's array is divided by the same factor its width is
  multiplied by, or the two drift out of step (`DASH`, `CASING` in
  `pass-map.tsx`). The tour is boldest zoomed out, where it stands alone, and
  finest zoomed in, where it annotates an ascent.
- **Translucent lines need `line-layer-opacity`, not `line-opacity`.**
  MapLibre draws a line as one triangle strip, so a bend tighter than the
  line is wide runs the strip over itself. `line-opacity` is applied per
  feature, so every such overlap composites twice and a switchback fills with
  blotches; `line-layer-opacity` (MapLibre GL JS 6+) flattens the layer to a
  single surface first and composites that once, which is what makes a
  translucent line usable in a hairpin at all. It is data-constant – zoom and
  global state only, no feature state – so anything per-feature has to be
  carried by width or colour instead. `line-gap-width` has a second, purely
  geometric failure in the same bends, folding its inner side inside out;
  there is no property that fixes that one, so offset lines stay out.
  Widths interpolate with the zoom and grow again for the selected tour;
  because a zoom expression may only be the input of the _outermost_ stop
  function, the selection case goes inside the stops (`tourWidth`). Hover and
  click are one `queryRenderedFeatures` over `HIT_LAYERS` rather than a
  handler per layer: several layers answer for the same pixel now, and
  `HIT_LAYERS` spells the priority out rather than taking it from the style,
  because the two disagree – the tour dashes are painted _over_ the ascent
  they annotate, but a click on them means the ascent.

- **Colours only via tokens.** MapLibre cannot read CSS variables;
  `pass-map.tsx` reads them once via `getComputedStyle` (`readColors`). Add
  new map colours there rather than hard-coding them.
- **Site metadata is generated, never committed as a binary.** Icons, the share
  image, the manifest, `robots.txt` and `sitemap.xml` are Next metadata routes
  under `app/`, prerendered at build time. Everything they need – name, claim,
  base URL, the sRGB palette and the mark geometry – lives in `lib/brand.ts`,
  because neither Satori nor a manifest can read CSS variables; `lib/mark.tsx`
  paints that geometry as the badge the favicon, the touch icon and the share
  image all share. Change those two, not the routes. The badge is monochrome
  and has its own small grey scale rather than the UI tokens: it is seen at
  16 px against unknown browser chrome, where depth has to come from tone and
  the page palette does not carry far enough. `robots.ts` welcomes search engines and turns away
  the training and answer-engine crawlers; pages that carry
  `robots: { index: false }` stay crawlable on purpose, since a crawler has to
  fetch a page to see that.
- **Route geometry never travels as props.** `scripts/build-map-assets.ts`
  (runs before `dev` and `build`, next to the worker copy) simplifies
  `routes.json` to 5 m and writes one content-hashed GeoJSON per kind into
  `public/map` (git-ignored, cached immutably via `next.config.ts`).
  `lib/data.ts` derives the same file names with `lib/map-assets.ts` and hands
  the page the URLs plus the tour bounding boxes; MapLibre fetches the files
  and tiles them in its worker. `pass-map.tsx` never calls `setData` on the
  `routes` and `tours` sources: which lines show is a layer filter (which also
  keeps hidden lines out of hit-testing), status and selection are feature
  state. MapLibre keeps that state per source and applies it to tiles as they
  load, so it is set as soon as the style is parsed (`style.load`) and needs
  no re-application when the file arrives. Points (passes, towns) stay in-memory sources,
  because their symbol layers need real properties. Anything else the client
  used to read from the geometry is precomputed on the server: tours within
  reach of an entity (`lib/nearby.ts`) and the road coordinate of every
  profile sample (`ProfileWithCoords`).
- **The basemap is generated, and it follows the OS scheme.** The default
  base is a vector style painted from the app's own palette (`lib/basemap.ts`,
  colours in `lib/palette.ts`), tiles from OpenFreeMap, no key. Layer stack,
  bottom to top: the basemap's fills (land, built-up, wood, glacier, water),
  the hillshade from the Terrarium DEM, the basemap's lines and labels
  (rivers, borders, roads from zoom 6 to minor roads at 11, road names at 12,
  lakes, peaks with elevation at 10, places), the raster overlays, then the
  app's own layers (the hovered town's reach, the tour casings, the ascents,
  the tour dashes over them, towns, passes, labels, profile cursor). MapLibre places labels from the top of the style
  down, so that order is also their collision priority: a pass label wins
  against a town name, and both win against the basemap's own place names.
  Roads are thin and neutral and there are no POIs: the mountain roads that
  matter are the app's lines, and the status and tour colours are what should
  dominate. Labels prefer `name:de`. The raster alternatives (OSM, OpenTopoMap,
  CyclOSM, Esri, satellite) stay in the layer popover; a raster base is one
  layer below the hillshade. Switching base or scheme never rebuilds the map:
  `applyBase` in `pass-map.tsx` swaps only the layers whose id starts with
  `base`, and a `prefers-color-scheme` change re-reads the tokens, repaints
  the icons and sets every paint property of the app's layers again from the
  same `appLayers` definition the style was built from – camera, sources,
  filters and feature state stay. Glyphs are served from `public/map/fonts`:
  the Latin ranges of Inter, the UI's own face, rasterised once into
  MapLibre's glyph atlases by `scripts/build-glyphs.ts` and committed – so
  map and panels share one family, the hermetic e2e suite renders labels and
  the map has no font server to wait for; `scripts/build-map-style.ts` writes the same style
  as two standalone JSON files for tuning in a style editor.
- **MapLibre needs two workarounds.** Its web worker is resolved via
  `import.meta.url`, which Turbopack does not serve, so
  `scripts/copy-maplibre-worker.ts` copies the worker into `public/maplibre`
  (git-ignored, runs before `dev` and `build`) and `pass-map.tsx` calls
  `setWorkerUrl`. And computed CSS custom properties come back as `lab()`,
  which MapLibre cannot parse; `toRgb` in `pass-map.tsx` converts them
  through a canvas pixel before they reach the style.
- **TypeScript 7 side by side with the 6.0 API.** `tsc` (and thus
  `bun run typecheck` and `next build`) is TypeScript 7, installed as
  `@typescript/native`. The `typescript` package name resolves to
  `@typescript/typescript6` (`tsc6` is that version's binary), because
  TypeScript 7.0 has no JavaScript API and the editor language service still
  wants one – `.vscode/settings.json` points `js/ts.tsdk.path` at it. Keep
  both entries in `package.json`.
- **React Compiler is on.** No manual `useMemo`/`useCallback` for
  optimisation; oxlint ports the whole React Compiler rule set under
  `react/*` (`set-state-in-effect`, `purity`, `immutability`, `refs`,
  `preserve-manual-memoization`, …) and every one of them is an error.
  `setState` in an effect is needed in exactly one documented place (hash
  initialisation in `explorer.tsx`).
- **Cache Components.** `"use cache"` sits on the data functions and on
  `app/page.tsx`. Introducing `cookies()`, `headers()` or `searchParams`
  breaks prerendering – put such things in a separate dynamic child component
  inside `<Suspense>` instead.
- **oxlint and oxfmt, no ESLint.** `bun run lint` is `ultracite check`
  (oxlint plus an oxfmt format check), `bun run lint:fix` writes the fixes.
  oxlint's `nextjs` and `react` plugins cover everything `eslint-config-next`
  did, React Compiler rules included, so ESLint and `eslint-config-next` are
  gone. The two config files only ever _deviate_ from the ultracite preset,
  and every deviation carries the reason next to it – keep it that way rather
  than silencing a rule at the call site.

## Before opening a PR

```bash
bun run typecheck && bun run lint && bun test && bun run build && bun run data:check
```

`bun test` runs the unit tests next to the code; `bun run e2e` drives the
built app in a headless browser (needs a Chrome, see `test/browser.ts`).

For anything visible, add screenshots (`preview-app` skill). When a PR
implements a plan, update the plan's status header and the table in
`docs/plans/README.md` in the same PR.

## Next tasks

See `docs/plans/README.md` for the ordered plans and `docs/roadmap.md` for
what lies beyond them. The biggest open item outside the plans is the official
live closure status; the heuristic in `lib/status.ts` is designed as a
replaceable layer for it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
