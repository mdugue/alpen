# 05 · Filters and search

**Status:** done ([#9](https://github.com/mdugue/alpen/pull/9)) · **Effort:** S–M · **Depends on:** – (09 adds the
`aliases` field to the schema) · **Unblocks:** 12 (the region vocabulary in
`lib/regions.ts` becomes destination navigation)

## Goal

Search finds passes the way people spell them, filters cover the questions a
holiday planner asks (how hard, how much traffic, how beautiful), sort and
filters survive in the URL, and the map shows the same set as the list.

## Why now

- Search is byte-literal (`lib/rows.ts` lowercases and calls `includes`).
  "Grossglockner", "Vrsic" and "Stilfserjoch" return nothing; the pass is
  called "Großglockner Hochalpenstraße", "Vršič" and "Passo dello Stelvio".
- The only pass filters are fame and minimum elevation. A planner asks
  "nothing above difficulty 3 for my partner", "as little traffic as
  possible", "only the beautiful ones".
- The map hides filtered-out passes but keeps every tour and town regardless
  of search or status. Searching "Galibier" leaves nine tours on the map,
  which reads as a bug.
- Sort is not in the hash (roadmap item 7).

## Non-goals

Full-text search across notes (the `why` and `note` fields stay in the
haystack, but no ranking engine).

## Design

### Search normalisation

`lib/search.ts`:

```ts
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/\p{M}+/gu, "")
    .replaceAll("ß", "ss")
    .replaceAll("æ", "ae")
    .replaceAll("œ", "oe")
    .replaceAll("ł", "l")
    // Apostrophes join ("l'Iseran" → "liseran"), everything else separates.
    .replaceAll(/['’]/gu, "")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export const matches = (haystack: string, query: string) =>
  fold(query)
    .split(" ")
    .every((token) => haystack.includes(token));
```

Haystacks are folded once per pass and town (module-level `WeakMap`); the
nine tours are folded on the fly because their haystack also carries the
names of their passes:

- Pass: `name`, `aliases`, `region`, `country` and the German country names
  (`FR` → "Frankreich"), the ascent labels (so "Bormio" finds Stelvio and
  Gavia), the first sentence of `note`.
- Tour: `name`, `description`, the names of its passes.
- Town: `name`, `country`, `why`.

Every query token must match somewhere; "stelvio prad" finds the pass via
name and ascent label.

### Aliases

New optional `aliases: string[]` in `data/passes.json` (schema in plan 09).
Seed list to add in the same PR:

| Pass                         | Aliases                                      |
| ---------------------------- | -------------------------------------------- |
| Passo dello Stelvio          | Stilfser Joch, Stilfserjoch, Stelvio         |
| Umbrailpass                  | Giogo di Santa Maria                         |
| Großglockner Hochalpenstraße | Grossglockner, Glockner                      |
| Vršič                        | Vrsic, Werschetz                             |
| Gotthard (Tremola)           | San Gottardo, Gotthardpass                   |
| Passo Sella                  | Sellajoch                                    |
| Passo Gardena                | Grödner Joch, Groednerjoch                   |
| Passo Pordoi                 | Pordoijoch                                   |
| Passo delle Erbe             | Würzjoch                                     |
| Passo Monte Croce Comelico   | Kreuzbergpass                                |
| Tre Cime di Lavaredo         | Drei Zinnen, Auronzohütte                    |
| Jaufenpass                   | Passo di Monte Giovo                         |
| Penserjoch                   | Passo di Pennes                              |
| Timmelsjoch                  | Passo del Rombo                              |
| Passo Fedaia                 | Marmolada                                    |
| Julierpass                   | Pass dal Güglia                              |
| Malojapass                   | Passo del Maloja                             |
| Ofenpass                     | Pass dal Fuorn                               |
| Splügenpass                  | Passo dello Spluga                           |
| Simplonpass                  | Passo del Sempione                           |
| Nufenenpass                  | Passo della Novena                           |
| Lukmanierpass                | Passo del Lucomagno                          |
| Col du Grand Saint-Bernard   | Gran San Bernardo, Grosser Sankt Bernhard    |
| Col du Petit Saint-Bernard   | Piccolo San Bernardo, Kleiner Sankt Bernhard |
| Col du Mont Cenis            | Moncenisio                                   |
| Colle dell'Agnello           | Col Agnel                                    |
| Colle Fauniera               | Colle dei Morti                              |
| Col de la Bonette            | Cime de la Bonette, Restefond                |
| Roßfeld-Panoramastraße       | Rossfeld                                     |
| Silvretta Hochalpenstraße    | Bielerhöhe                                   |
| Ötztaler Gletscherstraße     | Rettenbachferner                             |

The `curate-data` skill covers adding more.

### Filters

One filter panel (`components/sidebar/filter-panel.tsx`) above the lists:
its trigger sits at the end of the search row, the panel holds the status
picker (a dropdown with checkboxes) and the criteria. `Filters` carries:

| Field                    | UI                                     | Hash       | Applies to                      |
| ------------------------ | -------------------------------------- | ---------- | ------------------------------- |
| `status: Status[]`       | dropdown with three checkboxes         | `s=open`   | passes, tours                   |
| `difficulty: [min, max]` | range slider 1–5                       | `d=2-4`    | passes, tours (by their passes) |
| `minElevation: number`   | slider 0–2 800 m                       | `m=2000`   | passes, tours (by their passes) |
| `maxTraffic: number`     | select "egal / ≤ 3 / ≤ 2 / nur ruhige" | `v=3`      | passes, tours (by their passes) |
| `minBeauty: number`      | select "alle / ab 3 / ab 4 / nur 5"    | `be=4`     | passes, tours (by their passes) |
| `minFame: number`        | select "alle / ab 3 / nur Klassiker"   | `f=4`      | passes, tours (by their passes) |
| `sort: PassSort`         | select in the pass list header         | `o=beauty` | passes                          |

Every criterion reaches a tour through the passes it crosses: a tour needs
one pass that clears the lower bounds (elevation, fame, beauty, minimum
difficulty) and every pass has to respect the upper bounds (maximum
difficulty, traffic). Towns see search and favourites only. The badge on the
trigger counts every active filter; `resetFilters` keeps the sort, which is
a preference rather than a filter.

The hash parsers accept exactly the values the controls offer (nuqs'
standalone `createLoader`/`createSerializer`, no router adapter), so a link
never applies a filter the panel cannot show, and the page stays static.

### Map consistency

Rule: what the list shows for a kind is what the map shows for that kind.

- `mapTours` derives from `tourRows` intersected with the visibility switch
  (the switch stays a layer toggle, not a filter).
- `mapTowns` derives from `townRows` intersected with `showTowns`.
- Passes already follow `passRows`.

Filter changes stay cheap on the map: the 88 ascent lines (66 000 points)
are uploaded once from all passes, and a change only sets a layer filter for
the visible passes and feature state (status, selected) on the `routes`
source. Rebuilding that source on every slider step was what made the
filters feel slow.

## Steps

1. `lib/search.ts` with `fold`, `matches`, haystack builders; unit tests with
   the alias table as fixtures; replace `query()` in `lib/rows.ts`.
2. `aliases` in `passes.json` + type + `check-data` (no duplicates, no alias
   equal to a name).
3. New filter fields, hash read/write in `lib/app-state.ts` with tests, UI in
   `components/sidebar/pass-list.tsx` and `sidebar.tsx`.
4. Map consistency in `components/explorer.tsx`.
5. Update `README.md` ("Filter, selection and URL state") if the hash keys are
   documented anywhere; document the keys in `lib/app-state.ts`.

## Acceptance criteria

- "grossglockner", "vrsic", "stilfser", "bormio", "drei zinnen" each return
  the expected pass.
- A link with `d=1-3&v=2&o=beauty` restores those filters and the sort.
- Searching a pass name leaves only matching tours and towns on the map.
- The filter badge counts every active pass filter.

## Implementation notes

- The hash key for beauty is `be`, not `b`: `b` has carried the map bearing
  since the first shareable links.
- "Vrsic" is not an alias: `fold` already maps "Vršič" to it, and
  `data:check` rejects aliases that collide with a folded name.
- Country and region filters were part of the first draft and were dropped
  again on review: they are not needed for the product, and the chips made
  the sidebar noisy. `lib/regions.ts` keeps the vocabularies for the schema
  and the search haystacks; plan 12 covers "where" through destinations.

## Risks and open questions

- The tour semantics (one pass clears the lower bounds, every pass respects
  the upper bounds) are a judgement call; both live in two small functions in
  `lib/rows.ts` if a stricter or looser rule turns out to serve planners
  better.
