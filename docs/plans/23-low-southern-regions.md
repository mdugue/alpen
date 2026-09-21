# 23 · Low southern regions

**Status:** in progress – steps 1–6 (the five areas, towns, loops, aliases,
photos) as source data; the routes, profiles and climate series are drained by
the refresh workflow, and step 7 (the read-back) follows once they are in ·
**Effort:** L (S for code, the rest is curation) ·
**Depends on:** 14 (the traverse types: the coast and the lakes are balcony
and valley roads as much as passes); benefits from 24 (the coverage report
says where a base is thin) · **Unblocks:** the "Anfang Oktober" and "Ende
März" answers; the southern destinations of plan 12

## Goal

The app answers "where in early October, where in late March" with riding
areas instead of with single low passes. Five low southern areas – the
Ligurian hinterland, the Italian lakes and Ticino, Garda and the Venetian
foothills, Provence with the Baronnies, and the Nice hinterland – get enough
roads, base towns and loops that a base there reaches a door band of climbs
with a long season, and the destination verdict (`lib/destination.ts`) has
something to grade.

## Why now

The product goal is the shoulder season as much as July, and the data does
not carry it yet. Counted over `data/passes.json` (201 entries, September
2026):

| What                                              | Count |
| ------------------------------------------------- | ----: |
| roads without a winter closure (`season: null`)   |   104 |
| roads below 1 500 m                               |    47 |
| roads below 1 200 m                               |    27 |
| Ligurian hinterland (Nava, Melogno, Beigua …)     |     0 |
| Italian lakes and Ticino (Ghisallo, Sormano)      |     2 |
| Garda, Grappa, Vicenza foothills (Forra, Bondone) |     2 |
| Provence beyond the Ventoux (Ventoux, Nesque)     |     2 |
| Nice hinterland (Vence, Madone, Braus, Turini …)  |     7 |

The low roads that exist cluster in the Vercors gorges, the Bavarian
pre-Alps and the Dolomite foothills. The areas a road cyclist actually
travels to in March and October – the Riviera dei Fiori, the lakes, Garda,
the Ventoux country – are either empty or a single famous climb.

The destination verdict makes the gap visible. It grades a base against its
own peak (`docs/scales.md`), so Bédoin, which reaches two roads, gets a
"beste Zeit" in April and September that is the right shape and the wrong
size: two roads are not a holiday. The same holds for every southern base
the app would add today. Depth is what makes the relative grade honest.

## Non-goals

New mountain ranges (plans 25 and 26). Gravel (plan 27). Destinations as an
entity (plan 12). Any change to the heuristic: the thresholds hold, and a
600 m balcony road in March comes out of the climate signals as it should. A
change to the reach bands: 75 km already covers each of the five areas.

## The five areas

Everything below is a candidate list, not data. Elevations are approximate
and are verified by `bun run data:locate` before an entry is committed; the
`curate-data` skill is the procedure. Type words follow `ROAD_TYPES`.

### A · Ligurian hinterland and the Riviera dei Fiori

The winter training ground of the peloton and empty in the data. Season all
year; the heat signal will mark July and August on the coast, which is
right.

- **Bases:** Sanremo (train, workshops), Alassio or Albenga (train), Finale
  Ligure (the gravel and MTB town, `hub`), Imperia.
- **Roads:** Colle di Nava (pass, ~934 m), Colle San Bartolomeo (pass,
  ~620 m), Passo del Ginestro (pass, ~680 m), Colle del Melogno (pass,
  ~1 030 m), Passo del Faiallo (pass, ~1 040 m), Passo del Turchino (pass,
  ~530 m), Monte Beigua (spur, ~1 200 m road end), Colle di Tenda old road
  top (a gravel candidate for plan 27, not here), Passo di Teglia (pass,
  ~1 390 m), Colle d'Oggia (pass, ~1 170 m), Colle Langan (pass, ~1 130 m),
  Monte Bignone (spur, ~1 200 m), Cipressa and Poggio as one entry each (pass,
  ~240 m and ~160 m; fame 5 for the Milano–Sanremo finale, difficulty 1 – the
  honest anomaly the scales dialog already allows for).
- **Loops:** Sanremo – Colle San Bartolomeo – Colle di Nava – Pieve di Teco –
  Imperia; Finale – Melogno – Calizzano – Colle Scravaion – Finale.

### B · The Italian lakes and Ticino

Lakes Como, Lugano and Maggiore. Two roads exist (Ghisallo, Sormano);
Ticino has none and it is the one canton with a March season.

- **Bases:** Bellagio or Lecco (train), Lugano (train, `season`), Locarno
  (train, `season`), Stresa (train).
- **Roads:** Monte Ceneri (pass, ~550 m), Alpe di Neggia (spur, ~1 400 m),
  Sighignola (spur, ~1 300 m, "Balcone d'Italia"), Monte Bisbino (spur,
  ~1 320 m), Monte Generoso road to Bellavista (spur), Valle Verzasca
  (valley), Valle Maggia and Val Bavona (valley), Mottarone (spur, ~1 490 m),
  Valcava (pass, ~1 340 m), Culmine di San Pietro (pass, ~1 250 m), Monte San
  Primo (spur), Selvino and Colle Gallo above Bergamo (pass, ~960 m and
  ~760 m), Piani dei Resinelli (spur, ~1 280 m), Passo di Agueglio (pass,
  ~1 140 m).
- **Loops:** Lecco – Valcava – Culmine di San Pietro – Lecco; Bellagio –
  Ghisallo – Sormano – Bellagio (the Lombardia finale).

### C · Garda, Monte Grappa and the Venetian foothills

The most-visited Italian lake among German-speaking riders and two roads in
the data. Monte Grappa alone has ten paved sides.

- **Bases:** Riva del Garda or Arco (`hub`, workshops), Malcesine, Bassano
  del Grappa (train), Rovereto (train).
- **Roads:** Monte Baldo from Brentonico to San Valentino (spur, ~1 310 m),
  Bocca di Navene (pass, ~1 430 m), Punta Veleno (spur, ~1 180 m, the steep
  one), Passo del Ballino (pass, ~760 m), Passo d'Ampola and Valle di Ledro
  (pass, ~750 m), Lago di Tenno road, Monte Grappa from Semonzo, Romano and
  Possagno (spur, ~1 745 m, three ascents), Passo Vezzena (pass, ~1 400 m),
  Pian delle Fugazze (pass, ~1 160 m), Passo Xomo (pass, ~1 060 m), Monte Velo
  (spur, ~1 030 m), Passo Spino (pass, ~1 165 m), Valvestino road (balcony).
- **Loops:** Riva – Ballino – Tenno – Riva; Bassano – Grappa (Semonzo up,
  Possagno down) – Bassano.

### D · Provence and the Baronnies

The Ventoux is there with three sides; nothing around it is.

- **Bases:** Bédoin (exists), Malaucène, Vaison-la-Romaine, Buis-les-Baronnies.
- **Roads:** Col de la Madeleine near Bédoin (pass, ~450 m), Col des
  Abeilles (pass, ~1 000 m), Col de Murs (pass, ~630 m), Col de Perty (pass,
  ~1 300 m), Col de Soubeyrand (pass, ~990 m), Col d'Ey (pass, ~720 m), Col
  de Fontaube (pass, ~640 m), Col de Macuègne (pass, ~1 070 m), Col de
  l'Homme Mort (pass, ~1 210 m), Dentelles de Montmirail road (balcony),
  Mont Serein (the Malaucène side already covers it: check the ascents).
- **Loops:** Bédoin – Ventoux – Malaucène – Col de la Madeleine – Bédoin;
  Buis – Perty – Séderon – Macuègne – Buis.

### E · Nice hinterland top-up

Seven roads and one town (Sospel). What is missing are the second-tier
cols that make Sospel and Nice a week rather than a weekend.

- **Bases:** Nice (train, workshops), Menton (train).
- **Roads:** Col de Castillon (pass, ~710 m), Col de l'Èze and La Turbie
  (pass, ~510 m), Col Saint-Roch (pass, ~990 m), Col de Bleine (pass,
  ~1 440 m), Col de l'Orme (pass, ~1 000 m), Col de Nice (pass, ~410 m), Col
  de la Porte (pass, ~1 060 m), Mont Faron above Toulon (spur, ~580 m, an
  outlier by distance – decide when the area is done).

## Design

No new mechanism. Three things to decide once, then apply:

- **Type words for the coast.** A road along a lake or a ridge without a
  summit is a `balcony` or a `plateau`, and is measured as a traverse. Plan
  14's rule applies unchanged; the note says where the ride ends.
- **Fame in the south.** The scale is anchored on Grand Tour history. A
  Ligurian col is known to the winter-training crowd and nobody else, so
  fame 2 is the honest default there and 3 needs a reason in the note
  (Milano–Sanremo, Il Lombardia, the Giro's Zoncolan neighbours). The Poggio
  and the Cipressa are fame 5 with difficulty 1; the scales dialog already
  says fame is not difficulty.
- **Season windows.** Almost every road here is `season: null`. The few that
  close (Monte Grappa's Cima road in deep winter, some Baldo roads) get the
  road authority's habit, never a guess.

Ascent starts follow the existing rule: the classic climb from the valley
village, one or two sides, three only for the famous (Ventoux, Grappa).

## Steps

Each step is one PR with source and generated data together; the order is
by size of the gap.

1. **Ligurian hinterland (A):** ~14 roads, 4 towns, 2 loops.
2. **Lakes and Ticino (B):** ~14 roads, 4 towns, 2 loops.
3. **Garda and the foothills (C):** ~14 roads, 4 towns, 2 loops.
4. **Provence and Baronnies (D):** ~10 roads, 3 towns, 2 loops.
5. **Nice top-up (E):** ~8 roads, 2 towns.
6. **Photos and aliases** for everything above (`bun run data:photos`; the
   Italian, French and German names as aliases).
7. **Calibration read-back:** `bun run scripts/analyze-destinations.ts` and
   `bun run scripts/analyze-status.ts --changes` after each step; the
   southern bases must get a best window and the summer heat must show where
   a rider expects it (the coast, the Rhône valley) and nowhere else.

Budget: about 60 roads with ~90 ascents cost ~90 profiles and ~60 climate
series, i.e. roughly two and three hours of Open-Meteo windows respectively
(`scripts/build-data.ts` header). `bun run data:backfill` batches it.

### Documentation

`docs/roadmap.md` §2 points here; no structural documentation changes.
`docs/scales.md` gets the two sentences on fame in the south.

## Acceptance criteria

- Each of the five areas has at least eight roads, Ligurien and Garda at
  least twelve; at least two bases per area with roads in the door band; at
  least one loop per area.
- Bédoin reaches at least six roads; Sanremo, Riva and Lugano each reach at
  least eight.
- Every new base has a named best window in the destination block, and no
  southern base grades "beste Zeit" in a half-month where its roads read
  "Hitze".
- With early October and beauty ≥ 3 selected, the map shows the five areas
  as visible clusters, not as single dots.
- `bun run data:check` is clean; no new road is a rejection in
  `rejected.json` without a `check` and a note.

## Risks and open questions

- **quaeldich coverage** is thinner for the Ligurian minor cols, so the
  `quaeldich` slug is left out where the lexicon has no page and the panel
  falls back to the search, as designed.
- **Density.** Sixty more dots in the south make the overview busier; plan 24
  carries the prominence rule that keeps zoom 7 readable. Not a blocker for
  the first three steps.
- **The heat signal on the coast** is derived from the summit series with the
  lapse rate; at 500 m the derivation is close to the measurement, and the
  ± 3 °C caveat stays on screen. Nothing to change, but the read-back in step
  7 is where a surprise would show.
- **Mont Faron** and the Dentelles are on the edge of "a road worth a
  holiday"; decide with the numbers, drop without regret. Both were left out
  of the first round, as were the Baldo spur to San Valentino (it is the
  Brentonico side of the Bocca di Navene) and the Lago di Tenno road (the
  Ballino covers it).
- **The read-back so far (step 7, with 27 of 62 climate series in):** the
  Ligurian and Lombard roads come out as the plan hoped – Poggio, Cipressa,
  Bignone, Nava and Langan are "beste Zeit" from March to June, "Hitze" from
  late June to August (valley 27–31 °C at the coast, up to 31 °C in the
  Nesque and the Ventoux valley), good again in September. Sanremo reaches
  28 roads and gets its spring and autumn windows. What still reads "best"
  all summer is Bédoin, because the nine Provence series are among the 35
  not yet fetched; that changes with the next backfill run.
- **The winter is capped by the short-day signal, not by the south.** From
  late October to mid-February every road in the file is "eingeschränkt:
  kurze Tage" (`SHORT_DAY_HOURS`, 10.75 h), the coast included – so no base
  can grade better than "eingeschränkt" in winter, and the question "Ligurien
  im Januar" gets a cautious answer even where the climate would allow a
  warmer one. The thresholds are a non-goal here; the decision whether a
  low road on the coast should be judged by daylight alone is written up in
  `docs/roadmap.md` §10.
- **The budget above is an hourly number; the daily one is the wall.**
  Open-Meteo allows 10 000 calls a day, so ~120 profiles and ~62 climate
  series are three days of the free tier, not five hours. The first round
  therefore commits the source data and the summit checks and leaves the
  routes, profiles and climate series to the refresh workflow, which needs a
  handful of dispatches an hour apart (`.github/workflows/refresh-data.yml`).
  Until they are in, the new roads show as dots without an ascent line and
  with a season-only status, and the read-back of step 7 cannot be done.
