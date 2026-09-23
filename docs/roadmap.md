# Roadmap

What lies beyond the implementation plans in [`docs/plans/`](./plans/README.md).
The plans cover the next several months; this file keeps the longer list,
re-sorted for the product goal (destination finding, not route planning).

## 1. Official live closure status

Replaces the heuristic wherever real data is available; the climate-aware
heuristic (plan 04) stays as the fallback.

- Sources: South Tyrol (Open Data Hub, JSON, clean), Trentino (HTML),
  alpen-paesse.ch or TCS (HTML), Bison Futé and departmental sites (HTML),
  ÖAMTC/ASFINAG (JSON behind an app API). None of them allow direct access from
  the browser (no CORS).
- Implementation: a step in `scripts/build-data.ts` or a dedicated cron job
  that writes normalized data hourly to
  `data/generated/closures.json`: `{ [passSlug]: { state, since, source, url } }`.
  On Vercel as a Cron Function (`vercel.json` → `crons`) plus
  `revalidateTag("closures")`.
- A layer in front of `lib/status.ts`: if a current entry exists, it wins;
  otherwise the heuristic applies. Show the provenance in the detail panel.
- Effort: an afternoon for South Tyrol, one to two hours per additional source,
  ongoing maintenance because HTML pages change.

## 2. More regions, more depth, more surfaces

What was one line here is now five plans (September 2026):

- **[23 · Low southern regions](./plans/23-low-southern-regions.md)** – the
  Ligurian hinterland, the lakes and Ticino, Garda and the Venetian
  foothills, Provence and the Baronnies, the Nice hinterland: the areas that
  hold the "Anfang Oktober" and "Ende März" answers and are empty today.
- **[24 · Depth per destination](./plans/24-depth-per-destination.md)** – the
  general form of the same question: a coverage report per base town, the
  second-side rule, prominence by fame on the map so 400 roads stay
  readable, and the split of `passes.json` past 300 entries.
- **[25 · Vosges and Jura](./plans/25-vosges-and-jura.md)** – the first ranges
  that are not the Alps, and the mechanism for every range after them: one
  level above the region, a "Gebirge" chip that frames, the brand line. The
  mechanism is built (`RANGES` in `lib/regions.ts`); the two ranges' roads
  are the curation that is still open.
- **[26 · Pyrenees](./plans/26-pyrenees.md)** – bounds per range, two more
  countries, and the first screen once two ranges are 600 km apart. The
  mechanism is built (`RANGE_BOUNDS`, `HOME_RANGE`, `ES` and `AD`); the
  roads are the curation that is still open.
- **[27 · Gravel](./plans/27-gravel.md)** – a surface on every road, a
  closing rung from the snow cover instead of a barrier, the mountain routing
  profile, dashed lines and a "Belag" chip. Mountain biking is a different
  data model and stays out.

What stays on this list: the Massif Central, more Dolomites, the Black
Forest and the Erzgebirge. Plan 25's mechanism carries any of them; whether
one is added follows the rule written there – a destination for a week or a
long weekend of road cycling, with a dozen roads a rider travels for. The
Erzgebirge is the deliberate "not yet": low passes, a weekend range, and at
50.5° N the first range that would force the naming question plan 26 only
recommends an answer to.

## 3. Multi-day trips between destinations

Once destinations exist: a stage view that chains destinations ("Oisans →
Maurienne → Susa, 4 days, which passes on the way"), with overnight towns and
the season strip per stage. Rough, not routed: the stages are lines between
base towns, the passes in between come from the destination membership.

## 4. Questions in natural language

The idea: the app answers a fuzzy question – "zeige mir die Gegenden, in
denen ich in der ersten Herbstferienwoche Rennrad fahren kann" – with its
own data and its own views. The answer names three areas; a tap on one
frames it on the map, sets the filters and, where it fits, selects a pass.
Nothing is rendered that the app cannot render today.

This is an idea, not a plan, on purpose. A plan is written to be picked up
cold and has acceptance criteria; three things here are unknown and a plan
would have to assume them: whether a model translates such questions into
the app's state reliably enough, what a question costs, and whether "the
answer is a state" reads well to a person. A time-boxed spike answers them
first (below); the plan comes after, and inherits the numbers.

### Decided so far

Design hypotheses, held until the spike confirms or refutes them:

1. **The answer is an app state, not a text.** Filters, selection and camera
   are already one serialisable object (`HashState` in `lib/hash.ts`, the
   `load` action of `lib/app-state.ts`).
   An answer is a sentence plus a list of such states, shown as chips; a
   chip applied is a shareable link. The text explains, the app shows.
2. **The model translates, the app judges.** The model turns "erste
   Herbstferienwoche" into a half-month (and asks about the Bundesland if it
   matters), "ein paar schöne Pässe" into beauty ≥ 4 with three in reach,
   "nicht so fit" into difficulty ≤ 3. Rideability, reach and the best
   window come from `passYear`, `baseOf` and `basesOf`, called as
   tools and quoted in the app's own words (`GRADE_LABEL`, `REASON_WORD`).
   The model never grades a pass; that is Principle 3 applied to a model.
3. **No retrieval layer.** The whole dataset – every road with region,
   height, scales, tags and its 24 grade letters, every town with its
   derived year – is a compact almanac of a few tens of thousands of tokens,
   generated at build time like everything else (Principle 1) and handed to
   the model whole. The tools exist for exact numbers, not for finding
   things.
4. **Provider-agnostic.** The contract is the app's: the system prompt, the
   tool schemas (from the zod schemas that exist), the output schema (a
   sentence and a list of `HashState`), streaming. The model sits behind one
   adapter with that contract, so a provider is a configuration, not an
   architecture. In this stack the port is the Vercel AI SDK's model
   interface (`ai` plus one `@ai-sdk/*` provider package, swappable), a
   gateway such as OpenRouter for switching at runtime, and any
   OpenAI-compatible endpoint for open-weight models. Provider features –
   prompt-caching styles, reasoning-effort knobs – are optimisations the
   design must not depend on; the almanac has to be small enough to be sent
   uncached.
5. **One dynamic route, budgeted.** A second dynamic route next to the
   weather, and the first that costs money per call: a rate limit per
   visitor and a daily cap in the route (the forecast's cooldown in
   `lib/weather.ts` is the template), a maximum question length, no conversation stored, a paragraph
   on the privacy page naming what leaves the server and to whom. The
   cost per question is measured in the spike before a model is chosen.

### What it needs first

- **Plan 12.** The natural unit of an answer is a riding area. Today
  "region" is four coarse values and the towns stand in; with destinations
  as an entity the chips have names, bounds and a derived year.
- **Plan 18.** "Show this" as one rule with an adapter. An answer's action
  is exactly what that adapter takes; without it the agent would reach into
  the explorer's state by hand.
- **The question corpus** below, which costs nothing and is the one artefact
  that is useful whatever the provider: it is the spike's input and the
  eval afterwards.

### The spike

One to two days, with exit criteria, not a feature:

- thirty questions from the corpus against the almanac and the four tools,
  on two or three models of different price classes;
- measured: the share answered with the expected areas and states, the
  latency, the cost per question, whether the tools are needed or the
  almanac alone suffices;
- a throwaway UI sketch: the search field takes the question, the header
  sentence carries the answer, chips under it; no bubbles.

The deliverable is a table in this section and a go or no-go. On a go, a
plan is written with those numbers as its "Why now".

### The question corpus

Collected here until the spike starts, then moved next to the code as the
eval set. Each entry: the question as a person types it, and the expected
answer in app terms. Seed:

| Question                                                                      | Expected, in app terms                                                                                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Wo kann ich in der ersten Oktoberwoche Rennrad fahren, ein paar schöne Pässe? | period 10, beauty ≥ 4, status open; Nice hinterland, Ventoux and Vercors, Susa and the Cuneo valleys; Garda once plan 23 is in |
| Wir sind Ende März in Südtirol – was geht?                                    | period 3.5, base Meran; Gampenjoch, Mendel, the Ritten; the high passes "gesperrt"                                             |
| Welcher Standort für eine Juliwoche mit Bahnanreise und vielen Pässen?        | period 7, tag train, ranked by reach: Andermatt, Bourg-Saint-Maurice, Innsbruck, Brig                                          |
| Ist das Stilfser Joch Anfang Juni offen?                                      | the year of one pass at period 6: "Randzeit", with the strip as evidence                                                       |
| Wo ist es im August nicht zu heiß?                                            | period 8, valley-heat chip; the Engadin, Tarentaise, the high Valais                                                           |
| Rundtour mit dem Galibier – wo übernachten?                                   | bases for one pass, tours near it: Saint-Jean-de-Maurienne, Valloire, Briançon; La Marmotte                                    |
| Nur ein Wochenende, wir wohnen in Freiburg                                    | today: not in the data, said honestly; after plan 25: Vosges and Jura                                                          |
| Wo sind im Oktober die Tage noch lang genug für 150 km?                       | period 10 or 10.5, the short-day signal; the south, and the sentence about daylight                                            |
| Etwas Ruhiges ohne Verkehr, mittlere Schwierigkeit, Ende September            | period 9.5, traffic ≤ 2, difficulty ≤ 3; the Maira valley, the Queyras gorges, the Nockberge                                   |
| Hotel am Gardasee – welche Pässe?                                             | today: two roads, said honestly; after plan 23: Riva as a base with its reach                                                  |

Add real questions as they come up, with the answer a person would accept.

### Beyond the app

The same four tools as an MCP server on a route of their own, so that
someone can ask from whatever assistant they use. Provider-neutral by
definition, cheap because the functions exist, and a second door to the
same data. After the spike, if the answers hold up.

## 5. Traffic from data instead of gut feeling

Overpass query along the routed ascent: share of road classes
(`trunk`/`primary`/`secondary`/`tertiary`/`unclassified`) plus
`motor_vehicle=no`. Yields a computed value per ascent; the editorial estimate
remains as a correction. Runs in `data:build`, costs nothing.

## 6. Difficulty from the profile

`profiles.json` contains everything needed: length, average gradient, steep
sections, summit elevation. A climbbybike-style formula replaces the estimate;
the editorial number can stay as "character". Show both, as the scales dialog
promises honesty.

## 7. Ridden passes

GPX/FIT upload or Strava integration, matching against pass coordinates,
checkmarks in the lists, filter "still open and not yet ridden". The favorites
infrastructure in `lib/use-stored.ts` is the template. Fits the destination
goal ("where are the passes we have not done yet").

## 8. More summer signals

Plan 13 put heat, rain days, daylight and the cold descent on the status
ladder with what `climate.json` already holds. What needs a new archive run
or editorial data, each a plan of its own when its turn comes:

- **Thunderstorm tendency.** Needs `cape` or hourly precipitation from the
  archive (afternoon share of the rain), a new Open-Meteo run over the ten
  years. Would be the one signal that separates the Dolomites' afternoons
  from the Maritime Alps' at equal rain-day shares.
- **Wind and sunshine share.** Fit into the same daily archive call (≤ 10
  daily variables, currently 4): `wind_gusts_10m_max`, `sunshine_duration`.
  Wind matters on the Ventoux and the Bonette, sunshine for the "nass" word.
- **Seasonal crowds.** Ferragosto, school holidays, granfondos and the
  Tour's passage: editorial, per pass and half-month, a fifth reason word
  ("voll") on the same ladder.
- **Car-free days.** Sellaronda Bike Day, Stelvio Bike Day, the Glockner's
  closures: editorial dates, shown as a highlight rather than a reason.
- **Infrastructure season.** Hotels, the summit inn, the lift that carries
  bikes: when the valley is open for business. Editorial, per destination
  (plan 12) rather than per pass.
- **Usable hours per day.** The cell fill height as hours between sunrise,
  the heat of the afternoon and sunset – the daylight module already yields
  the window, the heat signal the cut-off.

## 9. Deliberately parked

- **Custom tour building and GPX export.** Route planning is what Komoot and
  Strava are for; the app links to them from every pass. Revisit only if
  users ask for "the ascent as a file" specifically.
- **Offline tiles / service worker.** Planning happens at home; the app is
  not for on-the-bike use.

## 10. Smaller ideas

- Weather for tours and towns, not only passes.
- Print / PDF summary of a destination for the kitchen table.
- The short-day signal as the only judge of winter. With the southern areas
  in (plan 23), every road from late October to mid-February reads
  "eingeschränkt: kurze Tage" regardless of climate – Poggio and Cipressa
  with 0 % frost and 14 °C at the top in late November exactly like the
  Stelvio. That is what a daylight threshold does, and it means the app
  cannot say "Ligurien im Januar" better than "eingeschränkt". Options, in
  the order they should be tried: a lower `SHORT_DAY_HOURS` for roads under
  a height and latitude; the short day as a note on the cell rather than a
  rung of the ladder; or a winter verdict that only frost and snow can
  lower. Each is a change to `lib/status.ts` with `analyze-status.ts
--changes` as the read-back, and a decision to be made with the strips on
  screen, not in a plan.

Done since this list was written: imagery per entity – Wikimedia Commons
photos with author and licence, picked by `bun run data:photos` and shown in
the detail panel (see [`data-pipeline.md`](./data-pipeline.md)).
