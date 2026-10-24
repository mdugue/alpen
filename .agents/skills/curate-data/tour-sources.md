# Finding tours: where to look, and what was already looked at

The tours in `data/tours.json` are only as complete as the search that found
them. Loops drawn from the roads outward ("which classic loop joins these
passes?") miss everything a rider knows by its _name_: the Stoneman Miriquidi
Road was not in the app because the loops for the plan-34 ranges were built
around the entries just added, one per range, and nobody asked which branded
routes the Erzgebirge has. Its road version is not even signposted, so it is
missing from the tourism portals' lists of signposted routes, and a search for
"Stoneman Miriquidi" returns the mountain-bike route first.

So a tour search starts from the names, per range, in these source classes,
and only then from the roads:

| Class                         | What it is                                                          | Type in the data                 | Where to look                                                                                       |
| ----------------------------- | ------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Branded permanents            | a standing route with a stamp card, timing or medal                 | `permanent`                      | stoneman.bike (every Stoneman with a "Road"), the FFCT permanents and "brevets de cyclomontagnarde" |
| Stage routes                  | A to B over several days, known by name                             | `stages`                         | tourism boards' "Grand Tour"/"Route des …" pages, national cycle-route networks                     |
| Sportives with a fixed course | a one-day event whose course stays the same                         | `event` (+ `when`)               | the organiser's site; magazine event calendars (TOUR, Procycling, cyclosport.fr, finishers.com)     |
| Sportives that move           | the course changes each year                                        | `edition` once the GPX is public | the same; enter a year only from the organiser's GPX or map                                         |
| Signature loops               | the loop a tourism board or bike-hotel group publishes as _the_ one | `loop`                           | the range's tourism portal ("Rennrad", "cyclo", "ciclismo de carretera"), quaeldich.de tour lists   |

Per range, ask the search engine in the range's own languages: "<range>
Rennrad Dauerstrecke / Radmarathon / Rundtour", "<range> cyclosportive /
brevet / circuit route", "<range> marcha cicloturista / granfondo". A
candidate goes into the data when

1. its course is known well enough to draw: the organiser's GPX, a route map,
   or the list of controls in order (`waypoints` join them; the gate holds the
   line to the stated `km` within 15 %);
2. `km` and `elevationGain` come from the organiser or a trusted guide;
3. its waypoints lie in one range's box (`RANGE_BOUNDS`) and it climbs at
   least one entry of that range – a course that starts in a city outside the
   box (Regensburg) or has no climb the app knows (the Eroica) does not fit
   the model;
4. every crossing the line rides over is an entry: run
   `bun run scripts/analyze-coverage.ts --tours <slug>` after the build and
   either add the saddles it names or say below why not.

A course that rides up a spur and back down on purpose (a permanent's
checkpoint on a summit) lists the spur and puts a waypoint on its top; that
waypoint is what tells `data:check` the out-and-back is meant.

## The register

What was checked, with the verdict, so the next search starts where this one
stopped. Add a line for every candidate you look at, including the ones you
leave out.

| Candidate                                              | Range         | Class     | Verdict                                                                                                                                          |
| ------------------------------------------------------ | ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stoneman Dolomiti Road                                 | Alpen         | permanent | in (`stoneman-dolomiti-road`); lists the Tre Cime spur since 2026-10                                                                             |
| Stoneman Miriquidi Road                                | Erzgebirge    | permanent | in (`stoneman-miriquidi-road`), drawn through the 13 controls; the GPX is only in the starter pack                                               |
| Stoneman Miriquidi, Arduenna, Glaciara, Taurista (MTB) | –             | –         | mountain-bike only, out                                                                                                                          |
| Raid Pyrénéen                                          | Pyrenäen      | permanent | in (`raid-pyreneen`); owed as entries: Col des Ares, Col de Caougnous, Col du Four, Coll de Lluç, Coll Rigat, Col de la Perche (coverage report) |
| Quebrantahuesos                                        | Pyrenäen      | event     | in (`quebrantahuesos`); the 2 km climb to Hoz de Jaca is no entry                                                                                |
| Mallorca 312                                           | Mallorca      | event     | in (`mallorca-312`)                                                                                                                              |
| L'Ariégeoise                                           | Pyrenäen      | edition   | later: the long course changes; enter a year from the organiser's GPX                                                                            |
| Liège–Bastogne–Liège Challenge                         | Ardennen      | edition   | later: follows the pro race, changes every year                                                                                                  |
| Rhön-Radmarathon Bimbach                               | Thüringen     | edition   | later: courses change every year (2025: 183–258 km)                                                                                              |
| SuperGiroDolomiti (Lienz)                              | Alpen         | edition   | later: course changed with the Zoncolan and the Nassfeld                                                                                         |
| Tour des Stations (Verbier)                            | Alpen         | edition   | later: ultra courses that change                                                                                                                 |
| Alpen Challenge Lenzerheide                            | Alpen         | event     | candidate: two GPS courses (Albula–Julier, Albula–Maloja–Splügen); the date differs between sources (August or September)                        |
| Brevet de Randonneur des Alpes (Vizille)               | Alpen         | event     | candidate: every second year; check the course                                                                                                   |
| Grand Tour des Ballons                                 | Vogesen       | loop      | candidate: 160 km from Longemer over the Route des Crêtes; only a municipal listing found so far                                                 |
| Arber-Radmarathon                                      | Bayerwald     | event     | out: starts in Regensburg, outside the range box                                                                                                 |
| L'Ardéchoise                                           | Zentralmassiv | event     | out for now: Saint-Félicien lies east of the range box, many courses                                                                             |
| L'Eroica (permanent)                                   | Apennin       | permanent | out: mostly gravel through the Chianti hills, no entry of the app on its line                                                                    |
| Rund um den Harz                                       | Harz          | event     | out: rides round the range in the foothills                                                                                                      |
| Los 10.000 del Soplao                                  | Nordspanien   | event     | out: a mountain-bike event                                                                                                                       |
| Granfondo Etna                                         | Sizilien      | event     | out: no organiser course found                                                                                                                   |
