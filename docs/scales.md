# Scales and where they come from

The four 1–5 scales are **editorial assessments**, assigned based on the general
reputation of the passes (cycling literature, Grand Tour history, reports on
quaeldich.de, climbbybike, Cyclingcols). They are neither measured values nor
user ratings. They are suitable for rough classification, not for point-by-point
comparison. The scales dialog in the app says exactly that – please keep that
honesty.

| Scale          | 1                         | 3                     | 5                                                                          |
| -------------- | ------------------------- | --------------------- | -------------------------------------------------------------------------- |
| **Fame**       | barely known              | known in the scene    | legend (Galibier, Stelvio, Ventoux, Alpe d'Huez, Glockner)                 |
| **Beauty**     | forest road with no view  | solid                 | high-alpine scenery with a spectacular road (Bonette, Iseran, Gavia, Giau) |
| **Difficulty** | short or flat             | ordinary alpine pass  | > 1,000 m of elevation gain with ramps above 10 %, or very long and high   |
| **Traffic**    | almost car-free, dead end | ordinary pass traffic | through road (Simplon, Lautaret, Julier)                                   |

For anyone wanting to make this objective: `difficulty` could be computed from
`profiles.json` (length, average gradient, maximum ramp, summit elevation),
`traffic` approximately from the OSM road classes along the routed ascent. Both
are listed in `docs/roadmap.md`.

## Town labels

`tags` in `data/towns.json` (vocabulary and German labels in `lib/regions.ts`)
are editorial in exactly the same sense: they say what a planner would notice
on arrival – "Radsport-Mekka", "Werkstätten & Verleih", "Ruhig", "Lange
Saison" – and nothing is counted. The scales dialog lists all of them with the
sentence that defines each next to its glyph, `docs/data-model.md` has the
table. One to four per
town; `data:check` warns above four.

## Status per period

`passVerdict()` in `lib/status.ts` answers "how good is it to ride there in
this half-month", not only "can you get over". The opening window decides
what is closed; every other signal is judged on its own, can only lower a
cell, never lift it, and the first one in ladder order is the word the cell
carries:

```mermaid
flowchart TD
  A["pass, half-month t"] --> W["window: outside → closed<br/>edge → limited"]
  W --> X["oft gesperrt"]
  W --> S["every other signal, worst-of,<br/>each one only ever lowers"]
  S --> S1["snow ≥ 20 % · frost ≥ 80 % · altitude"]
  S --> S2["valley tmax ≥ 26 °C → Hitze"]
  S --> S3["rain days ≥ 70 % → nass"]
  S --> S4["daylight < 10¾ h → kurze Tage"]
  S --> S5["summit tmax < 8 °C → kalte Abfahrt"]
  S1 & S2 & S3 & S4 & S5 --> L{"any fired?"}
  L -- "yes, first in ladder order" --> R["eingeschränkt<br/>label = that one word"]
  L -- "no" --> G{"inside the pass's<br/>longest quiet run?"}
  G -- "yes" --> B["beste Zeit"]
  G -- "no" --> O["gut"]
```

The ladder order is `REASON_ORDER`: `outside-window → window-edge → snow →
frost → altitude → heat → wet → short-day → cold-descent`. Every reason that
fired stays in `StatusVerdict.reasons`, in that order; the badge shows the
first as one word (`REASON_WORD`), the panel every one as a sentence with its
number and provenance (`REASON_TEXT`).

Three fills plus a mark:

```
██  gut            green          rideable, no caveat worth a word
▒▒  eingeschränkt  amber          one word: Hitze · nass · kurze Tage · kalte Abfahrt · Schnee · Frost · Höhe · Randzeit
░░  oft gesperrt   hollow         road closed, from the opening window only
▔▔  beste Zeit     mark under green cells: the longest stretch without a caveat and with < 10 % snow days
```

The best window is a distinction of a stretch, not a grade of the cell, so it
is drawn as a mark under the green cells rather than as a fourth fill: a
paler green would read as "less" without being a step towards amber. Green
without the mark means "just as good, only a shorter stretch" or "a little
snow" (10–19 % of days, below the `snow` threshold but above `SNOW_BEST_PCT`).

`Status` (`open | risky | closed`, `lib/schema.ts`) stays three-valued: it is
the vocabulary of the filter, the hash and the map. `Grade` (`best | good |
limited | closed`, `lib/status.ts`) is what the strip reads: `open` split by
whether the half-month lies in `bestPeriods()`, the longest run of "gut"
half-months with fewer than 10 % snow days; `best` and `good` share the green
fill, `best` adds the mark. The histogram counts three segments and names the
best-window share in its tooltip. The map circles, the row dot and the badge
dot keep the three colours.

Nothing but the opening window produces "oft gesperrt": a closure is what the
window knows; snowfall, heat or short days are what the series and the
calendar know – and a road stays open through them, it just stops being a
good idea. A closed road and a 34 °C valley are not the same kind of
statement, which is why the hollow cell is categorically apart from the
amber one.

### Thresholds

All constants sit in `lib/status.ts`; the tables they were read off are in
`docs/plans/04-climate-aware-status.md` (snow, frost) and
`docs/plans/13-summer-axis.md` (the rest). `bun run scripts/analyze-status.ts`
prints the cohort tables, the per-half-month distributions of every signal,
the counts one step either side of every threshold, and every (pass,
half-month) pair whose verdict changes – re-run it after touching a constant.

| Signal        | Constant            | Value | Reads                                            |
| ------------- | ------------------- | ----- | ------------------------------------------------ |
| Schnee        | `SNOW_RISKY_PCT`    | 20 %  | `snowPct`, share of days with ≥ 1 cm             |
| Frost         | `FROST_RISKY_PCT`   | 80 %  | `frostPct`, share of nights below 0 °C           |
| Hitze         | `HEAT_VALLEY_TMAX`  | 26 °C | `tmax` derived to the lowest ascent start        |
| nass          | `WET_LIMITED_PCT`   | 70 %  | `wetPct`, share of days with ≥ 1 mm              |
| kurze Tage    | `SHORT_DAY_HOURS`   | 10¾ h | day length from `lat`, `lib/daylight.ts`         |
| kalte Abfahrt | `COLD_DESCENT_TMAX` | 8 °C  | `tmax` at the summit, the afternoon of a descent |
| beste Zeit    | `SNOW_BEST_PCT`     | 10 %  | `snowPct` inside a run of "gut"                  |

### Derived values

The climate series is ERA5-Land, downscaled by Open-Meteo to `pass.elevation`
(the `elevation` parameter in `scripts/build-data.ts`), so every bucket
describes the summit. Heat is a valley phenomenon, and the valley is not
measured: `valleyTmax()` takes the summit `tmax` down to the lowest ascent
start (`valleyElevations()` in `lib/profile.ts`, from `profiles.json`) with
the standard-atmosphere lapse rate of 0,65 °C per 100 m. That is a model:
inversions, foehn and the valley floor's own heat are not in it, and against
station values it runs about 2–3 °C low for passes with 1 800 m of drop
(Stilfser Joch from Prato: 24,8 °C derived, ~27 °C measured) and close for
low ones. The threshold therefore errs towards _not_ flagging heat on the
highest passes, which is the safe direction for a planner, and every place
the value shows says "abgeleitet". Passes without a profile (twelve, until
their routes pass the quality gate) have no valley value and no heat signal;
the panel says so.

Day length and sunrise/sunset are pure astronomy (`lib/daylight.ts`, the NOAA
sunrise equation, good to a minute or two), taken in the middle of the
half-month (the 8th or the 23rd) and shown in Europe/Berlin clock time. The
DST switch in late October falls inside a half-month, so the sunset shown
there is an hour off for part of it; the text says "gegen".

The cold descent reads the summit's daily **maximum**, not its minimum: the
descent happens in the afternoon, when the summit is at its warmest, and a
maximum of 8 °C means wind chill around freezing at 50 km/h.

For tours the worst status among their passes applies, and the worst grade
per half-month. All of this is deliberately coarse and does not replace
official information. `passVerdict` is the place where real closure data will
hook in later.
