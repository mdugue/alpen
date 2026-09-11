---
name: curate-data
description: "Add or edit passes, tours, towns and (later) destinations in data/*.json: slug rules, coordinates, editorial 1–5 scales per docs/scales.md, season windows, ascent start points, aliases; then run data:build and data:check and review the routed result. Use when the user wants to add a pass, tour or town, fix a rating or a season, add search aliases, or refresh precomputed data."
---

Hand-maintained data is the product. Every edit follows the same loop:
edit `data/*.json` → `bun run data:build` → `bun run data:check` → look at
the result on the map → commit source and generated files together.

## Fields and rules

Read `docs/data-model.md` and `docs/scales.md` first; they are short and
authoritative. In addition:

- **Slug**: from the name, lowercase ASCII; umlauts → `ae/oe/ue`, `ß` → `ss`,
  apostrophes and spaces → `-`, no leading/trailing dashes. Slugs never
  change once committed (they are in shared links).
- **Pass coordinate**: the summit point _on the road_ (not the geographic
  saddle or a nearby peak). Check `elevation` against the map; a mismatch of
  more than 80 m is a bug the route gate flags, both against the routed profile
  and against the DEM height in `summits.json`.
- **Ascents**: `from` is a point on the road in the valley village where the
  classic climb starts; `label` names the village and, for two-sided passes,
  the side ("Valloire (Nord)"). One or two ascents; three only for famous
  passes with three distinct roads.
- **Scales**: editorial, 1–5, per `docs/scales.md`. Do not derive them from
  numbers; do compare with neighbours so the ordering is defensible
  ("is this really harder than Mortirolo?").
- **Season**: half-months (`10` = early October, `10.5` = late October);
  `null` for roads cleared all year; `maintained: true` only for managed toll
  roads that are actually cleared.
- **`type`**: what kind of road the entry is – `pass`, `spur`, `plateau`,
  `balcony` or `valley` (`ROAD_TYPES` in `lib/regions.ts`). Required on every
  entry. The rule is operational: if the ascents climb to the entry's own
  point it is a `pass` (a crossing) or a `spur` (the road ends up there); if
  the ride is the traverse itself it is one of the other three. It decides how
  the gate measures the entry, see "measured by type" below, and `data:check`
  warns when a tour lists a `spur` – a loop cannot cross one.
- **`tags`**: editorial labels for what riding the road is like (`ROAD_TAGS`),
  optional, no duplicates. Judged like the town labels: what a planner
  notices, never something the data already measures (length, steepness,
  altitude, a border crossing are numbers and stay numbers). What a label
  cannot carry belongs in `note` – which days a `carfree` road is closed to
  cars, whether bikes pay on a `toll` road.
- **`roadSummit`**: only on a `pass`, and only when its summit is simply the
  highest point of the asphalt because OSM has no `mountain_pass` node;
  `data:locate` then offers the highest point of the stored route instead of
  searching for a node. Every other type is a road summit by definition, so
  writing it there is redundant and `data:check` says so. See
  `docs/data-model.md`.
- **note**: one or two German sentences with the closure habit and the
  character; this is the sentence a planner reads.
- **aliases** (plan 05): other spellings and other-language names, never the
  name itself.
- **Tours**: `passes` in ride order; `waypoints` closed for loops (last =
  first); `km` and `elevationGain` from a trusted source until plan 11 item 8
  computes them.
- **Towns**: `why` is one sentence naming the surrounding passes and the
  infrastructure (workshop, rental, bike hotel).
- **Destinations** (plan 12): follow `docs/destinations.md` once it exists.

## Adding or moving a pass: the checklist

This is the whole procedure. Nothing else has to be remembered; every step
below is either a command or a look at its output.

1. **Write the entry** in `data/passes.json` per the rules above. For the pass
   coordinate, take the point where the road crosses the summit from the map
   (OSM `mountain_pass` node, or the top of the road for toll and summit
   roads) – four decimals are enough.
2. **Ask the data where the point belongs** before spending anything:
   `bun run data:locate <slug>`. It prints the DEM height at your point and
   its distance to the nearest road, then the OSM pass and saddle nodes
   nearby with the same two measurements each. Your point should read ✓ ✓
   (height within 80 m of `elevation`, road within 100 m). If a candidate
   carries the pass's name and reads ✓ ✓ where yours does not,
   `bun run data:locate <slug> --apply` moves the point for you; anything
   less clear-cut it leaves to you, with the numbers on screen.
   If the answer is "kein mountain_pass/saddle-Knoten im Umkreis", the entry
   is a toll or summit road: set `roadSummit: true` on the `pass` and run the
   command again – it then offers the highest point of the stored route, which
   is the right point for such a road, and `--apply` takes it. A `spur` needs
   no flag, it is asked that way already; for a traverse type the command only
   prints the two measurements, because its marker is a curated point and
   there is no better candidate to propose.
3. **Build:** `ORS_KEY=… bun run data:build`. The pass point is measured first
   (DEM and road distance, two cheap requests) and its ascents are routed only
   if both pass; otherwise the run says so and names `data:locate`.
4. **Check:** `bun run data:check`. Read every line that names your slug – a
   rejection tells you the measured value that broke a limit, and the three
   ways out are below. After a fix, run `data:build` again; the rejection is
   retried by itself because its inputs changed.
5. **Look:** open the pass in the app (`preview-app` skill or `bun dev`). The
   drawn ascent must follow the road and end at the marker, the profile top
   must match the elevation.
6. **Commit `data/*.json` and `data/generated/*.json` together.**

Without the network step 2 cannot run; the build then does the same two
measurements itself and simply holds the ascents back until the point is
right, so nothing wrong is routed either way.

## Loop

```bash
bun run data:check                 # before: is the file well-formed and referenced?
bun run data:locate [slug…]        # where does the pass point belong? (network)
bun run data:build --status        # what will be fetched and what it costs
ORS_KEY=… bun run data:build       # cycling profile; without the key OSRM car profile
bun run data:check                 # after: is what came back plausible?
bun run data:check --explain       # every route with its measured values
```

- Never edit `data/generated/*.json` by hand. To force a re-fetch, delete the
  key from the generated file and run the build. A moved pass coordinate needs
  no such step: `summits.json` remembers where each DEM height and road
  distance was read and the next build re-measures it, and a pass whose point
  is more than 80 m off in height or more than 100 m from a road is not
  routed at all until the coordinate is fixed.
- Open the pass in the app (`preview-app` skill or `bun dev`) and look at the
  drawn ascent: it must follow the road and end at the marker, the profile
  top must match the elevation. If not, the `from` point or the pass
  coordinate is wrong, not the router.
- Respect the quotas in the header of `scripts/build-data.ts`. A local run is
  for verifying one or two new entries; for a real backlog use
  `ORS_KEY=… bun run data:backfill`, which batches it across Open-Meteo's
  hourly window until nothing is missing.

## The route quality gate

No route is stored unless it passes these checks (`scripts/lib/validate.ts`).
They were fitted to the routes that already existed, so each one separates the
demonstrably right from the demonstrably wrong rather than sitting on a round
number.

**Measured by type.** `minPeakAt` and "ends at the summit" are the right
checks for a climb and the wrong ones for a road that stays up or cuts across
a wall. So a `pass` or `spur` ascent is measured as a climb, and a `plateau`,
`balcony` or `valley` ascent is measured the way a tour is – between its two
curated ends and against its stated length. That is why a traverse ascent
carries two more curated numbers, and only a traverse ascent may:

```jsonc
"ascents": [{
  "from": { "lat": 45.05, "lon": 5.35 }, "label": "Saint-Jean-en-Royans",
  "to": { "lat": 44.99, "lon": 5.27 },   // where the ride ends
  "km": 17                               // its length, from a trusted source
}]
```

A `check` follows the same split: a climb may widen the ascent limits, a
traverse the tour limits, and nothing else – a limit its own validator would
ignore cannot be written down.

| Check                            | Applies to              | Limit                               | Catches                                               |
| -------------------------------- | ----------------------- | ----------------------------------- | ----------------------------------------------------- |
| Ascent length                    | `pass`, `spur`          | ≤ 60 km                             | a router that took the valley instead of the pass     |
| Start of the route               | `pass`, `spur`          | ≤ 2 km from `ascent.from`           | a `from` point nowhere near a road                    |
| End of the route                 | `pass`, `spur`          | ≤ 500 m from the pass coordinate    | a route that stops short                              |
| Profile top vs. `pass.elevation` | `pass`, `spur`          | within 80 m                         | a wrong summit coordinate, or the wrong road          |
| Position of the highest sample   | `pass`, `spur`          | in the last 25 % of the distance    | a route that crosses the pass and carries on          |
| Elevation gain                   | `pass`, `spur`          | ≤ 3 000 m                           | a route over several passes                           |
| Length vs. the curated `km`      | traverse ascents, tours | within 15 %                         | waypoints too sparse to pin the line down             |
| Start/end                        | traverse ascents, tours | ≤ 2 km from the first/last waypoint | a route whose ends are not where the curator put them |
| DEM height at the marker         | every type              | within 80 m                         | a coordinate on the wrong summit                      |
| Marker to the nearest road       | every type              | ≤ 100 m                             | a coordinate beside the road                          |

### When the gate rejects something

A rejection is a warning in `data:check`, not an error: nothing wrong reached
the map, and what is left is curation. `rejected.json` names the key, the reasons with their measured values, the date
it was first rejected and which router produced it. An unchanged geometry on a
retry is stated explicitly – it means the router is not the problem. There are
three ways out, in this order of preference:

1. **The data is wrong.** Almost always the case. Move the pass coordinate onto
   the road at the summit, or `ascent.from` into the valley village, then
   `bun run data:build`. The rejection remembers the inputs it was routed for,
   so the next build retries it by itself – and only then; a rejection whose
   inputs and limits are unchanged is not asked again, because the answer would
   be the same. This is free: re-routing costs no Open-Meteo calls and the
   profile is reused when the geometry comes back unchanged.
   `--retry-rejected` forces a retry regardless, for the case that the
   router's map data changed. The tell-tale of a wrong pass point: _both_
   ascents end at the identical distance from it (Großglockner 535 m,
   Couillole 1.6 km) – two roads cannot be wrong by the same amount.
2. **The ascent really is like that.** Kitzbüheler Horn ends at the Alpenhaus
   below the summit marker. Set `check` on that one ascent with the widened
   limit and a `note` saying why. A `check` without a `note` fails the schema.
3. **The limit is wrong.** Change `LIMITS` in `scripts/lib/validate.ts` and run
   `bun run data:check --explain` to see what that does to every other route
   before re-fetching anything. Do not widen a limit to silence a single case –
   that is what step 2 is for.

A rejection next to a stored route ("ORS-Kandidat abgewiesen … die osrm-Route
bleibt") is the upgrade pass having asked ORS for a car-profile route and the
gate having refused the answer – ORS routes around roads it considers unfit
for road cycling (Mont Cenis from Susa, Sampeyre, Grosse Scheidegg). The OSRM
route stays on the map and gets its profile; nothing is lost, and the same
three ways out apply.

## Honesty

The scales dialog promises that scales are editorial and the status is a
heuristic. Keep it true: no invented precision in `classicAscent`, no season
window narrower than the road authority's habit, and a `note` that says when
the data is uncertain.
