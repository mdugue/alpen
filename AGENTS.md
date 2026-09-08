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
   `"use cache"` + `cacheLife`.
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

| Topic                                           | File                                                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Rideability heuristic                           | `lib/status.ts` (`passStatus`, `tourStatus`)                                                                          |
| Data schemas (zod) and inferred types           | `lib/schema.ts`, `lib/types.ts`, `data/schema/*.schema.json` (`bun run data:schema`)                                  |
| Regions and countries (vocabulary)              | `lib/regions.ts`                                                                                                      |
| Data access (cached, validated)                 | `lib/data.ts`                                                                                                         |
| Profile sampling and derived gradients          | `lib/profile.ts`                                                                                                      |
| Filter, selection and URL state (hash keys)     | `lib/app-state.ts`, `components/explorer.tsx`                                                                         |
| Search normalisation and haystacks              | `lib/search.ts`                                                                                                       |
| Map, layers, 3D, markers, labels, feature state | `components/map/pass-map.tsx`                                                                                         |
| Map assets: GeoJSON, simplification, hashing    | `lib/map-assets.ts`, `scripts/build-map-assets.ts` (→ `public/map`, git-ignored)                                      |
| Tours within reach of an entity                 | `lib/nearby.ts` (computed on the server in `lib/data.ts`)                                                             |
| Period scrubber floating over the map           | `components/map/period-scrubber.tsx`                                                                                  |
| Season strip (24 half-months)                   | `components/season-strip.tsx`                                                                                         |
| Sidebar: search, filters, one list per kind     | `components/sidebar/`, `lib/rows.ts`                                                                                  |
| Detail panel incl. profile/weather/climate      | `components/panel/`                                                                                                   |
| Precomputation, data checks                     | `scripts/build-data.ts`, `scripts/check-data.ts`                                                                      |
| Route quality gate: checks and thresholds       | `scripts/lib/validate.ts`                                                                                             |
| Name, claim, colours, mark, base URL            | `lib/brand.ts`, `lib/mark.tsx`                                                                                        |
| Icons, share image, manifest, robots, sitemap   | `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`, `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts` |
| Legal pages                                     | `app/impressum/`, `app/datenschutz/`                                                                                  |
| Linting and formatting                          | `oxlint.config.ts`, `oxfmt.config.ts`                                                                                 |
| Implementation plans                            | `docs/plans/` (index: `docs/plans/README.md`)                                                                         |
| Project skills                                  | `.agents/skills/implement-plan`, `curate-data`, `preview-app`                                                         |

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
  `--town` plus their `@theme inline` lines), the MapLibre rules at the end
  and the dark-mode setup must be restored afterwards.
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
  targets stay visible. Below `lg` the same sidebar body lives in a bottom
  `Drawer` with snap points and the detail stacks inside it. Only the period
  scrubber and three map tools float over the map; the scrubber carries the
  24 half-months, the histogram of what is rideable and the "heute" marker,
  and every list row repeats the same 24 cells as a `SeasonStrip`. Map
  visibility is always a `Switch` ("auf der Karte"), two-state buttons are
  always a `Toggle`.
- **Charts come from the shadcn `chart` component** (recharts under the hood).
  It is the only heavy dependency in the app, so the one chart that uses it
  (`components/panel/climate-chart.tsx`) is pulled in with `next/dynamic` and
  never reaches the first load. Stat tiles and dense rows use `Item`, stepper
  groups use `ButtonGroup`.
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
  `routes` and `tours` sources: which lines show is a layer filter, status and
  selection are feature state. Points (passes, towns) stay in-memory sources,
  because their symbol layers need real properties. Anything else the client
  used to read from the geometry is precomputed on the server: tours within
  reach of an entity (`lib/nearby.ts`) and the road coordinate of every
  profile sample (`ProfileWithCoords`).
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
