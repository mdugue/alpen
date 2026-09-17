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
   changed threshold offline, without spending API calls.
5. **Destination first.** Judge a feature by whether it helps choose where
   and when to go. Overview beats precision: a season strip for 92 passes is
   worth more than a metre-exact profile for one. Route-level detail ranks
   last (see `docs/plans/README.md`).

## Where things live

| Topic                                           | File                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rideability heuristic                           | `lib/status.ts` (`passVerdict`, the reason ladder `REASON_ORDER`, `Grade`); the 24 half-months of one pass or tour in `passYear`/`tourYear`, computed once by `getYears` (`lib/data.ts`); thresholds in `SIGNALS` (`docs/scales.md`); the sentences in `badgeWord`, `valleyText`, `tourText`, `ladderText` |
| Daylight (sunrise, sunset, day length)          | `lib/daylight.ts`, pure astronomy, no data                                                                                                                                                                                                                                                                 |
| Data schemas (zod) and inferred types           | `lib/schema.ts`, `lib/types.ts`, `data/schema/*.schema.json` (`bun run data:schema`)                                                                                                                                                                                                                       |
| Regions and countries (vocabulary)              | `lib/regions.ts`                                                                                                                                                                                                                                                                                           |
| Data access (cached, validated)                 | `lib/data.ts`                                                                                                                                                                                                                                                                                              |
| Profile sampling and derived gradients          | `lib/profile.ts`                                                                                                                                                                                                                                                                                           |
| Filter, selection and URL state (hash keys)     | `lib/app-state.ts`, `components/explorer.tsx`                                                                                                                                                                                                                                                              |
| Road types and labels (vocabulary)              | `lib/regions.ts` (`ROAD_TYPES`, `ROAD_TAGS`, `isTraverse`, `hasRoadSummit`)                                                                                                                                                                                                                                |
| Tag labels: vocabulary, icons, badges           | `lib/regions.ts` (`TOWN_TAGS`, `ROAD_TAGS`, `TAG_LABEL`), `lib/tag-icons.ts`, `components/tags.tsx`                                                                                                                                                                                                        |
| Search normalisation and haystacks              | `lib/search.ts`                                                                                                                                                                                                                                                                                            |
| Map, layers, 3D, markers, labels, feature state | `components/map/pass-map.tsx`                                                                                                                                                                                                                                                                              |
| Camera padding for the panels in front of it    | `lib/map-camera.ts`, the padding and fly-to effects in `components/map/pass-map.tsx`                                                                                                                                                                                                                       |
| Basemap: vector style, palette, glyphs          | `lib/basemap.ts`, `lib/palette.ts`, `scripts/build-map-style.ts` (→ `public/map/style-*.json`), `scripts/build-glyphs.ts` (→ `public/map/fonts`, committed)                                                                                                                                                |
| Map assets: GeoJSON, simplification, hashing    | `lib/map-assets.ts`, `scripts/build-map-assets.ts` (→ `public/map`, git-ignored)                                                                                                                                                                                                                           |
| Detail assets: one file per entity, hashing     | `lib/detail-assets.ts`, `scripts/build-detail-assets.ts` (→ `public/detail`, git-ignored)                                                                                                                                                                                                                  |
| Weather route, Open-Meteo quota and cooldown    | `app/api/weather/[slug]/route.ts`                                                                                                                                                                                                                                                                          |
| Tours within reach, town reach hull             | `lib/nearby.ts`, `lib/geo.ts` (computed on the server in `lib/data.ts`)                                                                                                                                                                                                                                    |
| Reach bands, the nearness weight                | `lib/geo.ts` (`REACH_BANDS`, `reachWeight`, `REACH_MAX_KM`); calibrated in `docs/scales.md`                                                                                                                                                                                                                |
| Destination verdict, ranked reach, the inverse  | `lib/destination.ts` (`destinationAt`, `basesFor`, `gradeOf`), `components/panel/destination.tsx`, `scripts/analyze-destinations.ts`                                                                                                                                                                       |
| Hover shared by list, map and panel             | `hovered` in `components/explorer.tsx`; the ring and line state in `components/map/pass-map.tsx`                                                                                                                                                                                                           |
| One tab stop per list; sharing the hash         | `lib/use-roving.ts`, `lib/use-share.ts`                                                                                                                                                                                                                                                                    |
| Photos: keys, sizes, licence metadata           | `lib/photos.ts`, `scripts/build-photos.ts` (`bun run data:photos`) → `data/generated/photos.json`                                                                                                                                                                                                          |
| Period scrubber floating over the map           | `components/map/period-scrubber.tsx`                                                                                                                                                                                                                                                                       |
| Season strip (24 half-months)                   | `components/season-strip.tsx`                                                                                                                                                                                                                                                                              |
| Filter controls, chips, applied-filter row      | `components/sidebar/filter-panel.tsx`, `components/sidebar/filter-chip.tsx`, `lib/filter-summary.ts`                                                                                                                                                                                                       |
| Sidebar: search, filters, one list per kind     | `components/sidebar/` (tabs: `kind-tabs.tsx`), `lib/rows.ts`                                                                                                                                                                                                                                               |
| Detail panel incl. profile/weather/climate      | `components/panel/` (collapsible blocks: `components/panel/section.tsx`)                                                                                                                                                                                                                                   |
| Drawers on phones (list and detail, separate)   | `components/mobile-sheet.tsx`, `components/map/map-search.tsx`                                                                                                                                                                                                                                             |
| Precomputation, data checks                     | `scripts/build-data.ts`, `scripts/build-photos.ts`, `scripts/check-data.ts`                                                                                                                                                                                                                                |
| Route quality gate: checks and thresholds       | `scripts/lib/validate.ts`; pass-point placement `scripts/locate-pass.ts` (`bun run data:locate`), `scripts/lib/locate.ts`                                                                                                                                                                                  |
| Name, claim, colours, mark, base URL            | `lib/brand.ts`, `lib/mark.tsx`                                                                                                                                                                                                                                                                             |
| Icons, share image, manifest, robots, sitemap   | `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`, `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts`                                                                                                                                                                                      |
| Legal pages                                     | `app/impressum/`, `app/datenschutz/`                                                                                                                                                                                                                                                                       |
| Linting and formatting                          | `oxlint.config.ts`, `oxfmt.config.ts`                                                                                                                                                                                                                                                                      |
| Implementation plans                            | `docs/plans/` (index: `docs/plans/README.md`)                                                                                                                                                                                                                                                              |
| Project skills                                  | `.agents/skills/implement-plan`, `curate-data`, `preview-app`                                                                                                                                                                                                                                              |
| Web-session setup (Bun version, deps)           | `.claude/hooks/session-start.sh`, registered in `.claude/settings.json`                                                                                                                                                                                                                                    |

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
  `--town`, the strip's `--grade-*` ramp, plus their `@theme inline` lines), the `--text-2xs` step below
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
  – and `TOUCH_CONTROL` and `TOUCH_ICON` in `lib/utils.ts` grow the boxes to
  match, on the same `pointer-coarse` condition (`TOUCH_SELECT` did the same
  for a native select and is unused, see below). With a mouse everything stays
  as dense as it was. The rule cuts both ways: a control that is _not_ a text
  field gains nothing from the 16 px and loses the row's scale, which is why
  the app has no `<select>` left – the sort picker is a `DropdownMenu` and the
  filters are chips, both ordinary markup the rule never touches.
- **A filter is a chip, and no chip lies.** Every filter in the sidebar is the
  same shape: a small pressable word, outlined while it is off and filled with
  the primary colour while it is on (`FilterChip`). There is no slider and no
  select among them. A slider is for a value where the exact number matters
  and the scale is wide; a 1–5 editorial judgement and four round height
  thresholds are neither, and on a phone its thumb is the one control that is
  regularly missed – small, indistinguishable against the filled track at
  either end, and it swallows the sheet's swipe. A chip is a target with a
  label that says what it does before it is pressed.
  Three rules keep the panel out of states that answer nothing. A "which of
  these" set (status, road type) is stored as what stays visible, and the whole
  vocabulary means _no filter_, so nothing reads as pressed then; `toggleMember`
  turns the last one out back into the whole set, so "none selected" – an empty
  list by construction – cannot be reached. A threshold group (`ThresholdChips`)
  holds at most one pressed chip and pressing it again lifts the filter, and its
  "egal" value is the first option of the list and deliberately has no chip of
  its own. The difficulty is five cells that always span one window
  (`toggleLevel`), which is a range without a second thumb to aim at.
  A threshold on one of the 1–5 scales carries the same five-bar mark the list
  rows draw (`Rating`, `mark` on `ThresholdChips`), so the filter and the thing
  it filters show one picture instead of a word here and a glyph there. The
  word stays in front of it, because the mark alone carries "at least"
  implicitly and `maxTraffic` is an upper bound – a bare rating row would read
  as the opposite of what it does there. Inside a pressed chip the mark takes
  `tone="current"`: the surface _is_ the primary colour, so a primary bar
  disappears exactly where the filter is active.
  Every chip carries how many roads it would leave (`facetCount` in
  `lib/rows.ts`, handed down as `countWith`), and that number is counted
  **disjunctively**: with all other groups' filters applied but its own group's
  filter lifted. Counted the other way – with the group's current choice still
  in force – every unpressed chip in a group reads 0 although each is one tap
  away. The disjunctive rule buys a second thing: a group's numbers do not
  depend on that group's own state, so they hold still while a thumb works that
  group and only move when another group changes. A chip that would leave none
  is disabled rather than hidden, because hiding it raises the question of where
  it went and the 0 is the answer; a pressed chip is never disabled, it has to
  stay liftable. The difficulty cells are the one exception to "what happens if
  I press this": a cell moves a window rather than replacing it, so its number
  is how many roads sit at that level. Counting has its own path rather than
  going through `buildPassRows`: a count needs neither the row objects nor the
  season strip hanging off them, and the panel asks it once per option on every
  keystroke. Since plan 15 the saving is allocation rather than arithmetic – both
  paths read the grades from the precomputed year – but it is still 201 rows
  built per option to produce one number. And when a combination does run empty, the count line names
  the single filter that would bring the most back rather than saying nothing.
  What is filtered away is written down outside the panel too: `AppliedFilters`
  turns `appliedFilters()` in `lib/filter-summary.ts` into one removable chip
  per decision, and the same list's length is the badge on the trigger, so the
  two can never disagree. Nothing is applied on a button – the count line at the
  end of the panel says what the current answer is, which is what makes live
  filtering answerable at all.
- **The panel scrolls with the lists, not above them.** The sidebar's header is
  a fixed row and holds only the search field, the trigger and the chip row; the
  panel body itself is the first thing inside the scroll container the lists
  live in. A growing panel inside a fixed row simply runs off the bottom of the
  phone's sheet with no way to reach its lower half, and two scroll containers
  stacked inside one drawer is the other half of the same bug. The four
  decisions a holiday planner makes first (status, difficulty, height,
  bookmarks) are always visible, the eight sharper ones wait behind "Weitere
  Filter", which opens by itself when a link carries one of them.
- **Dark mode follows the OS, nothing else.** There is no theme toggle and no
  `next-themes`; the dark tokens sit in a `prefers-color-scheme` media query
  and Tailwind's default `dark:` variant is used. Delete the
  `@custom-variant dark (&:is(.dark *))` line that `ui:init` writes.
- **Layout: the map is the page.** No header, toolbar or footer. On desktop
  the map fills the viewport and two translucent panels float over its left
  edge: the collapsible sidebar (`components/sidebar/`: search, filters, and
  one list per kind behind a tab row) and, while something is selected, the
  detail slide-over next to it. Their widths are mirrored in `explorer.tsx`
  (`SIDEBAR_W`, `DETAIL_W`) and fed to MapLibre as left padding so camera
  targets stay visible. Below `lg` there is **no** panel at rest: the map is
  the page on a phone too, so nothing covers it until something is asked for.
  What floats over its bottom-left corner is `MapSearch` – a button reading
  "Suche" (or the current query) with the three counts beside it and the filter
  badge after them, which is also the only thing on the first screen that says
  what the app holds. It is a **button** and is styled as one: a field there
  would bring the software keyboard up in the same moment as the drawer moves,
  and the two animations fight over where the field ends up – the field a thumb
  reaches is always in a drawer that already stands still. MapLibre's own
  corner controls are lifted above the bar by `--sheet-peek`, which needs
  `!important`: MapLibre's stylesheet is bundled after `globals.css` at equal
  specificity, so the rule had never applied.
  From there, **two** independent `MobileSheet`s (`components/mobile-sheet.tsx`,
  the Base UI `Drawer` with `modal={false}` and snap points), the list and the
  detail, each mounted only while it is open and each with its own snap state
  (`LIST_SNAPS`, `DETAIL_SNAPS` in `explorer.tsx`). The search bar opens the
  list; a tap on the map opens the detail over the bare map; a tap on a list
  row opens it over the list. Whichever is in front feeds MapLibre its height
  as bottom padding, and with neither open that is the floating bar's height
  (`FLOATING_BAR_PX`, kept in step with `--sheet-peek`).
  It was one sheet holding either content, after a stint as two sheets that
  were always both on screen. The always-on pair failed because a drawer that
  cannot leave has to rest somewhere, so the layout grew a peek row, a swipe
  handle over it and a trigger button inside the thing it triggers – a piece of
  the list permanently parked on the map before anything had been asked for,
  and a second handle behind it that did nothing. Collapsing them into one
  sheet removed the second handle but kept the peek, and made "back to the
  list" something the app had to reconstruct: a detail reached from the map had
  no list behind it, and one reached from a row had to keep the list mounted
  under a `hidden` so its scroll position, its tab and its search survived.
  Opening on demand settles both. The stack is simply the truth, the list keeps
  its state by never being unmounted while it is open, and nothing has to rest
  on screen, so there is no peek snap to measure.
  What leaving a detail means still depends on what is underneath, and the
  control says which: a labelled `‹ Liste` back button while the list drawer is
  open behind it (`backToList` on `DetailPanel`), the `✕` when the detail is
  alone over the map. A drawer sizes itself from `--drawer-snap-point-offset`:
  the popup is a full `100dvh` and padded off at the bottom by that offset, so
  its content box ends at the fold.
  What else floats over the map is one cluster in its top-left
  corner (`MAP_CLUSTER`, next to the panels' left edge): the period scrubber
  and, on the same panel surface, the three map tools – layers, 3D, fit. The
  tools are one segmented column in the same outline as the scrubber's own
  stepper, stretched to its height, so they read as pressable and the cluster
  keeps an even edge; `MAP_TOOL` settles the outline, because `Button` and
  `Toggle` disagree about hover, border token and dark fill. The scrubber
  reaches the map through the `scrubber` prop rather than `children`, which is
  what stays free-floating beside the cluster – today the sidebar's own toggle.
  On a phone the cluster is nearly as wide as the screen, so it is padding
  there like the sheet below it (`MAP_CLUSTER_PX`, keep it in step with what
  the cluster actually measures).
  The scrubber carries the
  24 half-months, the histogram of what is rideable and the "heute" marker,
  and every list row repeats the same 24 cells as a `SeasonStrip`. Map
  visibility is always a `Switch` ("auf der Karte"), one per kind, two-state
  buttons are always a `Toggle`. Without a camera or a selection in the hash
  the map opens on the frame the fit button produces, not on a fixed overview.
- **The padding is never set on its own.** What the panels cover reaches
  MapLibre as camera padding, and padding is not a passive margin: the centre
  is drawn in the middle of the _padded_ box, so `setPadding` – a `jumpTo` –
  moves the picture by half of what changed. On a phone that is the detail
  sheet's 55 % of the screen in one frame, a jump at the start of every
  selection. So a selection carries the new padding into its own flight (one
  movement instead of a jump and a movement, which is also why a pass or a tour
  is framed with `cameraForBounds` + `flyTo` rather than `fitBounds`: that one
  drops the padding before it flies, and the frame has to be measured against
  where the camera lands – `fitInset` in `lib/map-camera.ts`), and a padding
  change with no camera move behind it – a sheet dragged to another snap point,
  the sidebar folding away – eases in. Only the first padding is set outright,
  before the map has drawn a frame that could jump.
  Which is also the rule while a flight is in the air: it owns the padding
  until it lands. The panels can ask for another one meanwhile – a sheet dragged
  to a different snap point, a phone's toolbar changing the viewport height by
  four pixels – and easing to it there would cut the flight short a frame before
  it arrived, so what is still owed is applied on `moveend` instead. The panel
  claims its share one commit _before_ the camera sets off, which is what keeps
  that opening still: a padding the map has not applied yet cannot move it.
- **The panel opens with the tap; the camera follows it.** Selecting answers a
  question about a pass, not about the map, so `DetailPanel` gets the selection
  in the same frame as the map's layers, the highlighted row and the hash
  (`selectionState` in `explorer.tsx`, two values: what is selected and what the
  leaving sheet keeps showing). The flight is the slower half: `pass-map.tsx`
  leaves the panel `SELECT_DELAY` to draw and then takes `SELECT_MS` – longer
  than the 500 ms it was, because nothing waits behind it any more – to get
  there.
  It ran the other way round first: the map flew and the panel opened on
  arrival. The reason was real – the panel is the most expensive thing the app
  draws (the photo slideshow, the elevation profiles with a polygon per sample,
  the climate chart with recharts behind it), and on a phone-sized viewport
  drawing it into a flight cost that flight about a third of its frame rate –
  but the cure put a wait in front of the answer to buy a smooth camera
  movement, which is the wrong way round. Opening first and moving after keeps
  the two out of each other's frames just as well, and what waits is now the
  half nobody asked for. Everything that is still on its way when the panel
  opens keeps its own height while it waits, so nothing below it ever jumps:
  the profile skeleton has the drawing's aspect ratio (`PROFILE_ASPECT`) and the
  chart's `next/dynamic` placeholder its height (`CHART_HEIGHT`, a module of its
  own so the placeholder does not import recharts). The selected row is put into
  view without a smooth scroll in the sheet layout: the detail drawer is usually
  in front of the list when it happens, so it would animate a list nobody can
  see against the drawer animation that can be seen.
- **A selection is framed, not centred.** What makes a pass worth a holiday is
  the road up to it, and both sides of a traverse are what "over the Galibier"
  means, so selecting one fits the box of all its ascents (`passBounds`,
  precomputed next to `tourBounds` in `lib/map-assets.ts`) instead of centring
  on the marker – `PASS_MAX_ZOOM` keeps a short climb from filling the screen
  with two hairpins, and a pass the map draws no ascent for falls back to its
  point. On a phone that box has to fit between the detail sheet, which takes
  55 % of the screen, and the control cluster at the top, which takes a quarter
  of what is left: `MAP_CLUSTER_PX` is the map's top padding there (and only
  there – on a 900 px desktop map the cluster sits in a corner and reserving a
  tenth of the height would buy nothing).
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
  browser through a plain `<img>`, never `next/image`; they are already
  rendered and already cached, mirroring them would put ~25 MB of binaries
  into the repo, and the optimiser would add a hop, a `remotePatterns` entry
  and a bill for the same bytes. What it would have brought is had without
  it. Wikimedia renders a fixed ladder of widths and answers a direct request
  for anything else with a 400, so `thumbUrl` composes the smaller rungs of
  that ladder and the slide carries a `srcset` off it (`photoSrcSet`,
  `PHOTO_SIZES`): a 1× panel fetches 500 px where it used to fetch 960. And
  the one thing that cannot be fetched in time is precomputed – `Photo.blur`
  is the same photo `BLUR_WIDTH` px wide as a data URI, laid under the photo
  in a layer of its own, so a slide opens on its own colours instead of an
  empty box. That layer is blurred and scaled up rather than left to the
  browser's upscaling, which at twenty times the width is visibly blocky; it
  is a layer because `filter` reaches an element's children, and it is scaled
  because a blur samples past the edges. It travels inside the entity's detail
  file, because a placeholder that needs a request of its own loses the race
  it exists to win; generating one on demand and caching it would lose the
  same race for every first visitor to a pass. No image library is involved
  either way: Wikimedia renders the 40 px version, `scripts/lib/blur.ts`
  strips the metadata it inherits – a wide-gamut photo's ICC profile is 30 KB
  around a 480-byte picture, and re-encoding does not drop it – and
  `Bun.Image` turns what is left into ~475 bytes of WebP. A hash (BlurHash,
  ThumbHash) would be twenty times smaller and lower fidelity than that, and
  would want a decoder and a canvas paint in the frame the panel is trying to
  keep smooth; the thumbnail is already rendered, so there is nothing to
  approximate.
  **And the box is there before the photo is.** The panel opens before its
  detail file arrives, so `DetailAsset` carries the photo count next to the
  URL and `PhotoCarousel` reserves the slide while it waits – the block that
  used to appear late and push everything under it down. An entity with no
  photos reserves nothing. That is the same rule as the profile skeleton and
  the chart's placeholder, and the reason the panel is not a server component:
  a selection would then cost a server round trip where it now costs an
  immutable file from the CDN, and the jump was never about where the markup
  came from. Attribution is not decoration: every slide carries author
  and licence, baked into the slide rather than derived from the carousel's
  index, so it cannot drift out of sync with what is on screen.
- **One list at a time, chosen by a tab row.** The three kinds used to be
  collapsible blocks stacked inside one scroll container, which made the
  sidebar a single 12 841 px column against a 730 px viewport: the tours sat
  below all 201 roads and the towns below those. `KindTabs`
  (`components/sidebar/kind-tabs.tsx`) puts the choice in the fixed header and
  the scroll container holds one list.
  The tabs also solve what kept the old section headers from sticking. A
  pinned header needs an opaque background to stay legible over the rows
  scrolling under it, and a `backdrop-blur` cannot supply one – the panel
  already filters its backdrop, and a nested filter never sees the content
  inside that backdrop root. In the header row nothing scrolls underneath, so
  the counts simply stay on screen, and the count on a tab is the answer to
  the filter: narrowing to "ab 2.500 m" collapses the tours from 9 to 2 where
  it can be seen.
  Each kind's "auf der Karte" switch rides in that list's own toolbar
  (`ListToolbar`), never beside the tab row: a control next to three tabs
  reads as acting on all three, and a bare switch says what it does only once
  it has been flipped, so it carries the words too.
- **A long list is one tab stop.** Every row used to be two (the bookmark
  toggle and the row itself) – 562 focusable elements on the built page, so
  reaching the map meant holding Tab down for several hundred presses, and a
  screen reader's rotor held two hundred buttons all called "Merken".
  `useRoving` (`lib/use-roving.ts`) makes each list the composite widget the
  platform expects: one stop, arrows inside it, Home/End/PageUp/PageDown, and
  the tab stop stays on the row last focused. It works off the DOM rather than
  an index in state, because which rows exist changes on every keystroke in
  the search field. Every bookmark toggle is named after the thing it
  bookmarks, and `app/page.tsx` carries a skip link to the map.
- **The panel folds.** Every block below the title is a `Section`
  (`components/panel/section.tsx`), open by default. The panel is a column on a
  map and a phone sheet shows two blocks at a time; whoever wants the climate
  should not scroll past two elevation profiles first. Which blocks are folded
  is one `sessionStorage` entry shared by all of them (`SECTIONS_KEY`), keyed
  by section id and holding the _closed_ ones: a fold carries over to the next
  pass looked at, a new section opens by itself, and the next visit starts
  unfolded again. A section title says what the block is and nothing else;
  where a source or its caveat has to be named, one short sentence sits behind
  the `info` popover, opened by tap or click – a tooltip needs hover, which a
  phone cannot give it, and the detail panel is where a phone reaches this app
  most. A header never opens a dialog – the scales dialog belongs to the
  sidebar footer, which is where it stays.
- **A tour holds its ascents; it does not sit beside them.** A tour _is_ the
  union of several ascents – the Sellaronda is its four passes – so it is
  drawn as what it is: a band wide enough to hold them, laid _under_ the
  ascents so it reaches past them on both sides. What a tour contains is then
  read from the map rather than from the list, which a mark running alongside
  the ascents cannot say. The band is translucent, so the hillshade and the
  roads keep showing through something that covers this much ground, and
  hatched rather than solid, so it is told apart from an ascent by texture
  and not only by weight – the looser of the two marks, which is the right
  order, since the ascent is the rated thing and keeps the solid line and the
  opaque status colour. `DASH` counts in multiples of the line width, so on a
  band this wide the numbers have to be well below 1: widen the band and the
  dashes lengthen with it unless they come down to match, and long dashes on
  a wide line read as a chain of blocks rather than as a texture.
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
  function, the selection case goes inside the stops (`tourWidth`) – the same
  reason the pass hit radius is one `interpolate` with a `max` per stop
  rather than a `max` around one.
- **What answers the pointer is not what is drawn.** A pass dot is a few
  pixels across and an ascent line 3.5 wide, so every kind carries a
  transparent hit layer over its mark (`*-hit` in `appLayers`): a disc per
  point, a wide line per route, sized from the pointer – about 44 px on touch,
  half of that with a mouse – and never narrower than the mark plus a margin.
  A name is part of its mark: the label layers answer the pointer too. Because
  several layers answer for the same pixel, there is no handler per layer:
  `pickAt` runs one `queryRenderedFeatures` over all of them and decides
  which single entity a hover or a click means. `HIT_GROUPS` spells the
  priority out rather than taking it from the style, because the two disagree
  – marks before names before lines, and the tour band lies _under_ the
  ascents but reaches past them, so a click inside it hits both and the ascent
  is the more specific answer – and within a group the mark nearest the
  pointer wins. A hit layer needs the same filter as the layer it widens, or a
  hidden tour still answers. The hover popup is a label, not a target: it is
  suppressed on a coarse pointer and click-through everywhere
  (`app/globals.css`).

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
  the page the URLs plus one bounding box per tour and per pass – what a
  selection is framed into, and the one thing a camera cannot wait for a
  fetch to learn (10 KB for all 201 passes, four rounded numbers each);
  MapLibre fetches the files
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
- **Neither does what only one entity's panel reads.** The same rule, one
  layer up: `scripts/build-detail-assets.ts` writes one content-hashed JSON
  per pass, tour and town into `public/detail` (git-ignored, cached immutably)
  holding that entity's elevation profiles and its Commons photo metadata,
  `lib/data.ts` derives the same names with `lib/detail-assets.ts` and hands
  the page one URL per entity, and `DetailPanel` fetches the one that is
  selected. Measured per prop on the prerendered page, those two were 297 KB
  and 77 KB gzipped of 468 KB; the page now carries 147 KB and a selection
  costs about 2 KB. A block that waits for the file says so, and reserves the
  box it will fill – `PhotoCarousel` shows a slide-shaped skeleton for as many
  photos as `DetailAsset.photos` promises and nothing at all where that is
  zero, the ascent list shows a
  `PROFILE_ASPECT`-shaped skeleton – because everything a list row already
  showed (name, status, season strip, ratings) is in the page and must not
  flicker. What the sidebar reads stays a prop, and that is the line: the
  climate series is 42 KB gzipped and `buildPassRows`/`facetCount` read it on
  every keystroke, so a late arrival would mean a filter counting wrong for a
  moment (see "A filter is a chip, and no chip lies").
- **The basemap is generated, and it follows the OS scheme.** The default
  base is a vector style painted from the app's own palette (`lib/basemap.ts`,
  colours in `lib/palette.ts`), tiles from OpenFreeMap, no key. Layer stack,
  bottom to top: the basemap's fills (land, built-up, wood, glacier, water),
  the hillshade from the Terrarium DEM, the basemap's lines and labels
  (rivers, borders, roads from zoom 6 to minor roads at 11, road names at 12,
  lakes, peaks with elevation at 10, places), the raster overlays, then the
  app's own layers (the hovered town's reach, the tour bands, the ascents on
  top of them, towns, passes, labels, profile cursor). MapLibre places labels from the top of the style
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
- **Bun is pinned by `engines`, and the web container is dragged up to it.**
  `engines.bun` in `package.json` is the floor, and it is not decoration: on
  Bun 1.3 `bun run build` dies in Next's TypeScript step, and `bun run e2e`
  and the `preview-app` skill cannot start at all, because both drive Chrome
  through `Bun.WebView` (Bun 1.4+). Claude Code on the web ships whatever Bun
  its image was built with, so `.claude/hooks/session-start.sh` runs at session
  start, upgrades Bun when it is below that floor and installs the
  dependencies with `--frozen-lockfile` – an older Bun rewrites `bun.lock` to
  the previous format on the first install. The hook only runs in the remote
  container (`CLAUDE_CODE_REMOTE`); a local machine manages its own toolchain.
  Raise the floor in `package.json` and the hook follows.
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
- **The one dynamic route lives inside a free tier, and the numbers are in
  the file.** `app/api/weather/[slug]` is the only thing a visitor can spend
  somebody's quota on. Open-Meteo's non-commercial allowance is 10 000 calls
  a day, so the worst case has to be computed rather than hoped for: one
  cached call per pass per window, 201 passes, which is why the window is an
  hour (≈ 4 800/day) and not the half hour it was (≈ 9 600/day). Three rules
  follow. A window that gets shorter has to be checked against that product
  again. A successful answer carries `s-maxage`, so the repeats inside a
  window are served by the CDN and not by the function. And a failure is never
  left to each visitor to retry: a thrown forecast is not cached, so a rate
  limit or an outage would arrive undamped, and a module-level cooldown bounds
  what one warm instance will ask. That cooldown sits _inside_ the cached
  function, where a cache hit never reaches it – one failing pass must not
  blank the weather of the other 200 – and it is armed at the failed fetch
  rather than in the handler, or it would re-arm on its own rejection and
  never end. It cannot be helped along at the edge: Vercel's CDN stores only
  200, 404, 410 and the redirects, so a `Cache-Control` on a 502 is inert, and
  dressing a failure as a 200 to make it cacheable is not worth the lie. The
  404 for an unknown slug _is_ cacheable and says so. The same arithmetic is why the app is
  non-commercial in both senses: ads or affiliate links would break Vercel's
  Hobby terms and Open-Meteo's free tier in the same move. Donations would
  not.
- **oxlint and oxfmt, no ESLint.** `bun run lint` is `ultracite check`
  (oxlint plus an oxfmt format check), `bun run lint:fix` writes the fixes.
  oxlint's `nextjs` and `react` plugins cover everything `eslint-config-next`
  did, React Compiler rules included, so ESLint and `eslint-config-next` are
  gone. The two config files only ever _deviate_ from the ultracite preset,
  and every deviation carries the reason next to it – keep it that way rather
  than silencing a rule at the call site.
- **`@shadcn/lint` checks the design system itself.** It runs as an oxlint JS
  plugin (`jsPlugins` in `oxlint.config.ts`), reads `components.json` and
  `app/globals.css`, and turns three of the conventions above from prose into
  errors: colours only via tokens (`no-raw-colors`), sizes from the scale
  (`no-arbitrary-values`), and no restyling a component from its call site
  (`no-restyle`); `no-inline-styles` and `no-unknown-classes` come along with
  them. Because `components/ui/` is generated and never hand-edited, the
  remedy those rules normally suggest – add a variant there – is closed off,
  so `no-restyle` hands spacing and typography to the app (this is dense map
  furniture; the preset's comfortable defaults are the wrong size) and keeps
  colour and shape with the design system. Every exception to that is a
  `contract` in `oxlint.config.ts` naming the one decision behind it. A new
  radius on a `Card` or an ad-hoc tint on a `Popover` is an error; add a
  reasoned contract rather than a class.
  `require-static-classes` is off: it resolves a constant declared in the same
  file but not one imported from another, and the shared class constants in
  `lib/utils.ts` are the latter by design.

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
