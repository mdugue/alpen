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
   be presented as measured values. Values the app derives rather than reads
   (the valley temperature from the summit series) say "abgeleitet" wherever
   they show, and the raw summit values stay visible next to them.
4. **No silent data changes.** Whoever touches `data/*.json` runs
   `bun run data:check`. Routed geometry passes the quality gate in
   `scripts/lib/validate.ts` before it is stored; what fails lands in
   `rejected.json` with its measured values. Judging is separate from measuring
   so `bun run data:check --explain` can re-evaluate every route against a
   changed threshold offline, without spending API calls. And every stored
   route records what it was fetched for (`meta.inputs` in
   `routes-meta.json`): move a coordinate and the next `data:build` routes it
   again by itself, instead of leaving a geometry that ends at the old marker.
5. **Destination first.** Judge a feature by whether it helps choose where
   and when to go. Overview beats precision: a season strip for every road is
   worth more than a metre-exact profile for one. Route-level detail ranks
   last (see `docs/plans/README.md`).

## Where things live

| Topic                                           | File                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The core · what the app decides                 | `reduce` in `lib/app-state.ts`: the selection and everything that follows from it, what is shown, the half-month, the filters, the two sheet snaps                                                                                                                                                                                         |
| The core · where the camera goes                | `camera` in `lib/map-camera.ts`: `(state, event) → [state, commands]`, every flight and every padding as a trace in `lib/map-camera.test.ts`                                                                                                                                                                                               |
| The core · what the map draws                   | `buildScene` in `lib/map-scene.ts` and `pick` in `lib/map-pick.ts`, both read off the layer table `lib/map-layers.ts`                                                                                                                                                                                                                      |
| The core · what one panel says                  | `detailModel` in `lib/detail-model.ts`, with the fetch phases in `lib/detail-state.ts` and what is near it in `lib/reach.ts`                                                                                                                                                                                                               |
| Adapter · the address bar                       | `lib/hash-adapter.ts` (`useHashAdapter`, `cameraIntent`): the link in as the `load` action, the state out as `history.replaceState`                                                                                                                                                                                                        |
| Adapter · web storage                           | `lib/use-stored.ts` (`PREFIX`, `STORAGE`, `useStored`, `useStorageAdapter`, `readStoredState`)                                                                                                                                                                                                                                             |
| Adapter · MapLibre                              | `components/map/apply-scene.ts` (the scene's difference) and `components/map/apply-camera.ts` (the camera's commands), both driven from `components/map/pass-map.tsx`                                                                                                                                                                      |
| Adapter · the fetch                             | `lib/use-fetch.ts`, read by `lib/detail-state.ts` for the detail file and by the weather block                                                                                                                                                                                                                                             |
| Rideability heuristic                           | `lib/status.ts` (`passVerdict`, the reason ladder `REASON_ORDER`, `Grade`); the 24 half-months of one pass or tour in `passYear`/`tourYear`, computed once by `getYears` (`lib/data.ts`); thresholds in `SIGNALS` (`docs/scales.md`); the sentences in `badgeWord`, `bestText`, `reasonParagraph`, `climateText`, `tourText`, `ladderText` |
| Daylight (sunrise, sunset, day length)          | `lib/daylight.ts`, pure astronomy, no data                                                                                                                                                                                                                                                                                                 |
| Data schemas (zod) and inferred types           | `lib/schema.ts` (`FILES`: schema, layout, may it be missing), `lib/types.ts`, `data/schema/*.schema.json` (`bun run data:schema`); the one reader/writer pair `scripts/lib/data-files.ts`                                                                                                                                                  |
| Regions and countries (vocabulary)              | `lib/regions.ts`                                                                                                                                                                                                                                                                                                                           |
| Data access (cached, validated)                 | `lib/data.ts`                                                                                                                                                                                                                                                                                                                              |
| Profile sampling and derived gradients          | `lib/profile.ts`                                                                                                                                                                                                                                                                                                                           |
| Hash keys, the entity key, who dispatches       | the keys in `lib/hash.ts` (`parseHash`, `serializeHash`), `entityKey` in `lib/route-key.ts`, `initialState` and `Shown` in `lib/app-state.ts`; dispatched from `components/explorer.tsx`                                                                                                                                                   |
| Road types and labels (vocabulary)              | `lib/regions.ts` (`ROAD_TYPES`, `ROAD_TAGS`, `isTraverse`, `hasRoadSummit`)                                                                                                                                                                                                                                                                |
| Tag labels: vocabulary, icons, badges           | `lib/regions.ts` (`TOWN_TAGS`, `ROAD_TAGS`, `TAG_LABEL`), `lib/tag-icons.ts`, `components/tags.tsx`                                                                                                                                                                                                                                        |
| Search normalisation and haystacks              | `lib/search.ts`                                                                                                                                                                                                                                                                                                                            |
| Map, layers, 3D, markers, labels, feature state | `components/map/pass-map.tsx`; the layer ids in `lib/map-layers.ts` (`LAYERS`, `HIT_GROUPS` derived from it), the double-click window in `lib/map-pick.ts`                                                                                                                                                                                 |
| The shell's layout, and the drawers on phones   | `components/shell.tsx`: the header, the two floating panels, the season card and the two drawers, with `shellGeometry` measured where it is drawn; `components/explorer.tsx` fills its slots                                                                                                                                               |
| What the shell covers of the map, panel widths  | `lib/shell-geometry.ts` (`shellGeometry`, `sheetCover`): one calculation for the camera padding, the panel widths and the `--shell-*` custom properties the classes read; the drawer's own inset is measured by `useSheetInset` in `components/mobile-sheet.tsx`                                                                           |
| What the device does differently                | `MapEnvironment` in `lib/use-media-query.ts` (`useMapEnvironment`), built in `components/explorer.tsx` and handed to `PassMap` as one `env` prop                                                                                                                                                                                           |
| Basemap: vector style, palette, glyphs          | `lib/basemap.ts`, `lib/palette.ts` (`TOKENS`, the sRGB mirror of `app/globals.css`), `scripts/build-map-style.ts` (→ `public/map/style-*.json`), `scripts/build-glyphs.ts` (→ `public/map/fonts`, committed)                                                                                                                               |
| Map assets: GeoJSON, simplification, hashing    | `lib/map-assets.ts`, `scripts/build-map-assets.ts` (→ `public/map`, git-ignored); the hashed name, its prune pattern and its cache rule `lib/derived-file.ts`                                                                                                                                                                              |
| Detail assets: one file per entity, hashing     | `lib/detail-assets.ts`, `scripts/build-detail-assets.ts` (→ `public/detail`, git-ignored); the name and the patterns `lib/derived-file.ts`                                                                                                                                                                                                 |
| Weather route, Open-Meteo quota and cooldown    | `app/api/weather/[slug]/route.ts`                                                                                                                                                                                                                                                                                                          |
| Tours within reach, town reach hull             | `lib/nearby.ts`, `lib/geo.ts` (computed on the server in `lib/data.ts`); what is near one point at a time: `lib/reach.ts` (`withinReach`, `reachCount`)                                                                                                                                                                                    |
| Reach bands, the nearness weight                | `lib/geo.ts` (`REACH_BANDS`, `reachWeight`, `REACH_MAX_KM`); calibrated in `docs/scales.md`                                                                                                                                                                                                                                                |
| Level of detail on the map (by fame)            | `lib/prominence.ts`; the filters and the corner line in `components/map/pass-map.tsx`                                                                                                                                                                                                                                                      |
| Coverage per base: what is listed, what is not  | `scripts/analyze-coverage.ts`, `scripts/lib/coverage.ts` (Overpass, cached in `scripts/.cache/coverage`)                                                                                                                                                                                                                                   |
| Destination verdict, ranked reach, the inverse  | `lib/destination.ts` (`destinationAt`, `basesFor`, `gradeOf`), `components/panel/destination.tsx`, `scripts/analyze-destinations.ts`                                                                                                                                                                                                       |
| Hover shared by list, map and panel             | `hovered` in `components/explorer.tsx`; the ring, the lines, the hull and the label in `buildScene` (`lib/map-scene.ts`)                                                                                                                                                                                                                   |
| One tab stop per list; sharing the hash         | `lib/use-roving.ts`, `lib/use-share.ts`                                                                                                                                                                                                                                                                                                    |
| Photos: keys, sizes, licence metadata           | `lib/photos.ts`, `scripts/build-photos.ts` (`bun run data:photos`) → `data/generated/photos.json`                                                                                                                                                                                                                                          |
| Season band: period control and year chart      | `components/season-band.tsx`, `seasonBand` in `lib/rows.ts`                                                                                                                                                                                                                                                                                |
| Season strip (24 half-months)                   | `components/season-strip.tsx`                                                                                                                                                                                                                                                                                                              |
| Header bar and its one-sentence headline        | `components/app-header.tsx`, `lib/use-height.ts`                                                                                                                                                                                                                                                                                           |
| Filter controls, chips, applied-filter row      | `components/sidebar/filter-panel.tsx`, `components/sidebar/filter-chip.tsx`, `lib/filter-summary.ts`                                                                                                                                                                                                                                       |
| Sidebar: search, filters, one list per kind     | `components/sidebar/` (tabs: `kind-tabs.tsx`), `lib/rows.ts`                                                                                                                                                                                                                                                                               |
| Rows, their blocks and the drag they sit in     | `components/sidebar/entity-row.tsx`, `components/sidebar/row-list.tsx`, `rowBlocks` in `lib/rows.ts`                                                                                                                                                                                                                                       |
| Detail panel incl. profile/weather/climate      | `detailModel` (`lib/detail-model.ts`) and the renderers `components/panel/{pass,tour,town}-detail.tsx` under the shell `detail-panel.tsx`; blocks `section.tsx`, verdict box `verdict-box.tsx`, fetch phases `lib/detail-state.ts`, reach `lib/reach.ts`                                                                                   |
| One drawer, its snaps and its inset             | `components/mobile-sheet.tsx` (`MobileSheet`, `useSheetInset`); which drawer stands where is `components/shell.tsx`                                                                                                                                                                                                                        |
| Precomputation, data checks                     | `scripts/build-data.ts`, `scripts/build-photos.ts`, `scripts/check-data.ts`; what each run decides is `plan`/`afterGate` in `scripts/lib/decide.ts` (pure, table-tested), what it then does `runPipeline` in `scripts/lib/pipeline.ts` (offline in `scripts/pipeline.test.ts`), the climate buckets `scripts/lib/climate.ts`               |
| Route quality gate: checks and thresholds       | `scripts/lib/validate.ts` (`LIMITS`, `suspectPoint` for a marker); pass-point placement `scripts/locate-pass.ts` (`bun run data:locate`), `scripts/lib/locate.ts`                                                                                                                                                                          |
| The hosts the scripts ask, and the one fetch    | `scripts/lib/hosts.ts` (one function per question, URL and answer schema), `scripts/lib/transport.ts` (`HOSTS`: pace, budget, retries per host; the fixture transport), the Overpass → map-API fallback `scripts/lib/osm.ts`                                                                                                               |
| Name, claim, colours, mark, base URL, Ko-fi     | `lib/brand.ts`, `lib/mark.tsx`                                                                                                                                                                                                                                                                                                             |
| Icons, share image, manifest, robots, sitemap   | `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`, `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts`                                                                                                                                                                                                                      |
| Legal pages                                     | `app/impressum/`, `app/datenschutz/`                                                                                                                                                                                                                                                                                                       |
| Linting, formatting and the repo checks         | `oxlint.config.ts` (the `lib/**` seam rules and the adapter allow-list), `oxfmt.config.ts`, `scripts/check-seams.ts` (`bun run seams`) and `scripts/check-palette.ts` (`bun run palette`), both inside `bun run lint`                                                                                                                      |
| Implementation plans                            | `docs/plans/` (index: `docs/plans/README.md`)                                                                                                                                                                                                                                                                                              |
| Project skills                                  | `.agents/skills/implement-plan`, `curate-data`, `preview-app`                                                                                                                                                                                                                                                                              |
| Web-session setup (Bun version, deps)           | `.claude/hooks/session-start.sh`, registered in `.claude/settings.json`                                                                                                                                                                                                                                                                    |

## The documents

`AGENTS.md` is the index. It carries the product goal, the principles, the map
of the code and the one-line version of every convention; the reasoning behind
a rule lives in the document it links to. Read the section before changing what
it governs.

| Document                                           | Read it when you want to know                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`docs/data-pipeline.md`](docs/data-pipeline.md)   | where a number comes from: the sources, what each command asks and writes, the states |
| [`docs/data-model.md`](docs/data-model.md)         | what a field means, how the schemas are used, what the route quality gate checks      |
| [`docs/scales.md`](docs/scales.md)                 | the 1–5 scales, the status ladder and its thresholds, the reach bands                 |
| [`docs/ui-conventions.md`](docs/ui-conventions.md) | how the interface is built: components, layout, sidebar, detail panel                 |
| [`docs/map-rendering.md`](docs/map-rendering.md)   | the camera, the layer stack, hit testing, colours, the basemap                        |
| [`docs/architecture.md`](docs/architecture.md)     | what the page ships, how it is cached, the one dynamic route, the toolchain           |
| [`docs/plans/README.md`](docs/plans/README.md)     | what to build next, in which order, and what is already done                          |
| [`docs/roadmap.md`](docs/roadmap.md)               | what lies beyond the plans                                                            |
| [`docs/handover.md`](docs/handover.md)             | how the app came out of the HTML prototype (history, not current state)               |
| [`README.md`](README.md)                           | quick start, the commands, the environment variables, deployment                      |
| [`.agents/skills/`](.agents/skills/)               | the procedures: `implement-plan`, `curate-data`, `preview-app`                        |

`CLAUDE.md` is a symlink to this file; there is no second copy to keep in sync.

## Conventions

The rule in one line here, the reasoning behind the link. None of them is a
style preference: each records a bug that was paid for once already.

### [UI conventions](docs/ui-conventions.md)

The component layer, the layout, the sidebar, the detail panel.

- **shadcn/ui, style "mira" (`base-mira`).** `components/ui/` is generated from
  the preset; never hand-edit it, and restore the domain tokens after
  `ui:init`.
  → [why](docs/ui-conventions.md#shadcnui-style-mira-base-mira)
- **Sizes come from the scale, not from pixels.** Tailwind steps only; the
  scale carries `text-2xs` for the dense map furniture.
  → [why](docs/ui-conventions.md#sizes-come-from-the-scale-not-from-pixels)
- **Touch targets follow the pointer, not the width.** 16 px on a coarse
  pointer, boxes grown to match – which is why the app has no `<select>` left.
  → [why](docs/ui-conventions.md#touch-targets-follow-the-pointer-not-the-width)
- **Charts come from the shadcn `chart` component (recharts under the hood).**
  recharts is the only heavy dependency, so the one chart that uses it is
  `next/dynamic`.
  → [why](docs/ui-conventions.md#charts-come-from-the-shadcn-chart-component-recharts-under-the-hood)
- **The map is the page, and the shell is over it.** The map fills the viewport
  at every width; what is not map is a translucent surface on top of it – a
  header carrying one sentence, a season bar carrying the band, two floating
  panels on desktop and two drawers on a phone. What the bars cover is measured
  and handed to MapLibre as padding. A drawer is an inset card, a detail opened
  from a row stacks on the list, and its content scrolls only once it is all
  the way up.
  → [why](docs/ui-conventions.md#the-map-is-the-page-and-the-shell-is-over-it)
- **One reducer, two adapters.** Everything the explorer decides is one
  `reduce` in `lib/app-state.ts`; selecting something is one case with every
  consequence, and the hash and the storage feed `load` and subscribe to the
  state instead of being written to by hand.
  → [why](docs/ui-conventions.md#one-reducer-two-adapters)
- **Dark mode follows the OS, nothing else.** `prefers-color-scheme` only – no
  toggle, no `next-themes`.
  → [why](docs/ui-conventions.md#dark-mode-follows-the-os-nothing-else)
- **A filter is a chip, and no chip lies.** Every filter is a chip carrying the
  count it would leave, counted disjunctively; no slider, no select, nothing
  applied on a button.
  → [why](docs/ui-conventions.md#a-filter-is-a-chip-and-no-chip-lies)
- **The panel scrolls with the lists, not above them.** The filter panel is the
  first thing inside the list's scroll container, not a growing block in the
  fixed header.
  → [why](docs/ui-conventions.md#the-panel-scrolls-with-the-lists-not-above-them)
- **One list at a time, chosen by a tab row.** The three kinds sit behind tabs
  in the fixed header; each list's map switch rides in its own toolbar.
  → [why](docs/ui-conventions.md#one-list-at-a-time-chosen-by-a-tab-row)
- **What the drawer derives from the drag stays on the drawer.** The preset
  computes `--translate-x`/`-y` and four `--stack-*` values (`-progress`,
  `-peek-offset`, `-scale`, `-shrink`) in inherited custom properties, so every drag frame restyled the whole list; `app/globals.css`
  registers them `inherits: false`. Check them after `ui:init`, and compare a
  stutter on the device, one change per build.
  → [why](docs/ui-conventions.md#what-the-drawer-derives-from-the-drag-stays-on-the-drawer)
- **A long list comes in blocks of ten.** Rows and blocks are
  `content-visibility` subtrees that are skipped while off screen (`RowList`),
  every row stays in the DOM – and nothing that changes with the drag may reach
  them.
  → [why](docs/ui-conventions.md#a-long-list-comes-in-blocks-of-ten)
- **A drag of the sheet may spend the frame on nothing else.** No content box
  resizing, no backdrop filter, no scrolling layer while the finger is down.
  → [why](docs/ui-conventions.md#a-drag-of-the-sheet-may-spend-the-frame-on-nothing-else)
- **A long list is one tab stop.** `useRoving` makes each list the composite
  widget the platform expects: one stop, arrows inside it.
  → [why](docs/ui-conventions.md#a-long-list-is-one-tab-stop)
- **The panel folds.** Every block is a `Section` with a `BlockId`; the folded
  ones are one `sessionStorage` entry, and a source or caveat goes behind the
  `info` popover.
  → [why](docs/ui-conventions.md#the-panel-folds)
- **Model in, markup out.** `detailModel` resolves the selected entity once and
  returns one value – sentences, reach, blocks, `DetailState`; the three kind
  modules take their half of it and one `PanelActions`, and every "what is near
  here" comes from `lib/reach.ts`.
  → [why](docs/ui-conventions.md#model-in-markup-out)
- **Photos are borrowed, not owned, and they are the panel's hero.** Commons
  metadata only, a plain `<img>` with a `srcset`, a precomputed blur
  placeholder, and the box reserved before the photo arrives – the whole
  carousel at the panel's head, with the title and the controls on it.
  → [why](docs/ui-conventions.md#photos-are-borrowed-not-owned-and-they-are-the-panels-hero)

### [Map rendering](docs/map-rendering.md)

The camera, the layer stack, hit testing, colours, the basemap.

- **The padding is never set on its own.** Padding moves the camera, so it
  travels inside a flight or eases in – and a flight owns it until `moveend`.
  Which of the two it is, is a transition in `camera` (`lib/map-camera.ts`),
  not a boolean over refs: the map turns what happens into events and hands
  the commands to `applyCamera`. What the padding is made of is one
  calculation, `shellGeometry` in `lib/shell-geometry.ts`, which the classes
  read as custom properties, and what the device does differently is one
  `MapEnvironment` prop rather than a `matchMedia` call inside the map.
  → [why](docs/map-rendering.md#the-padding-is-never-set-on-its-own)
- **The panel opens with the tap; the camera follows it.** The selection
  reaches the panel in the same frame as the map; the flight is the half that
  waits.
  → [why](docs/map-rendering.md#the-panel-opens-with-the-tap-the-camera-follows-it)
- **A selection is framed, not centred.** Fit the box of all of a pass's
  ascents (`passBounds`), not the marker.
  → [why](docs/map-rendering.md#a-selection-is-framed-not-centred)
- **A tour holds its ascents; it does not sit beside them.** A hatched,
  translucent band laid under the ascents and wide enough to hold them.
  → [why](docs/map-rendering.md#a-tour-holds-its-ascents-it-does-not-sit-beside-them)
- **Translucent lines need `line-layer-opacity`, not `line-opacity`.**
  `line-opacity` composites every hairpin overlap twice; the layer property is
  data-constant, so per-feature differences go into width or colour.
  → [why](docs/map-rendering.md#translucent-lines-need-line-layer-opacity-not-line-opacity)
- **The overview draws by fame, the list draws everything.** The pass dots
  and their hit layer thin out by fame below zoom 8.5 (`lib/prominence.ts`);
  what is selected, hovered or a favourite is always drawn, and the corner
  line says which level is showing. Not a filter: no chip, the list untouched.
  → [why](docs/map-rendering.md#the-overview-draws-by-fame-the-list-draws-everything)
- **What answers the pointer is not what is drawn.** A transparent `*-hit`
  layer per kind, one `queryRenderedFeatures`, and `pick` over `HIT_GROUPS` –
  not the style – decides who wins; every layer id comes from `LAYERS`.
  → [why](docs/map-rendering.md#what-answers-the-pointer-is-not-what-is-drawn)
- **What the map draws is a value.** `buildScene` turns the rows, the
  switches, the selection and the hover into one `Scene`; `applyScene` hands
  MapLibre the difference to the last one and is the only place `setFilter`,
  `setFeatureState` and `setData` appear.
  → [why](docs/map-rendering.md#what-the-map-draws-is-a-value)
- **Colours only via tokens.** MapLibre cannot read CSS variables; new map
  colours go into `readColors`. What is painted before there is a document –
  the basemap style, the icons, the share image – reads `TOKENS`
  (`lib/palette.ts`), the one sRGB mirror of `app/globals.css`, which
  `bun run palette` holds against the stylesheet.
  → [why](docs/map-rendering.md#colours-only-via-tokens)
- **The basemap is generated, and it follows the OS scheme.** A vector style
  painted from the app's own palette on OpenFreeMap tiles; switching base or
  scheme swaps layers instead of rebuilding the map.
  → [why](docs/map-rendering.md#the-basemap-is-generated-and-it-follows-the-os-scheme)
- **MapLibre needs two workarounds.** `setWorkerUrl` for the copied worker, and
  `lab()` colours converted through a canvas pixel.
  → [why](docs/map-rendering.md#maplibre-needs-two-workarounds)

### [Architecture and toolchain](docs/architecture.md)

What the page ships, how it is cached, the one dynamic route, the tools.

- **Decisions are values; effects apply them.** Four pure modules behind four
  adapters: nothing under `lib/` reads the browser or drives MapLibre except
  the named adapters, and every effect in `components/` hands on a value the
  core produced. Enforced by `no-restricted-globals` per path in
  `oxlint.config.ts` and by `scripts/check-seams.ts`, both inside
  `bun run lint`.
  → [why](docs/architecture.md#functional-core-imperative-shell)
- **Route geometry never travels as props.** Content-hashed GeoJSON in
  `public/map`; visibility is a layer filter, status and selection are feature
  state.
  → [why](docs/architecture.md#route-geometry-never-travels-as-props)
- **Neither does what only one entity's panel reads.** One content-hashed JSON
  per entity in `public/detail`; what the sidebar reads on every keystroke
  stays a prop.
  → [why](docs/architecture.md#neither-does-what-only-one-entitys-panel-reads)
- **Cache Components.** `"use cache"` on `app/page.tsx` and nowhere else on the
  page's path: `lib/data.ts` is synchronous, and the page's entry covers what
  it derives. `cookies()`, `headers()` and `searchParams` belong in a dynamic
  child.
  → [why](docs/architecture.md#cache-components)
- **React Compiler is on.** No manual `useMemo`/`useCallback`; every React
  Compiler rule is an oxlint error.
  → [why](docs/architecture.md#react-compiler-is-on)
- **Site metadata is generated, never committed as a binary.** Icons, share
  image, manifest, `robots.txt` and `sitemap.xml` are metadata routes fed by
  `lib/brand.ts`.
  → [why](docs/architecture.md#site-metadata-is-generated-never-committed-as-a-binary)
- **The one dynamic route lives inside a free tier, and the numbers are in the
  file.** `/api/weather/[slug]`: an hour-long window, `s-maxage` so the CDN
  serves the repeats, and a cooldown inside the cached function.
  → [why](docs/architecture.md#the-one-dynamic-route-lives-inside-a-free-tier-and-the-numbers-are-in-the-file)
- **TypeScript 7, one compiler under its own name.** `typescript` is 7 and the
  only TypeScript here; `typecheck` and `next build` share it. Never drop it –
  the build installs its own and rewrites `package.json`.
  → [why](docs/architecture.md#typescript-7-one-compiler-under-its-own-name)
- **Bun is pinned by `engines`, and the web container is dragged up to it.**
  The floor is load-bearing; `.claude/hooks/session-start.sh` upgrades the
  remote container to it.
  → [why](docs/architecture.md#bun-is-pinned-by-engines-and-the-web-container-is-dragged-up-to-it)
- **oxlint and oxfmt, no ESLint.** `bun run lint` is `ultracite check`, the
  type-aware rules included (`oxlint-tsgolint`); the configs only ever deviate
  from the preset, with the reason next to each deviation.
  → [why](docs/architecture.md#oxlint-and-oxfmt-no-eslint)

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
