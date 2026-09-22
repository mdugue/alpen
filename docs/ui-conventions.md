# UI conventions

How the interface is built and why it is built that way. The rules here are
binding for anything under `components/` and `app/`; `AGENTS.md` links to each
section and keeps the one-line version.

The map's own rules – camera, layers, hit testing, basemap – live in
[`map-rendering.md`](./map-rendering.md); what the page is allowed to ship and
how it is cached lives in [`architecture.md`](./architecture.md).

## The component layer

### shadcn/ui, style "mira" (`base-mira`)

`components/ui/` holds the official components generated from the preset
(`bun run ui:init`, `bun run ui:add`). They are built on `@base-ui/react`, not
Radix, so the API differs from older shadcn snippets: `ToggleGroup` takes
`multiple` instead of `type="multiple"`, `Slider.onValueChange` receives
`number | number[]`, and button icon sizes are `icon-sm`/`icon-xs`, not
`iconSm`. Do not edit files in `components/ui/` by hand; domain-specific
styling (status badges, etc.) goes into the consuming component via
`className`. Re-running `ui:init` overwrites `app/globals.css`; the domain
tokens (`--status-open`, `--status-risky`, `--status-closed`, `--tour`,
`--town`, the strip's `--grade-*` ramp, plus their `@theme inline` lines), the
`--text-2xs` step below Tailwind's `text-xs`, the MapLibre rules at the end,
the coarse-pointer font-size rule next to them, the drawer's `@property` rules
and the sheet-drag rules after it, and the dark-mode setup must be restored
afterwards.

### Sizes come from the scale, not from pixels

Font sizes, spacing and radii are Tailwind steps; an arbitrary value
(`text-[13px]`, `rounded-[3px]`) is only for what the scale genuinely cannot
express, such as a `calc()` width or the inset shadow marking the current row.
The dense map furniture needs one step below `text-xs`, so the scale carries
`text-2xs` (10 px) as a token – add to the scale rather than reaching for a
pixel value.

### Touch targets follow the pointer, not the width

Safari on iOS zooms the page in when a focused form control carries a font size
below 16 px, and on a map that fills the viewport that zoom has no way back. An
unlayered rule at the end of `app/globals.css` gives every control 16 px on a
coarse pointer – unlayered because it has to beat the `text-xs` utilities the
components carry – and `TOUCH_CONTROL` and `TOUCH_ICON` in `lib/utils.ts` grow
the boxes to match, on the same `pointer-coarse` condition (`TOUCH_SELECT` did
the same for a native select and is unused, see below). With a mouse everything
stays as dense as it was. The rule cuts both ways: a control that is _not_ a
text field gains nothing from the 16 px and loses the row's scale, which is why
the app has no `<select>` left – the sort picker is a `DropdownMenu` and the
filters are chips, both ordinary markup the rule never touches.

### Charts come from the shadcn `chart` component (recharts under the hood)

It is the only heavy dependency in the app, so the one chart that uses it
(`components/panel/climate-chart.tsx`) is pulled in with `next/dynamic` and
never reaches the first load. Stat tiles and dense rows use `Item`, stepper
groups use `ButtonGroup`.

## Layout

### The map is the page, and the shell is over it

The map fills the viewport at every width and nothing is beside it: what is
not map is a **translucent surface over** it, so the map runs on underneath
rather than stopping at a card. That is the whole of the rule; the shell
exists inside it.

All of those surfaces are one material, `GLASS` in `lib/utils.ts`, which both
`SHELL_BAR` and `PANEL` build on — one definition, because the moment two of
them carry different numbers the screen grows a seam where the sidebar meets
the header. Its numbers were measured against a deliberately loud backdrop
rather than guessed: at `bg-card/80` almost nothing came through the 12 px
blur and every surface read as a closed plate. It is `bg-card/70` now, with
`backdrop-saturate-150` – the saturation is what carries the map's _colour_
through, and it does more for "the map is still there" than another ten
percent of transparency would, at no cost in contrast. **Never stack two of
them**: two 70 % layers compose to 91 %, which is exactly the opaque white
pill the map tools were until their `ButtonGroup` lost its own fill.

There are exactly two bars. Along the top a `header` (`components/app-header.tsx`)
with the wordmark and **one sentence**: the chosen half-month and what the
passes currently in the list are doing in it ("Anfang Oktober: 34 Pässe in
bester Zeit, 61 gut, 42 eingeschränkt, 64 oft gesperrt"). It is the first
screen's answer to "what is this", it is derived from the same `seasonBand`
the band at the bottom draws, and it moves with every filter – a slogan would
have said nothing and would have been wrong by lunchtime. Below `lg` it drops
the "gut" clause to stay inside two lines. Along the bottom the **season bar**:
the `SeasonBand` (`components/season-band.tsx`), on a phone with the two ways
on – into the list and into the filters – under it. On desktop the same bar is
a **card** of the panels' material at the foot of the map, standing right
beside the panels at their gap and capped at `max-w-xl`: the 24 columns read
as a chart at that width and were a stretched ribbon at the width of a screen,
and the list keeps the full height instead of ending above the bar. What the
three shapes mean is behind the card's ⓘ (a popover) and in the scales
dialog; the card carries no legend beside the band.

MapLibre's own provenance controls – the scale bar and the attribution ⓘ –
stack in the bottom-left corner above the bar on a phone (`--shell-bottom`,
measured in `explorer.tsx`) and sit in one row in the bottom-right corner on
desktop, the one corner the card leaves free (`lg:right-40`): MapLibre fixes a
control's corner when it is added, so `pass-map.tsx` re-adds them when the
layout changes. Before that, the floating sidebar covered them on desktop.
The arithmetic is `shellEdge` in `lib/map-camera.ts`.

The band is the period control _and_ a chart of the current selection. Each of
its 24 columns carries three quantities over the passes the filters leave: bar
height and fill = their mean daily maximum, ribbon = the grade most of them are
in (`RIBBON`, three fills shared with `SeasonStrip`; "oft gesperrt" takes a
light fill rather than the strip's hollow cell, which at ribbon width reads as
a hole), hanging bar = their mean share of days with snowfall. The temperature
bar is deliberately **relative** – its own coldest half-month to its own
warmest – because it is for comparing half-months, not for reading a value off
an axis; the chosen half-month's numbers are spelled out above it. They are
means over summits of different heights, so nothing calls them "the Alps": the
legend says "der gezeigten Pässe". Interaction is one `role="slider"`: click or
drag a column, arrows and Home/End on the keyboard, no stepper buttons. The
"heute" tick sits on the rail and a reset button beside the label.

Between the bars, on desktop, the two floating panels: the collapsible sidebar
(`components/sidebar/`: search, filters, and one list per kind behind a tab
row) and, while something is selected, the detail slide-over next to it. Their
widths are mirrored in `explorer.tsx` (`SIDEBAR_W`, `DETAIL_W`) and fed to
MapLibre as left padding so camera targets stay visible. They live in a middle
`div` that is what is left between the two bars, so neither is told a number to
stay clear of. The sidebar's own toggle is in the header, and the sidebar
carries no brand row of its own – the header owns the `h1`.

What the bars cover of the map is **measured**, not promised (`useHeight`,
`lib/use-height.ts`): both heights are handed to MapLibre as top and bottom
padding, and the bottom one is also written back as `--shell-bottom`, which
lifts MapLibre's own corner controls off the bar. A constant was wrong the
moment the headline wrapped to a second line, which depends on how many digits
the counts have.

**The map's own two corners.** Everything a visitor presses is one group in the
**top-right** (`MAP_CLUSTER`), opposite the panels so the two never meet: the
compass, fit-to-view, and a "…" popover holding base map, overlays and the 3D
switch. The last three are answered once per visit and left alone, so they do
not earn a button each on a phone; `MAP_TOOL` settles the outline. It is one
glass surface with the buttons segmented inside it, not `PANEL` plus padding –
that framed the corner twice and read as a white ring around two buttons.

The **compass is the one tool that is not always there**: a map pointing north
needs no control saying so. It is ours rather than MapLibre's
`NavigationControl`, which cannot be told to hide itself and brings zoom
buttons that a scroll wheel and a pinch both make redundant. Whether it shows
is React state, because it mounts a button; the angle it points at is a ref,
because the needle follows a drag frame by frame and re-rendering to turn an
icon would be the most expensive way to do it.

The **bottom-left** carries what is read rather than pressed: the scale bar and,
under it, who the map is by, both at the smallest weight the scale has. The
attribution is a licence obligation, so it stays on the map behind a single ⓘ –
one clearly identifiable interaction, which is what the OSM attribution
guidelines ask for and what a line inside a menu about map types would not be.
It starts folded, and the thing that folds it is marking its container compact
when it is added: MapLibre adds `maplibregl-compact-show` only while the
container is not compact yet, and it runs that check again on every resize and
whenever the attributions change, so a class removed afterwards comes back with
the first source that reports in.

Map visibility is always a `Switch` ("auf der Karte"), one per kind, two-state
buttons are always a `Toggle`. Without a camera or a selection in the hash the
map opens on the frame the fit button produces, not on a fixed overview.

Below `lg` no panel rests on the map: from the season bar's two buttons, **two**
independent `MobileSheet`s (`components/mobile-sheet.tsx`, the Base UI `Drawer`
with `modal={false}` and snap points), the list and the detail, each mounted
only while it is open and each with its own snap state (`LIST_SNAPS`,
`DETAIL_SNAPS` in `explorer.tsx`). "Liste" opens the list on its list; "Filter"
opens the same sheet with the filter panel unfolded, which is why that fold is
state in `explorer.tsx` and not in the sidebar. A tap on the map opens the
detail over the bare map; a tap on a list row opens it over the list. Whichever
is in front feeds MapLibre its height as bottom padding when that is more than
the season bar covers. It was one sheet holding either content, after a stint
as two sheets that were always both on screen. The always-on pair failed
because a drawer that cannot leave has to rest somewhere, so the layout grew a
peek row, a swipe handle over it and a trigger button inside the thing it
triggers – a piece of the list permanently parked on the map before anything
had been asked for, and a second handle behind it that did nothing. Collapsing
them into one sheet removed the second handle but kept the peek, and made "back
to the list" something the app had to reconstruct: a detail reached from the
map had no list behind it, and one reached from a row had to keep the list
mounted under a `hidden` so its scroll position, its tab and its search
survived. Opening on demand settles both. The stack is simply the truth, the
list keeps its state by never being unmounted while it is open, and nothing has
to rest on screen, so there is no peek snap to measure. What leaving a detail
means still depends on what is underneath, and the control says which: a
labelled `‹ Liste` back button while the list drawer is open behind it, the `✕`
when the detail is alone over the map. The panel learns which from the sheet it
is in (`useSheet().over`), so the two facts a subtree needs about its drawer –
is it expanded, does it lie on another – travel the one way.
A drawer sizes itself from `--drawer-snap-point-offset`: the popup is a full
`100dvh` and padded off at the bottom by that offset **less the inset**, so its
content box ends at the fold – the inset comes off because the popup's own
bottom margin has already lifted that much of it below.

Neither drawer is full-bleed: the preset's own `--drawer-inset` is left alone,
so a sheet is a rounded card lying on a map that stays visible beside it rather
than a new page pinned to three edges. `sheetCover` in `mobile-sheet.tsx` is
what the camera padding reads – the snap point plus that margin – because the
arithmetic can read neither a fraction-or-pixels snap point nor a custom
property.

**Opened from a row, the detail is a drawer _on_ the list, not merely over it.**
Base UI reads a `Drawer.Root` rendered inside another one as a nested drawer and
stacks the two – the one behind scales back, dims and peeks above the one in
front – which is exactly what going back to the list means. A detail opened from
the map must not claim that, because there is nothing behind it, so the same
`detailSheet` element is rendered under one of two parents, decided at the tap
(`sheet.detail.nested`, set by the `select` case of `reduce`) and then left
alone: what is underneath a detail does not change while it is open, and moving
a mounted drawer between trees would remount it anyway.

**The content does not scroll until the sheet is at its topmost snap point**
(`useSheet().expanded`, read by the detail panel's scroller and the sidebar's
list container). The drag and the scroll are the same gesture, so something has to
arbitrate, and Base UI arbitrates the way the platform does: a touch that starts
inside a scroll container may swipe the sheet _down_ from the scroll top, but a
drag _up_ always goes to the scroller. On a detail sheet whose top half is a
photo that left the 20 px grabber as the only way to enlarge it – every other
pixel scrolled the text instead. Locking the scroll removes the ambiguity rather
than carving the sheet into regions that behave differently: below the top snap
point there is no scroll container at all, so the whole sheet is a handle and
the gesture that enlarges it is the same one everywhere on it; once it is up,
the content scrolls and a swipe down from its top edge puts it back. It is
`overflow: hidden` rather than a handler, because the arbitration then happens
in the browser's own gesture routing – what is not scrollable is not offered the
gesture. Coming back down scrolls the content to the top: a collapsed sheet
showing the middle of an article has lost the one thing it is tall enough to
show. This is what Apple Maps, Komoot and Strava all do.

The search field is inside the list sheet, not on the map. It used to float
over the map's bottom-left corner as a **button** (`MapSearch`), because a
field there brings the software keyboard up in the same moment as the drawer
moves and the two fight over where the field ends up. The button is gone with
the shell: the header's sentence now does the job it was really doing – saying
what the app holds before anything is tapped – and it says it in words rather
than in three counts.

On a phone that makes four states, and which control leaves a detail depends
on which of them it is in:

```mermaid
stateDiagram-v2
  [*] --> Bare
  Bare: Bare map
  List: List drawer
  DetailAlone: Detail over the bare map
  DetailOverList: Detail over the list

  Bare --> List: the season bar's Liste / Filter button
  Bare --> DetailAlone: tap a pass on the map
  List --> DetailOverList: tap a row
  List --> Bare: close the drawer
  DetailAlone --> Bare: the close button
  DetailOverList --> List: the back button
```

Whichever drawer is in front feeds MapLibre its height as bottom padding; with
neither open that is the season bar's measured height.

### One reducer, two adapters

Everything the explorer decides – the selection and its consequences, the tab,
the hover, the half-month, the filters, what the map shows, the phone's sheet
snaps – is one pure reducer, `reduce(state, action, env)` in
`lib/app-state.ts`, with table tests. `Explorer` holds it in a `useReducer`
and hands the panels the values they read plus `dispatch`; it derives nothing
a second time.

```mermaid
flowchart LR
  H["hash adapter<br/>parseHash → load · state → serializeHash"] --> A
  ST["storage adapter<br/>readStoredState → load · state → keys"] --> A
  UI["rows · map · panel · sheet<br/>dispatch"] --> A
  A["lib/app-state.ts<br/>reduce(state, action, env)<br/>selection · last · tab · hovered · cursor<br/>filters incl. period · shown · sheet"]
  A --> SB["Sidebar reads shown, rows"]
  A --> PM["PassMap reads key, shown"]
  A --> DP["panel gets the selection"]
  A --> SBd["SeasonBand gets the current bar"]
```

Two rules follow from the picture. **Selecting something is one reducer
case.** `select` sets the selection and what the leaving sheet keeps showing,
brings the kind's tab forward, clears the hover and the profile cursor,
reveals the kind on the map and, on a phone, picks the detail drawer's snap
and nesting from where the list drawer rests. A tap on a row, a tap on the
map and a `#tour=…` pasted into the address bar all go through it – which is
what it took for a pasted hash to bring the right tab forward, and for Escape
to stop leaving the last hovered entity ringed: the rule used to be written
three times, and the copies had drifted apart.

**The hash and the storage are adapters.** Neither is read during a render,
and no control writes to either: a control dispatches, and what the adapters
persist is what the reducer made of it – which is how a half-month from a
shared link applies without becoming the visitor's own preference.
`useHashAdapter` (`lib/hash-adapter.ts`) turns the hash and the stored slices
into one `load` action in a layout effect after hydration, and again on every
`hashchange`; afterwards it serialises the state back into the hash. Why that
reading is a layout effect and not the state's initialiser is hydration; the
hook's doc comment is the one place it is written out. `useStorageAdapter`
(`lib/use-stored.ts`) writes the persisted slices – the switches, the tab, the
visitor's own period – whenever they change, under the keys of the `STORAGE`
table, which is where every `alpenpaesse:*` key is spelled, with its area and
its default. Both adapters wait for `state.loaded`: the first commit holds the
defaults, and writing those would overwrite a shared link or the last visit's
settings before they have been read. What is shown on the map is one value,
`Shown`, read through `isShown` and `shownTourCount` and reconciled against the
data on load, so a tour that left `data/tours.json` cannot keep the master
switch reading "off". An entity's identity is `entityKey`
(`lib/route-key.ts`, the key module `next.config.ts` can load) and nothing
else spells it.

### Dark mode follows the OS, nothing else

There is no theme toggle and no `next-themes`; the dark tokens sit in a
`prefers-color-scheme` media query and Tailwind's default `dark:` variant is
used. Delete the `@custom-variant dark (&:is(.dark *))` line that `ui:init`
writes.

## The sidebar

### A filter is a chip, and no chip lies

Every filter in the sidebar is the same shape: a small pressable word, outlined
while it is off and filled with the primary colour while it is on
(`FilterChip`). There is no slider and no select among them. A slider is for a
value where the exact number matters and the scale is wide; a 1–5 editorial
judgement and four round height thresholds are neither, and on a phone its
thumb is the one control that is regularly missed – small, indistinguishable
against the filled track at either end, and it swallows the sheet's swipe. A
chip is a target with a label that says what it does before it is pressed.
Three rules keep the panel out of states that answer nothing. A "which of
these" set (status, road type) is stored as what stays visible, and the whole
vocabulary means _no filter_, so nothing reads as pressed then; `toggleMember`
turns the last one out back into the whole set, so "none selected" – an empty
list by construction – cannot be reached. A threshold group (`ThresholdChips`)
holds at most one pressed chip and pressing it again lifts the filter, and its
"egal" value is the first option of the list and deliberately has no chip of
its own. The difficulty is five cells that always span one window
(`toggleLevel`), which is a range without a second thumb to aim at. A threshold
on one of the 1–5 scales carries the same five-bar mark the list rows draw
(`Rating`, `mark` on `ThresholdChips`), so the filter and the thing it filters
show one picture instead of a word here and a glyph there. The word stays in
front of it, because the mark alone carries "at least" implicitly and
`maxTraffic` is an upper bound – a bare rating row would read as the opposite
of what it does there. Inside a pressed chip the mark takes `tone="current"`:
the surface _is_ the primary colour, so a primary bar disappears exactly where
the filter is active. Every chip carries how many roads it would leave
(`facetCount` in `lib/rows.ts`, handed down as `countWith`), and that number is
counted **disjunctively**: with all other groups' filters applied but its own
group's filter lifted. Counted the other way – with the group's current choice
still in force – every unpressed chip in a group reads 0 although each is one
tap away. The disjunctive rule buys a second thing: a group's numbers do not
depend on that group's own state, so they hold still while a thumb works that
group and only move when another group changes. A chip that would leave none is
disabled rather than hidden, because hiding it raises the question of where it
went and the 0 is the answer; a pressed chip is never disabled, it has to stay
liftable. The difficulty cells are the one exception to "what happens if I
press this": a cell moves a window rather than replacing it, so its number is
how many roads sit at that level. Counting has its own path rather than going
through `buildPassRows`: a count needs neither the row objects nor the season
strip hanging off them, and the panel asks it once per option on every
keystroke. Since [plan 15](./plans/15-pass-year.md) the saving is allocation
rather than arithmetic – both
paths read the grades from the precomputed year – but it is still 201 rows
built per option to produce one number. And when a combination does run empty,
the count line names the single filter that would bring the most back rather
than saying nothing. What is filtered away is written down outside the panel
too: `AppliedFilters` turns `appliedFilters()` in `lib/filter-summary.ts` into
one removable chip per decision, and the same list's length is the badge on the
trigger, so the two can never disagree. Nothing is applied on a button – the
count line at the end of the panel says what the current answer is, which is
what makes live filtering answerable at all.

### The panel scrolls with the lists, not above them

The sidebar's header is a fixed row and holds only the search field, the
trigger and the chip row; the panel body itself is the first thing inside the
scroll container the lists live in. A growing panel inside a fixed row simply
runs off the bottom of the phone's sheet with no way to reach its lower half,
and two scroll containers stacked inside one drawer is the other half of the
same bug. The four decisions a holiday planner makes first (status, difficulty,
height, bookmarks) are always visible, the eight sharper ones wait behind
"Weitere Filter", which opens by itself when a link carries one of them.

### One list at a time, chosen by a tab row

The three kinds used to be collapsible blocks stacked inside one scroll
container, which made the sidebar a single 12 841 px column against a 730 px
viewport: the tours sat below all 201 roads and the towns below those.
`KindTabs` (`components/sidebar/kind-tabs.tsx`) puts the choice in the fixed
header and the scroll container holds one list. The tabs also solve what kept
the old section headers from sticking. A pinned header needs an opaque
background to stay legible over the rows scrolling under it, and a
`backdrop-blur` cannot supply one – the panel already filters its backdrop, and
a nested filter never sees the content inside that backdrop root. In the header
row nothing scrolls underneath, so the counts simply stay on screen, and the
count on a tab is the answer to the filter: narrowing to "ab 2.500 m" collapses
the tours from 9 to 2 where it can be seen. Each kind's "auf der Karte" switch
rides in that list's own toolbar (`ListToolbar`), never beside the tab row: a
control next to three tabs reads as acting on all three, and a bare switch says
what it does only once it has been flipped, so it carries the words too.

### What the drawer derives from the drag stays on the drawer

Dragging the bottom sheet stuttered on a phone with the 201 roads in it and
not with the 48 towns or the 9 tours, and the cause was six custom properties.
Base UI writes the finger's position to the drawer's popup on every frame of a
drag (`--drawer-swipe-movement-y`) and registers that property with
`inherits: false`, precisely so that writing it restyles one element. The
shadcn preset then computes `--translate-y` and the `--stack-*` values from it
in _plain_ custom properties (`components/ui/drawer.tsx`) – and a plain custom
property is inherited. Its computed value changes with the finger, so the new
value is handed to every element under the popup, sixty times a second: the
whole list restyled per frame, at a price set by the number of elements in it
(9,027 under the roads, 1,572 under the towns, 455 under the tours).

`app/globals.css` therefore registers the six derived properties
(`--translate-x`, `--translate-y`, `--stack-progress`, `--stack-peek-offset`,
`--stack-scale`, `--stack-shrink`) as non-inheriting too. Only the popup reads
them, in its own `transform`, so nothing below misses them. `syntax: "*"`
without an initial value keeps `var(--translate-x, 0px)` falling back as it
did; `--bleed` and `--peek` stay plain, because they never change and the
popup's `::after` reads `--bleed` by inheritance. The rules live in the
stylesheet because `components/ui/` is generated – and whoever regenerates it
checks that a new preset has not added a derived property the drag changes.

Measured on the built page at 390 × 844 under 4× CPU throttling, one touch
drag of 90 moves (headless Chromium):

| list          | style recalculation | layouts |
| ------------- | ------------------- | ------- |
| roads, before | 1354 ms             | 38      |
| roads, after  | 203 ms              | 6       |
| towns, before | 958 ms              | 20      |
| towns, after  | 145 ms              | 4       |
| tours, before | 1177 ms             | 2       |
| tours, after  | 155 ms              | 2       |

And confirmed where it matters: two builds of the same commit served side by
side to the iPhone that prompted the work, differing in these rules only – the
one without them stutters, the one with them does not.

Chromium hides the dependence on the row count in those numbers, because it
skips the style of `content-visibility` subtrees that are off screen (the next
section); WebKit evidently does not, which is why the phone told the three
lists apart and the profile did not. Two earlier rounds of work went after
this stutter in headless Chromium alone and did not cure the phone. The lesson
is the method: a drag that stutters on a device is compared on that device,
one change per build, before anything is concluded from a profile.

### A long list comes in blocks of ten

The rows of a list sit in blocks of ten (`RowList`,
`components/sidebar/row-list.tsx`), each row and each block a
`content-visibility: auto` subtree, so what is off screen is skipped – its
style, its layout and its paint. With 201 roads at ~40 elements a row that is
most of nine thousand elements the browser does not have to keep up to date
while a filter chip changes the list or the sheet's state changes around it.

The blocks were introduced against the restyle described above, before its
cause was known: a row that contains its ~40 inner elements is still visited
itself, and in blocks of ten the rows of an off-screen block are not
(7.5 ms → 3.7 ms of style per drag frame for the roads, in Chromium). With
the cause removed that saving is gone – 203 ms of style per drag with the
blocks, 223 ms without – and what is left is a trade: the frame a drag starts
in is 33 ms with them and 133 ms without (throttled), against one frame of
~150 ms when a block first comes into view as the sheet is pulled up. They
stay because they are in and harmless, not
because the drag needs them; removing them would be a simplification, to be
judged on a phone.

Every row stays in the DOM either way. Windowing the list – with
`@tanstack/react-virtual` or by hand – measured no better than the blocks, and
it would cost `useRoving`'s arrows, `scrollIntoView` on the selected row and
the browser's own find-in-page across all 201 rows.

Ten rows is about a screenful at the sheet's lower snap point. The list is a
`<div role="list">` and a row a `<div role="listitem">`, because a block is an
element between the two and `<ul>` may hold nothing but `<li>`.

Two things follow for everything else in the sheet. A number that changes with
the drag must not reach the rows: where the drawer rests is the reducer's
`sheet` slice (`lib/app-state.ts`), read where the rule that needs it lives –
the `select` case, which picks the detail drawer's snap from it. What the rows
are handed is `dispatch`, which never changes, so a snap change is no longer a
new `select` re-rendering all 201 rows behind the sheet (~50 ms, for a value
nothing on screen was reading). And a row stays cheap: what is added to one is
added two hundred times.

### A drag of the sheet may spend the frame on nothing else

Apart from the restyle above, three things were found taking the frame of a
drag, each of them work that nobody sees. They were found while the restyle
was still there, in a Chromium profile that showed the same frame time
whatever was in the sheet – the roads, the roads reduced to text nodes, only
the twenty rows on screen – and was read as "the row count is not the story".
On the phone the row count _was_ the story, so that reading is not repeated
here; the three rules stand on what each of them removes:

- **The content box may not resize while the finger is down.** The sheet's
  padding reads `--drawer-swipe-movement-y`, which is written on every frame of
  a drag, so the box – and every scroll container in it – was re-laid-out sixty
  times a second. While `data-swiping` is set the padding is zero, the one
  value that can never end the box short of the fold however far the sheet is
  pulled; what reaches past the fold is clipped anyway. Measured with the
  restyle still in place: 162 layouts per drag dropped to 19, and the tours'
  whole drag from 16.5 s to 9.8 s of task time. With the properties registered
  the same drag lays out 22 times either way – the restyle was what turned a
  padding into a relayout of everything under it.
- **No backdrop filter during the gesture.** A blurred backdrop is produced
  again whenever what is in front of it moves, and a dragged sheet moves across
  all four glass surfaces. For the length of the drag they are the opaque
  plates they already fall back to where `backdrop-filter` is missing (`glass`
  in `lib/utils.ts`, the rule in `app/globals.css`).
- **No scrolling layer during the gesture.** An `overflow` element inside a
  transformed ancestor is kept on a scrolling layer that the browser re-makes
  while the ancestor moves. The gesture belongs to the sheet, so the two
  scrollers inside one (`data-scroller`) clip for its length – the same idea as
  `useSheet().expanded` above, which already takes the scroll away _below_ the
  top snap point; this covers the drag that starts _at_ it.

What is honest about these numbers: they come from headless Chromium with the
CPU throttled, they were taken while the derived properties above were still
inherited, and on the iPhone that prompted the work these three rules did not
cure the stutter – registering the properties did. Re-measured on the fixed
build, each rule put back on its own, they no longer show at all: the drag
holds a 16.7 ms median frame whichever way round, at 632 ms of style
recalculation against 647 ms with the live padding, 633 ms with the blur and
683 ms with the scroller. So what they are worth on the device is untested –
which is the one place the stutter was ever real – and what they cost is a
drag that is drawn as plates rather than glass. They stay because each of them
is work removed rather than a guess at a browser; if the phone cannot tell the
two builds apart, they are three rules and a `data-scroller` attribute to
delete.

### A long list is one tab stop

Every row used to be two (the bookmark toggle and the row itself) – 562
focusable elements on the built page, so reaching the map meant holding Tab
down for several hundred presses, and a screen reader's rotor held two hundred
buttons all called "Merken". `useRoving` (`lib/use-roving.ts`) makes each list
the composite widget the platform expects: one stop, arrows inside it,
Home/End/PageUp/PageDown, and the tab stop stays on the row last focused. It
works off the DOM rather than an index in state, because which rows exist
changes on every keystroke in the search field. Every bookmark toggle is named
after the thing it bookmarks, and `app/page.tsx` carries a skip link to the
map.

## The detail panel

### The panel folds

Every block below the title is a `Section` (`components/panel/section.tsx`),
open by default. The panel is a column on a map and a phone sheet shows two
blocks at a time; whoever wants the climate should not scroll past two
elevation profiles first. Which blocks are folded is one `sessionStorage` entry
shared by all of them (`alpenpaesse:closedSections` in the `STORAGE` table,
`lib/use-stored.ts`), keyed by section id and holding the _closed_ ones: a fold
carries over to the next pass looked at, a new section opens by itself, and the
next visit starts unfolded again. The ids are a closed set (`BlockId`, declared
with the panel model) rather than free strings, so a block cannot be spelled two
ways and lose its fold. A section title says what the block is and nothing else;
where a source or its caveat has to be named, one short sentence sits behind the
`info` popover, opened by tap or click – a tooltip needs hover, which a phone
cannot give it, and the detail panel is where a phone reaches this app most. A
header never opens a dialog – the scales dialog belongs to the sidebar footer,
which is where it stays.

### Model in, markup out

**What a pass, a tour or a town shows is a value, and the components render
it.** `detailModel(selection, data, state)` (`lib/detail-model.ts`) resolves the
entity once and returns one discriminated `DetailModel`: the entity itself, its
verdict and every German sentence it shows, what is within reach of it, which
blocks apply, and how far its detail file has got (`DetailState`,
`lib/detail-state.ts`). `PassDetail`, `TourDetail` and `TownDetail` take their
half of that value plus one `PanelActions` object, and nothing else. The shell
(`detail-panel.tsx`) is the head, the control row and one three-way switch on
`model.kind`.

The three things that convention buys:

- **The kind is decided once.** It used to be found, cast and branched on in
  three places, each branch taking all nineteen of the shell's props and reading
  six of them, so adding a field to what a pass shows meant reading the whole
  file to find out who else was passing it on.
- **Every sentence has one home.** The model calls `lib/status.ts`
  (`bestText`, `reasonParagraph`, `climateText`, `tourText`, `seasonText`) and
  the components print what comes back. No German is glued together in JSX, so
  the same fact cannot be worded two ways in two blocks.
- **It is testable without a browser.** The model is a pure function – `period`,
  `hovered` and the fetch state are arguments, never hooks – so `bun test`
  renders all three kinds from one fixture with `renderToStaticMarkup`
  (`components/panel/kind-detail.test.tsx`), and the same model will render on
  the server for an entity page (`docs/plans/02-*`).

**"What is near here" is one module.** `lib/reach.ts` measures distance in the
bands, the weight and the reach of `lib/geo.ts` and hands back one `Reach`
value; `inBands` reads it the way a rider thinks about a day, `byDistance` reads
it nearest-first for the "Im Umkreis" block. The two readings are deliberate and
come from one computation. What a ranked block above already shows is `claimed`
in the same call, so no block has to be told by a flag what a sibling drew.

### Photos are borrowed, not owned, and they are the panel's hero

The detail panel opens **on** a slideshow of Wikimedia Commons photos
(`components/panel/photo-carousel.tsx`): at the very top under a thin margin,
with the kicker, the name and the panel's own controls lying on it. The margin
is 6 px and the photo's radius is the panel's less that, so the two corners are
concentric – full bleed put the picture's right angle exactly where the card's
curve is, which is the one place the two cannot agree. The title is inset 10 px
inside the photo, which is 16 px from the panel's edge: the same column the
numbers under it start in.

**The hero is the whole carousel, not one picture.** The build picks up to six
photos per entity with no editorial step, so the first is not reliably the best
one, and a destination is chosen by the look of it – one frame rarely answers
that. Swiping costs nothing extra: the slides are already lazy, the horizontal
drag is the gesture the sheet's vertical one leaves free, and the `1/6` in the
corner says there is more without a second control.

**Two shapes, one element** (`PanelHead`). With no photos – or once every slide
has failed to load – the kicker and the name stand in the panel's own colours
instead of on white, but they are the _same_ nodes either way, only differently
placed: rendered in two branches, the heading would leave the document the
moment the last slide failed. `DetailAsset.photos` decides the shape before the
file arrives, so the head never changes shape under a reader.

**What takes the focus on selection is the panel, not the heading.** The heading
is written across the foot of the hero, and focusing something that far down a
scroll container asks the browser to bring it into view; `preventScroll` is the
request not to, and it is a request browsers have not always honoured. Where it
was ignored the panel opened already scrolled and the photo had slid up over its
own title. The section carries `aria-labelledby="detail-title"`, so the
announcement is the same name either way, and the scroll reset runs after the
focus call rather than before it.

The controls do change tone, because what is under them does: on the hero the
row is transparent and each control carries its own translucent surface
(`OVERLAY_CONTROL`); past the head the row takes the surface, the controls give
theirs up and the name appears next to them, because the title was written on
the photo and scrolled away with it (`PanelBar`, `solid`). The threshold is
measured off the head rather than guessed, and held per selection (`pastHead`
holds the entity's key) so a new panel starts at the top without an effect
writing state after the fact – and it only counts while the sheet is up, since
below that the content cannot have scrolled at all. `scripts/build-photos.ts` picks them
once, without an editorial step – a geosearch around the pass point, a name
filter that keeps signs and maps out, a rank by name match – and stores only
metadata in `data/generated/photos.json`: the thumbnail URL, the author, the
licence and the file page. The files themselves stay on Wikimedia's CDN and
reach the browser through a plain `<img>`, never `next/image`; they are already
rendered and already cached, mirroring them would put ~25 MB of binaries into
the repo, and the optimiser would add a hop, a `remotePatterns` entry and a
bill for the same bytes. What it would have brought is had without it.
Wikimedia renders a fixed ladder of widths and answers a direct request for
anything else with a 400, so `thumbUrl` composes the smaller rungs of that
ladder and the slide carries a `srcset` off it (`photoSrcSet`, `PHOTO_SIZES`):
a 1× panel fetches 500 px where it used to fetch 960. And the one thing that
cannot be fetched in time is precomputed – `Photo.blur` is the same photo
`BLUR_WIDTH` px wide as a data URI, laid under the photo in a layer of its own,
so a slide opens on its own colours instead of an empty box. That layer is
blurred and scaled up rather than left to the browser's upscaling, which at
twenty times the width is visibly blocky; it is a layer because `filter`
reaches an element's children, and it is scaled because a blur samples past the
edges. It travels inside the entity's detail file, because a placeholder that
needs a request of its own loses the race it exists to win; generating one on
demand and caching it would lose the same race for every first visitor to a
pass. No image library is involved either way: Wikimedia renders the 40 px
version, `scripts/lib/blur.ts` strips the metadata it inherits – a wide-gamut
photo's ICC profile is 30 KB around a 480-byte picture, and re-encoding does
not drop it – and `Bun.Image` turns what is left into ~475 bytes of WebP. A
hash (BlurHash, ThumbHash) would be twenty times smaller and lower fidelity
than that, and would want a decoder and a canvas paint in the frame the panel
is trying to keep smooth; the thumbnail is already rendered, so there is
nothing to approximate. **And the box is there before the photo is.** The panel
opens before its detail file arrives, so `DetailAsset` carries the photo count
next to the URL and `PhotoCarousel` reserves the slide while it waits – the
block that used to appear late and push everything under it down. An entity
with no photos reserves nothing. That is the same rule as the profile skeleton
and the chart's placeholder, and the reason the panel is not a server
component: a selection would then cost a server round trip where it now costs
an immutable file from the CDN, and the jump was never about where the markup
came from. Attribution is not decoration: every slide carries author and
licence, baked into the slide rather than derived from the carousel's index, so
it cannot drift out of sync with what is on screen.
