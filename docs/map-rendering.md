# Map rendering

MapLibre is the page, so its rules are load-bearing: what the camera does when
a selection arrives, what is drawn and in which order, what answers the
pointer, where the colours come from and which two workarounds the library
needs. `AGENTS.md` links to each section and keeps the one-line version.

The panels in front of the map are described in
[`ui-conventions.md`](./ui-conventions.md); why the geometry arrives as static
files rather than as props is in [`architecture.md`](./architecture.md).

## The camera

### The padding is never set on its own

What the panels cover reaches MapLibre as camera padding, and padding is not a
passive margin: the centre is drawn in the middle of the _padded_ box, so
`setPadding` – a `jumpTo` – moves the picture by half of what changed. On a
phone that is the detail sheet's 55 % of the screen in one frame, a jump at the
start of every selection. So a selection carries the new padding into its own
flight (one movement instead of a jump and a movement, which is also why a pass
or a tour is framed with `cameraForBounds` + `flyTo` rather than `fitBounds`:
that one drops the padding before it flies, and the frame has to be measured
against where the camera lands – `fitInset` in `lib/map-camera.ts`), and a
padding change with no camera move behind it – a sheet dragged to another snap
point, the sidebar folding away – eases in. Only the first padding is set
outright, before the map has drawn a frame that could jump. Which is also the
rule while a flight is in the air: it owns the padding until it lands. The
panels can ask for another one meanwhile – a sheet dragged to a different snap
point, a phone's toolbar changing the viewport height by four pixels – and
easing to it there would cut the flight short a frame before it arrived, so
what is still owed is applied on `moveend` instead. The panel claims its share
one commit _before_ the camera sets off, which is what keeps that opening
still: a padding the map has not applied yet cannot move it.

What the padding is _made_ of is a second question, and it has one answer:
`shellGeometry` (`lib/shell-geometry.ts`), a pure `(bars, viewport, sheet,
panels) → { inset, vars }` with its own unit tests. The same numbers
feed the camera and, as the `--shell-*` custom properties `vars` carries, the
Tailwind classes the panels and the season card are laid out with – so a panel
width exists once rather than twice, and `sheetCover` converts Base UI's two
ways of spelling a snap point plus the drawer's own `--drawer-inset`, which is
measured off a mounted popup (`useSheetInset`) rather than copied out of a
generated file.

What the map asks the _device_ is one prop as well: `MapEnvironment`
(`lib/use-media-query.ts`) carries the colour scheme, whether the pointer is
coarse, whether motion is unwanted and whether the shell is the phone one.
`appLayers` takes it as an argument, which is what finally makes it the pure
function its doc comment always claimed; a scheme change is a re-render rather
than a listener the map registers on its own, and `window.matchMedia` appears
nowhere else.

None of that is a property of the padding: it is a property of what the camera
is doing at the moment the padding changes. So the rules are one transition
table, `camera(state, event, env) → [state, commands]` in `lib/map-camera.ts`,
and `pass-map.tsx` only turns what happens – a selection, a new inset, a shared
link, `moveend`, the delay timer, the style parsing – into events and hands the
commands to `applyCamera` (`components/map/apply-camera.ts`), the one place the
MapLibre camera methods are called. A whole selection is therefore a list of
events in a unit test, with no WebGL in sight, which is where the traces below
are pinned (`lib/map-camera.test.ts`).

| State        | Event                    | → State    | Commands                        |
| ------------ | ------------------------ | ---------- | ------------------------------- |
| `cold`       | `intent`                 | `cold`     | –                               |
| `cold`       | `inset`                  | `cold`     | – (collected for the first one) |
| `cold`       | `ready`                  | `idle`     | `setPadding`, `fitBounds`¹      |
| `idle`       | `ready` (not yet fitted) | `idle`     | `fitBounds`¹                    |
| `idle`       | `inset`                  | `idle`     | `easeTo` unless `sameInset`     |
| `idle`       | `moveend`                | `idle`     | `writeHash`                     |
| `idle`       | `selection`              | `awaiting` | `schedule`                      |
| `awaiting`   | `inset`                  | `awaiting` | – (the flight will carry it)    |
| `awaiting`   | `moveend` (not by hand)  | `awaiting` | – (an older flight landing)     |
| `awaiting`   | `moveend` (by hand)      | `idle`     | `cancel`, `writeHash`           |
| `awaiting`   | `selection`              | `awaiting` | `cancel`, `schedule`            |
| `awaiting`   | `delay`                  | `flying`   | `flyTo`²                        |
| `flying`     | `inset`                  | `flying`   | – (the flight owns the padding) |
| `flying`     | `selection`              | `awaiting` | `schedule`                      |
| `flying`     | `moveend`                | `idle`     | `writeHash`                     |
| `flying`     | `moveend` (padding owed) | `settling` | `easeTo`                        |
| `settling`   | `moveend`                | `idle`     | `writeHash`                     |
| any but cold | `requestedView`          | `idle`     | `cancel`³, `jumpTo`             |

¹ Only with nothing in the link to open on, and only once there is something to
frame. ² With `easeTo` instead when the map has no frame and no point for the
selection – what it cannot frame still owes the panel its space. ³ Only when a
flight was scheduled.

The last row is a hash pasted into an open page and nothing else: the hash the
page opened on reaches the machine as the `intent`, never as a `requestedView`
(`load` in `lib/app-state.ts`). Both at once would cancel the very flight the
link's own selection scheduled.

Two of those rows are bugs that the shape of the thing prevents rather than
fixes. A flight for A landing inside B's delay window settles nothing, so it
can no longer ease A's leftover padding into the flight B is about to make; and
the hash is written once per settled flight rather than once per frame the
camera came to rest on.

### The panel opens with the tap; the camera follows it

Selecting answers a question about a pass, not about the map, so `DetailPanel`
gets the selection in the same frame as the map's layers, the highlighted row
and the hash (`selection` and `last` in `lib/app-state.ts`, two values: what is
selected and what the leaving sheet keeps showing). The flight is the slower half:
`pass-map.tsx` leaves the panel `SELECT_DELAY` to draw and then takes
`SELECT_MS` – longer than the 500 ms it was, because nothing waits behind it
any more – to get there. It ran the other way round first: the map flew and the
panel opened on arrival. The reason was real – the panel is the most expensive
thing the app draws (the photo slideshow, the elevation profiles with a polygon
per sample, the climate chart with recharts behind it), and on a phone-sized
viewport drawing it into a flight cost that flight about a third of its frame
rate – but the cure put a wait in front of the answer to buy a smooth camera
movement, which is the wrong way round. Opening first and moving after keeps
the two out of each other's frames just as well, and what waits is now the half
nobody asked for. Everything that is still on its way when the panel opens
keeps its own height while it waits, so nothing below it ever jumps: the
profile skeleton has the drawing's aspect ratio (`PROFILE_ASPECT`) and the
chart's `next/dynamic` placeholder its height (`CHART_HEIGHT`, a module of its
own so the placeholder does not import recharts). The selected row is put into
view without a smooth scroll in the sheet layout: the detail drawer is usually
in front of the list when it happens, so it would animate a list nobody can see
against the drawer animation that can be seen.

### A selection is framed, not centred

What makes a pass worth a holiday is the road up to it, and both sides of a
traverse are what "over the Galibier" means, so selecting one fits the box of
all its ascents (`passBounds`, precomputed next to `tourBounds` in
`lib/map-assets.ts`) instead of centring on the marker – `PASS_MAX_ZOOM` keeps
a short climb from filling the screen with two hairpins, and a pass the map
draws no ascent for falls back to its point. The box has to fit between the
shell's two bars, which are translucent but no less opaque to a reader: the
header's and the season bar's measured heights are the map's top and bottom
padding at every width (`useHeight` in `components/shell.tsx`; on desktop the
bar is
a card and its gap from the edge counts too). On a phone the detail sheet takes
55 % of the screen on top of that, and it is the larger of the two at the
bottom that counts. All of it is one calculation, `shellGeometry` in
`lib/shell-geometry.ts`.

### The map opens on the home range

With nothing in the link the map opens on the frame around what it draws –
but of the home range only (`HOME_RANGE` in `lib/regions.ts`, the Alps), not
of everything. The Alps and the Pyrenees are 600 km apart, and a first
screen that held both would show neither: the alpine dots would be a smear
at zoom 5. So `buildScene` carries two boxes, `bounds` around everything
drawn – what the fit button frames, pressed on purpose – and `opening`
around the home range's roads and loops, which is what `onReady` in the
camera fits (plan 26). A loop is at home where its passes are
(`TourRow.range`), the one definition `data:check` and the frame guard read
too; with nothing of the home range drawn, a Pyrenees chip pressed say, the
opening frame is what is drawn. `lib/default-frame.test.ts` holds every
range's own frame to a readable zoom at a laptop's viewport under the
sidebar, so a range whose roads spread too far to read fails the build
rather than the visitor. The other ranges are reached through their chip,
the search and a shared link; a link carrying a range chip opens fitted to
what it lists, like every link without a camera.

## What is drawn

Bottom to top, and because MapLibre places labels from the top of the style
down, this is also the collision priority: a pass label wins against a town
name, and both win against the basemap's own place names.

```mermaid
flowchart TB
  L9["app labels · profile cursor"]
  L8["passes · towns (marks)"]
  L7["ascents — solid, status colour on a paper rim, green over orange over red; unpaved ones dashed over it, their open dots ringed"]
  L6["tour tubes — a rim in one calm tone around a pale inside, the tour's colour when pointed at; arrows on the selected one"]
  L5["the hovered town's reach hull"]
  L45["area outlines — a faint fill and edge in the area blue, the name where there is room"]
  L4["raster overlays (optional base, cycling overlay)"]
  L3["basemap lines and labels — rivers, borders, roads, peaks, places"]
  L2["hillshade — Terrarium DEM"]
  L1["basemap fills — land, built-up, wood, glacier, water"]
  L9 --- L8 --- L7 --- L6 --- L5 --- L45 --- L4 --- L3 --- L2 --- L1
```

An area is drawn as the padded outline of what it holds
(`DestinationMembers.outline`, `docs/destinations.md`) under everything else
of the app's, at every zoom, in the area colour (`--area`, the town's blue
family – never a status colour). Past `DESTINATION_MAX_ZOOM` the roads are
the picture, so the fill thins to a trace and the edge to a hairline; the
selected or hovered area keeps its weight, and its hit layer is the last
group `pick` asks. The fill and its edge read the
polygon source, the name a point source of its own – a polygon labels
itself once per tile, which put the name two or three times into one
outline – at `DestinationMembers.label`, the spot inside the outline with
the most room (`labelSpot`, `docs/destinations.md`), not at the centre,
where it lay on the very dots it was about.

### Status first

What the map is read for is the status in the chosen half-month, and of
that, where one can ride; whether a road is a classic comes second. So
every overlap is settled in that order, and nothing else is.

- **Rideable on top.** A pass dot's `circle-sort-key` is its fame minus a
  status step (`statusFirst` in `components/map/app-layers.ts`), so a green
  dot lies over an orange one and both over a red one, whatever their fame.
  The ascents cannot be sorted that way – status is feature state, and a
  sort key is layout – so they are three line layers, closed, risky, open
  from the bottom (`ROUTE_LINES`), each filtered to its roads by
  `Scene.routes.byStatus`; the casing under them stays one layer. A closed
  ascent is thinner too.
- **Two sizes, not five.** A dot is large for a classic (`CLASSIC_FAME`)
  and small for every other road (`DOT_FAME`), in any status: a red classic
  is a large hollow ring. A scale of five sizes was one more thing to decode
  and said less than the colour next to it.
- **Names for what can be ridden.** On a fine pointer a road that is often
  closed in the half-month carries no name until it is pointed at – its thin
  ring says enough, and its name took the room a rideable road's needed. A
  finger has no hover to bring the names back, so on a coarse pointer every
  road keeps its name once its zoom is reached. What is selected or a favourite is named in any
  status. Within one rank's label layer, open names are placed before risky
  ones (`symbol-sort-key`); across ranks the ladder below still decides.
- **Below zoom 8 a road's name is what pointing at it says.** Under
  `ROAD_NAME_ZOOM` (`lib/prominence.ts`) no road carries a name at rest, not
  even a classic – the selected one and the favourites aside; pointing at a
  road opens its area's fan, which names it (below). Under `OVERVIEW_ZOOM`
  the areas carry no names either. On a phone, eighty area names and every
  classic were most of the picture, and a map of names said less than one
  of colours. The dots, lines and outlines are all there; only the names
  wait, as they already join by rank.
- **A phone names by zoom, not by pointing.** A finger cannot point without
  pressing, so a phone has no fan: a tap opens the panel. Instead the
  classics are named from `CLASSIC_NAME_ZOOM_COARSE` (7), the other roads
  join by rank from zoom 8 as on a desktop, closed ones included.
- **Short names on the overview.** Between `ROAD_NAME_ZOOM` and `SHORT_NAME_ZOOM` a name is
  written without the generic word in front – "Galibier", not "Col du
  Galibier" (`shortName`, `lib/prominence.ts`) – unless what is left would
  read as a town or a word (`KEEP_WHOLE`); the label can stand on any of
  eight sides of its dot.
- **The rest steps back.** At rest every tour is one calm tone (`--tour`),
  so its colour cannot be mistaken for a status – a third of the tour
  colours sat in the red and orange hues; the pointed-at or selected tour
  takes its own colour. Towns are smaller and paler on the overview, and an
  area is a faint trace with a one-line name.

### The fan names a crowded area at its edge

Where roads crowd – the Dolomites at zoom 7 – MapLibre keeps a few names
and drops the rest. Pointing at an area, or at a road, town or loop in it,
lays every road, town and loop of it the filters draw out in two columns
beside its outline instead, each name with a thin line to its mark – a
loop's line ends at the point of it nearest the area's centre: the margin
labels of a printed map, made interactive (excentric labelling). It is
their hover label – what the fan names gets no popup of its own, and the
name the pointer is on, in the fan or on the map, says what the popup would
have: a road's height, a town's labels, a loop's length and climb. Road and
town names on the map step aside while the fan names them. It is never there
at rest, because two dozen leader lines on every area would be the clutter
it is meant to clear, and the map around it is left as it is: a veil that
dimmed the rest made every hover a change of the whole picture. Pointing at
a road also lights its area's outline, so the fan is seen to belong to it.
An area with a single drawn mark has no fan – that mark keeps its popup –
and phones have none at all (above).

Close in, the fan steps aside again. Once an area's larger side on the
screen is more than `FAN_FIT` (40 %) of the shorter side of what the panels
leave of the map (`fanFits`), one stands in the area rather than before it:
its marks are far enough apart to carry their own names, and lines from its
edge would cross half the screen, so every mark has its popup back. A fixed
zoom could not say this – the areas run from 10 to 120 km across, and
windows differ – while the share takes zoom, area and window in one measure:
on a laptop a middling area turns at about zoom 8.5, the Dolomites' around 9,
a small one at 10. It is worked out from the area's box and the zoom the
pass map takes at the end of each zoom, so the scene stays a pure function.

A road can lie in up to three areas. It opens one, its _primary_ area: the
one whose centre is nearest (`areasOf`). A loop's position is the middle of
its box; a loop through more than `TOUR_AREAS_MAX` areas is a journey
rather than a part of one, and opens none – its tube says enough.

`lib/fan.ts` decides both halves: which area is fanned out (`fanTarget` –
the one pointed at, or the primary area of the road, town or loop pointed
at, the open one first if it holds it; the open one while the pointer is on
its names; else the one in the panel) and where each name stands
(`fanLayout` – the side by the outline's middle, a column sorted by height
so the lines do not cross, the rideable roads and the classics kept when
the screen is short and the rest counted, each column held on the screen).
`buildScene` makes that choice once (`fanDecision`), offering a road only
the areas that have a fan to open, and from the same choice drops the popup
of a road the coming fan will name and lights the outline it belongs to – so
the fan, the labels and the outline cannot disagree. It hands the choice to
the pass map as `Scene.fanNext`, which the open fan follows after its delay,
and the open area with its drawn roads as `Scene.fan`, marking those roads
`fanned` in their feature state (`PassState`) so their own labels fade out –
state, not a property, because a property would re-tile the passes source on
every area the pointer crosses.
`components/map/fan-overlay.tsx` draws it as HTML over the map, not as a
layer: it projects the points again on every camera frame, and the names are
buttons – pointing at one rings its road, pressing it opens it. The pass map
opens a fan `FAN_OPEN_MS` (150 ms) after the pointer arrives, so a pointer
crossing the map on its way somewhere opens nothing, and waits
`FAN_RELEASE_MS` before it closes one, so the pointer can cross from a dot
to a name.

### A tour holds its ascents; it does not sit beside them

A tour _is_ the union of several ascents – the Sellaronda is its four passes –
so it is drawn as what it is: a tube the ascents run inside, wide enough to
reach past them on both sides. What a tour contains is then read from the map
rather than from the list, which a mark running alongside the ascents cannot
say. The tube is three lines: the wall – one calm tone shared by every tour
at rest (`--tour`), the tour's own colour once it is pointed at or selected
– a narrower paper
line over it that leaves only a rim of the wall showing (`TOUR_PARTS.inside`),
and the road itself along the middle (`TOUR_PARTS.road`), thin, for the
stretches between two ascents. The ascent keeps the solid line and the opaque
status colour on top; it is the rated thing, the tour is the frame around it.

An outline rather than a band, because a band has to be told apart from the
ascent on it by texture. The hatch that did that until October 2026 broke into
a chain of blocks in every switchback and meant nothing – a dashed line says
"unpaved" on the ascents, so the same dash on a tour said something false. A
wall follows a hairpin with a round join and says "everything in here belongs
together", which is what a tour is.

Every wall of every tour is drawn before any inside, so two tours on the same
road merge into one tube with both colours on its rim – the road is shared,
and the picture says so instead of stacking two bands. The inside is 80 %
opaque: a breath of the wall's colour tints it, so a tour stays recognisable
along a road its ascents cover completely, at the cost of the hillshade in a
strip about a dozen pixels wide.

The ascents carry a paper rim of their own (`ROUTE_CASING`), the same edge the
tour's inside gives them, so a road is one kind of line on the whole map
rather than a cased one inside a tour and a bare one outside it; on its own the
rim lifts the status colour off the hillshade.

The tour that is selected or pointed at shows which way round it is ridden:
arrowheads along the line (`TOUR_PARTS.arrows`, a signed-distance image painted
in the tour's colour with a paper halo), over the ascents, because on a loop
like the Sellaronda the ascents are nearly all of it. The line runs the way the
tour is ridden because its geometry is routed through `waypoints` in order, so
the order of the waypoints in `data/tours.json` is a statement about the
direction. The arrows are not drawn on every tour: across a region they would
be noise laid over the status colours. Feature state cannot reach a layout
property, so the other tours' arrows are placed and painted transparent.

### Translucent lines need `line-layer-opacity`, not `line-opacity`

MapLibre draws a line as one triangle strip, so a bend tighter than the line is
wide runs the strip over itself. `line-opacity` is applied per feature, so
every such overlap composites twice and a switchback fills with blotches;
`line-layer-opacity` (MapLibre GL JS 6+) flattens the layer to a single surface
first and composites that once, which is what makes a translucent line usable
in a hairpin at all. It is data-constant – zoom and global state only, no
feature state – so anything per-feature has to be carried by width or colour
instead. `line-gap-width` has a second, purely geometric failure in the same
bends, folding its inner side inside out; there is no property that fixes that
one, so offset lines stay out – a tour's tube is a wide line with a narrower
one over it for that reason, not a gap. Widths interpolate with the zoom and grow again
for the selected tour; because a zoom expression may only be the input of the
_outermost_ stop function, the selection case goes inside the stops
(`tourWidth`) – the same reason the pass hit radius is one `interpolate` with a
`max` per stop rather than a `max` around one.

### The filters decide what is drawn, the zoom only how

Which roads and tours the map draws is the filters' business and nobody
else's: every chip says what it leaves, the app opens on the classics, and what
the filters leave out stays as a shadow (below). The zoom never adds or removes
a dot, a hit area or a tour. An earlier version thinned the overview by rank
below zoom 10, with a corner line saying which level was showing; it read as a
second, hidden filter – a road the list held and the map did not – and is gone.

What the zoom still decides is how the drawn roads read. A dot's size
interpolates between `SIZE_ZOOMS` in its class (classic or not, above), the
names are short below `SHORT_NAME_ZOOM`, and they join
by rank on a ladder of their own (`PASS_LABELS` in `lib/layer-ids.ts`), because
two hundred dots fit on an overview where two hundred names do not. The rank is
the fame, moved by two editorial facts the data already holds (`rankOf` in
`lib/prominence.ts`): a road that leads over nothing – a spur, a valley, a
balcony, a plateau – counts one step lower, because a dead end is a detour from
a base and not what a region is chosen for; a road of beauty 5 counts one step
higher, because it is. The classics (fame 4 and 5, `CLASSIC_FAME`) are never
moved. What is selected or a favourite is named at every zoom, and MapLibre
resolves what collides.

### What the filters leave out stays as a shadow

The app opens on the classics (`DEFAULT_FILTERS.minFame` is `CLASSIC_FAME`),
and a road the filters leave out is not wiped off the map: it stays as a small
dot in the ink at half strength (`LAYERS.ghost`, `Scene.ghosts`), without
status, ring or name, and from zoom 8 its ascents are a grey hairline under
everything (`ROUTE_GHOST`, one layer opacity, `Scene.routes.ghosts`) – the
valleys stay a network of roads, and none of it competes with a status
colour. Not on the overview, where three hundred hairlines would be a grey
felt; the dot itself is there at every zoom. A map that showed only
forty-five dots would say the rest of the Alps is empty; a grey speck says
there is more here, and where. The shadows are every road the half-month
grades less the ones the list holds, whatever filter left them out. They lie
under every line and mark the filters kept and lose the pointer to all of
them, and to an area's name too, which a couple of hundred grey dots on the
overview would otherwise swallow (`HIT_GROUPS`), but they answer it: the hover
label adds "nicht im Filter", and a click opens the road, which is then drawn
whole – dot, ascents and all – while it is selected. A tour the filters
leave out has no shadow, but once it is selected (from the search or a link)
its tube is drawn like any other, because the panel already shows it.

## What the map draws is a value

```mermaid
flowchart LR
  E["rows · shown · selection · hovered<br/>(components/explorer.tsx)"] --> B["buildScene<br/>lib/map-scene.ts"]
  L["LAYERS<br/>lib/layer-ids.ts"] --> B
  B --> S["Scene: filters · feature state ·<br/>point features · ring, lines, hull, label · bounds"]
  S --> A["applyScene(host, prev, next)<br/>components/map/apply-scene.ts"]
  A -->|"only what changed"| M["setFilter · setFeatureState ·<br/>setData · the popup"]
```

The map draws a value, not the result of a handful of effects. `buildScene`
takes the three lists of rows, the "auf der Karte" switches, the selection and
the hover and returns one `Scene`: which ascents and tours the filters let
through, the feature state of each of them, the pass and town features with
the properties the style paints from, the hover surfaces – the ring, the wider
lines, the reach hull and the label – and the box a fit frames. It is pure, so
what the map shows is tested without a WebGL context (`lib/map-scene.test.ts`).

`applyScene` is the only place `setFilter`, `setFeatureState` and `setData` are
called, the sibling of `applyCamera` and the same shape: a host, a value and no
decisions of its own. It hands MapLibre the difference between the scene it
applied last and the one it has now, because a scene is rebuilt on every render
and a `setData` on a source of two hundred points re-tiles it in the worker – a
hover that changes nothing has to cost nothing, which a recording host pins
down in `components/map/apply-scene.test.ts`. An id that leaves the scene needs
no write: its line is filtered out, and when the filter lets it through again
it is missing from the applied scene and written in full.

One hover, therefore, for both halves of the screen. The map's pointer reports
what it is over and paints nothing itself; the row in the list reports the same
way, and both are answered by the same scene – which is why a town hovered in
the list now outlines what it reaches, as one hovered on the map always did.
The label points at the entity rather than at the pointer: a hit on an ascent
is a hit on its pass, so it stands where the ring does, and a tour, which has
no point of its own, is labelled at the centre of its box. On a coarse pointer
there is no label at all – a finger that touches a mark has already tapped it,
and a popup under it would cover what was just tapped.

Every layer id lives in `LAYERS` (`lib/layer-ids.ts`): per kind the mark, the
names beside it and the transparent hit layer, with the pass labels generated
from the same fame ladder the style builds them from. The style, the applier,
the pick and the e2e read that one table, so a layer renamed or a sixth fame
level added cannot quietly stop answering the pointer.

## What answers the pointer is not what is drawn

```mermaid
flowchart LR
  Q["pointer at x, y"] --> R["one queryRenderedFeatures<br/>over every *-hit layer"]
  R --> P["pick(features, at, project)<br/>lib/map-pick.ts"]
  P --> G["HIT_GROUPS decides,<br/>nearest mark wins inside a group"]
  G --> A["1 · marks — pass dot, town dot"]
  G --> B["2 · names — the label layers"]
  G --> C["3 · lines — ascent before tour band"]
  G --> D["4 · areas — the name, then the outline"]
```

A pass dot is a few pixels across and an ascent line 3.5 wide, so every kind
carries a transparent hit layer over its mark (`*-hit` in `appLayers`): a disc
per point, a wide line per route, sized from the pointer – about 44 px on
touch, half of that with a mouse – and never narrower than the mark plus a
margin. A name is part of its mark: the label layers answer the pointer too.
Because several layers answer for the same pixel, there is no handler per
layer: the map runs one `queryRenderedFeatures` over all of them and asks
`pick` which single entity a hover or a click means. `pick` decides over plain
records – a layer id, a slug, a point – and a `project` function, so the rule
behind every click is tested without a map (`lib/map-pick.test.ts`).
`HIT_GROUPS` spells the priority out rather than taking it from the style,
because the two disagree – marks before names before lines, and the tour band
lies _under_ the ascents but reaches past them, so a click inside it hits both
and the ascent is the more specific answer; an area is the least specific
answer there is, so its outline only answers where nothing else does – and
within a group the mark nearest the pointer wins. An ascent is answered as its pass: the hit's kind
comes from the layer that answered, and the route layers belong to a pass. A
hit layer needs the same filter as the layer it widens, or a hidden tour still
answers, which is why both carry the same scene field. The hover popup is a
label, not a target: it is suppressed on a coarse pointer and click-through
everywhere (`app/globals.css`).

## Colours and the basemap

### Colours only via tokens

MapLibre cannot read CSS variables; the map reads them once via
`getComputedStyle` (`readColors` in `components/map/app-layers.ts`, the module
that holds every paint expression). Add new map colours there rather than
hard-coding them.

What is painted before there is a document to read – the generated basemap
style, and the icons, the share image and the manifest in `lib/brand.ts` –
cannot do that, so `TOKENS` in `lib/palette.ts` carries the tokens as sRGB and
everything outside the document reads that one table. It is a copy, and a copy
is only allowed to exist while something says when it has stopped being one:
`bun run palette` (`scripts/check-palette.ts`, inside `bun run lint`) converts
every `oklch()` in `app/globals.css` and fails on a difference. The two copies
that preceded it – one in `lib/palette.ts`, one in `lib/brand.ts` – had drifted
from the stylesheet and from each other over every token they shared, which is
the whole argument for the check. The rest of `PALETTE` is the basemap's own
tones (land, water, wood, roads, its labels): chosen against the tokens, not
derived from them, and so not part of the comparison.

### The basemap is generated, and it follows the OS scheme

The default base is a vector style painted from the app's own palette
(`lib/basemap.ts`, colours in `lib/palette.ts`), tiles from OpenFreeMap, no
key. Layer stack, bottom to top: the basemap's fills (land, built-up, wood,
glacier, water), the hillshade from the Terrarium DEM, the basemap's lines and
labels (rivers, borders, roads from zoom 6 to minor roads at 11, road names at
12, lakes, peaks with elevation at 10, places), the raster overlays, then the
app's own layers (the area outlines, the hovered town's reach, the tour
bands, the ascents on top of them, towns, passes, labels, profile cursor). MapLibre places labels from
the top of the style down, so that order is also their collision priority: a
pass label wins against a town name, and both win against the basemap's own
place names. Roads are thin and neutral and there are no POIs: the mountain
roads that matter are the app's lines, and the status and tour colours are what
should dominate. Labels prefer the name in the page's language. The raster alternatives (OSM,
OpenTopoMap, CyclOSM, Esri, satellite) stay in the layer popover; a raster base
is one layer below the hillshade. Switching base or scheme never rebuilds the
map: `applyBase` (`components/map/app-layers.ts`) swaps only the layers whose id starts with
`base`, and a `prefers-color-scheme` change re-reads the tokens, repaints the
icons and sets every paint property of the app's layers again from the same
`appLayers` definition the style was built from – camera, sources, filters and
feature state stay. Glyphs are served from `public/map/fonts`: the Latin ranges
of Inter, the UI's own face, rasterised once into MapLibre's glyph atlases by
`scripts/build-glyphs.ts` and committed – so map and panels share one family,
the hermetic e2e suite renders labels and the map has no font server to wait
for; `scripts/build-map-style.ts` writes the same style as four standalone
JSON files, a scheme and a language each, for tuning in a style editor.

## MapLibre needs two workarounds

Its web worker is resolved via `import.meta.url`, which Turbopack does not
serve, so `scripts/copy-maplibre-worker.ts` copies the worker into
`public/maplibre` (git-ignored, runs before `dev` and `build`) and
`pass-map.tsx` calls `setWorkerUrl`. And computed CSS custom properties come
back as `lab()`, which MapLibre cannot parse; `toRgb` in
`components/map/app-layers.ts` converts them through a canvas pixel before they
reach the style.
