# 34 · Beyond the Alps: every climb a rider travels for

**Status:** in progress – the plan, decided on 2026-10-21 ·
**Effort:** M for code, XL for curation (one range at a time) ·
**Depends on:** 25 (the range mechanism), 26 (bounds per range, the opening
frame), 14 (road types) · **Unblocks:** the weekend answer for the whole
German-speaking audience, the winter answer (Mallorca, the Canaries)

## Goal

The app stops being an alpine map with three guests and becomes a map of the
climbs road cyclists travel for in Europe: the Alps and the Pyrenees, the
low ranges an hour from home (the Erzgebirge, the Black Forest, the Harz),
and the islands that answer March and November. The core does not change –
a road, its ascents, its 24 half-months, the bases around it – but four
things do: the name, the rule that decides what comes in, one road type,
and the way the range chips are read once there are twenty of them.

## Why now

- Manuel decided it (thread "Erweiterung über die Alpen hinaus",
  2026-10-21): "Statt nur Alpenpässe sollten sämtliche passähnliche Straßen
  auch in anderen Gegenden berücksichtigt werden. Zum Beispiel Erzgebirge."
  Plan 25 kept the Erzgebirge as the deliberate "not yet"; this plan is the
  "now".
- The mechanism carries it. `RANGES`, `RANGE_REGIONS`, `RANGE_BOUNDS`,
  `HOME_RANGE`, the range chip that frames, the per-range frame test and the
  bounds guard all exist (plans 25 and 26). A new range is a vocabulary edit
  and its data.
- The weather quota no longer caps the road count: PR #80 caches each
  forecast point for six hours, which makes room for about 2 500 points,
  roughly 1 000 roads (`lib/weather-places.ts`).

## Decisions (2026-10-21)

1. **The name is "Bergauf"**, the claim "Die Anstiege Europas – wann und wo
   sie sich lohnen." "Alpenpässe" is a lie with the Erzgebirge in it, and
   "Pass" alone is one too: most climbs in a low range do not end on a
   saddle. The domain stays `alpen.manuel.fyi` until a new one is registered;
   `siteUrl` reads it from the environment, so the switch is a Vercel setting
   and a redirect, not a code change.
2. **The inclusion rule** replaces the one in plan 25. A road comes in when
   one of its ascents gains at least 250 m at about 5 % on average, or when a
   race made it known (Tour, Giro, Vuelta, Deutschland Tour, a classic). A
   range comes in once it holds eight such roads and one base town with
   beds. The climb decides, not the size of the range.
   One exception, measured on 2026-10-21: the Harz holds five roads that
   meet the rule (Brocken, Torfhaus, Hexentanzplatz, Rosstrappe,
   Ravensberg; everything else stays under 4 %), and no neighbour lies close
   enough to share a range with. It comes in with five, because it is the
   only climbing within a weekend of Berlin, Hamburg and Hanover – a range
   with fewer roads is named here, not filled up with roads the rule leaves
   out.
3. **The order** is by what each range adds to the app's two questions:
   - Stage 1: Erzgebirge (the pilot: a low range, a new country, climbs that
     are not passes), Black Forest, Mallorca (March and November).
   - Stage 2: Massif Central with the Cévennes, Harz, Thuringian Forest with
     the Rhön, Bavarian Forest with the Bohemian Forest, Swabian Jura,
     Corsica.
   - Stage 3: the Canaries, northern Spain (Asturias, Cantabria), the Sierra
     Nevada, the Apennines with Etna, the Ardennes with the Eifel and the
     Sauerland, the Giant Mountains, the Tatras.
   - Already running elsewhere (PR #80): the Jura and the Pyrenees.
   - Out: the Flemish hellingen – short cobbled walls with no season
     question, nothing the app could add to them.
4. **One new road type, `climb` ("Steige")**: a through road that climbs
   onto a plateau or a ridge and carries on up there. Its top is neither a
   saddle (`pass`) nor a dead end (`spur`). Today such a road has to be
   filed as a `pass` with `roadSummit` or as a `plateau`, and both measure it
   wrongly. It is measured like a `pass`: the ascents end at the marker.
5. **Two new road tags**, editorial like the others: `race` (a grand tour
   or a classic rode over it) and `forest` (mostly in the woods: shade in
   July, no view).
6. **Fame stays absolute across Europe.** A Fichtelberg is a 2 or a 3, not a 5. The "Klassiker" level of the map (thread "Kartenübersicht bei vielen
   Pässen") then still shows Galibier and Tourmalet; a range without a
   classic shows its best-known roads there, and its chip frames it at a zoom
   where every road is drawn anyway.
7. **A range says how it is travelled**: a weekend or a holiday
   (`RANGE_TRIP`). It is a property of the range, not a filter: it orders the
   range chips into two rows so that twenty chips stay readable.

## Non-goals

- Splitting `data/passes.json` per range (plan 24 says "past 300 entries").
  PR #80 is appending to the same file region by region, and a split now
  would turn both branches into one long conflict. It is the first thing to
  do once both are merged.
- A new opening frame. The map keeps opening on the Alps (`HOME_RANGE`); a
  rider from Dresden reaches the Erzgebirge through its chip, the search or
  a shared link. Opening on the range nearest the visitor needs a position
  or a header and is a dynamic-route question (`docs/architecture.md`).
- Changing the domain. That is Manuel's call in Vercel.
- Mountain biking, the Flemish hellingen, Scandinavia, the Balkans.

## Design

### Vocabulary (`lib/regions.ts`)

Every new range is a key in `RANGES`, a list of regions in `RANGE_REGIONS`,
a box in `RANGE_BOUNDS` and a trip in `RANGE_TRIP`. Where two small ranges
lie next to each other and neither reaches eight roads alone, they share one
range with a region each – the way the Alps hold four – so the chip still
frames one readable area: "Thüringer Wald" holds the Rhön, "Ardennen" holds
the Eifel and the Sauerland. Ranges that lie far apart stay apart, because
the frame test (`lib/default-frame.test.ts`) requires every range to frame at
zoom 5.65 or closer.

New countries: `CZ` (Erzgebirge, Riesengebirge, Bohemian Forest), `PL`
(Giant Mountains, Tatras), `SK` (Tatras), `BE` and `LU` (Ardennes). Spain is
already there for Mallorca, the Canaries and the north.

A range enters `RANGES` in the commit that brings its first roads, not
before: the vocabulary never names a range the map cannot show.

### The road type `climb`

`ROAD_TYPES` gains `climb` between `spur` and `plateau`. It is not a
traverse (`isTraverse` stays false), so the gate measures it like a pass –
the ascent ends at the marker, `minPeakAt` applies. `hasRoadSummit` is true
for it by definition (every type but `pass` is), so `data:locate` offers the
highest point of the route. Words in `vocab.roadType`, both languages. The
map draws it like a pass; the "Klassiker" ladder of the map thread counts it
like a pass, not a step lower like a dead end.

### The tags `race` and `forest`

Two more keys in `ROAD_TAGS`, with icons in `lib/tag-icons.ts` and words in
`vocab.roadTag`. `race` is written only where the race is documented; the
portrait never invents race history.

### The range chips

`RANGE_TRIP` sorts the chips: the holiday ranges first, then the weekend
ones, each as its own row under one "Gebirge" group with a small label
("Urlaub", "Wochenende"). The filter, its count and its frame stay exactly
as plan 25 built them.

### Brand

`SITE_NAME` becomes "Bergauf". The claim, the description and the keywords
in `site` (`lib/i18n/messages.*.ts`) name the breadth instead of listing
ranges: a list of twenty ranges is no claim. The header, the legal pages and
the knowledge base say "Bergauf" where they said "Alpenpässe".

### Data, per range

Each range follows the `curate-data` skill: roads with ascents, portraits
and English, at least one base town, one destination area, one loop where a
classic loop exists. `data:locate` for every marker, `data:build` for the
routes, then `data:check`. Climate and profiles depend on the Open-Meteo
quota of the day; a range whose climate is missing still lands, and
`data:backfill` fills it later.

## Steps

1. Vocabulary: `climb`, `race`, `forest`, `RANGE_TRIP`, the chip rows, the
   brand. Code review.
2. Stage 1, one range per commit: Erzgebirge, Black Forest, Mallorca. Code
   review.
3. Stage 2, one range per commit. Code review.
4. Stage 3, one range per commit. Code review.
5. Documentation: `docs/roadmap.md` §2, plan 25's rule, `AGENTS.md`, the
   guide in `docs/guide/`.

## Acceptance criteria

- A road of type `climb` passes `data:check`, is measured as a climb by the
  gate, and shows "Steige" in the panel, the filter and the scales dialog.
- Every new range has eight roads or more, a base town, and frames at zoom
  5.65 or closer (`lib/default-frame.test.ts`).
- The range chips read in two rows, holidays first; pressing one frames its
  range and filters as before.
- The header, the share image and the manifest say "Bergauf".
- `bun run typecheck && bun run lint && bun run test && bun run build && bun run data:check`
  pass.

## Risks and open questions

- **Low-range thresholds.** The status heuristic was calibrated on alpine
  passes. Plan 25's Vosges read-back showed a winter that reads "Schnee" or
  "Höhe" and a best window from April or May; the Erzgebirge is 2–3 °C colder
  at the same height, Mallorca and the Canaries are hot in July. Each range's
  read-back goes into its commit message; a threshold change is discussed
  with the numbers, not assumed.
- **Climbs that are short.** A Swabian "Steige" gains 250–350 m. The gate's
  limits were set on alpine climbs; `data:check --explain` re-judges them
  offline if one fails for being short rather than wrong.
- **Twenty chips.** Two rows hold them on a desktop; on a phone the group
  wraps to five or six lines. If that is too much, the next step is a chip
  per trip ("Urlaub", "Wochenende") that unfolds its ranges.
- **The name.** "Bergauf" is a common word; the domain and the store names
  are not checked yet.
