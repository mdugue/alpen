"use client";

import {
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";

import { useT } from "@/components/i18n";
import {
  ChipGroup,
  FilterChip,
  ThresholdChips,
} from "@/components/sidebar/filter-chip";
import { StatusDot } from "@/components/status-badge";
import { TagIcon } from "@/components/tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ALL_RANGES,
  ALL_STATUS,
  ALL_SURFACES,
  ALL_TYPES,
  BEAUTY_OPTIONS,
  ELEVATION_OPTIONS,
  FAME_OPTIONS,
  HEAT_OPTIONS,
  pickedMembers,
  RATING_MAX,
  RATING_MIN,
  toggleLevel,
  toggleMember,
  TRAFFIC_OPTIONS,
  WET_OPTIONS,
} from "@/lib/app-state";
import type { Filters, ListTab } from "@/lib/app-state";
import {
  appliedFilters,
  bestRelief,
  difficultyLabel,
  filterCount,
} from "@/lib/filter-summary";
import { fill } from "@/lib/i18n/fill";
import { ROAD_TAGS } from "@/lib/regions";
import type { RangeName } from "@/lib/regions";
import type { RoadTag, RoadType, Status, Surface } from "@/lib/types";
import { cn, TOUCH_CONTROL } from "@/lib/utils";

const LEVELS = [1, 2, 3, 4, 5] as const;

/**
 * The button that opens the panel, at the end of the search row. The badge
 * counts the same decisions the chip row lists, so trigger and row can never
 * disagree about how filtered the list is.
 */
export const FilterTrigger = ({
  filters,
  open,
  onOpenChange,
  className,
}: {
  filters: Filters;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) => {
  const { t } = useT();
  const count = filterCount(filters, t);
  return (
    <Button
      variant={count > 0 ? "secondary" : "outline"}
      aria-expanded={open}
      onClick={() => onOpenChange(!open)}
      className={cn(TOUCH_CONTROL, className)}
    >
      <SlidersHorizontal data-icon="inline-start" />
      {t.sidebar.filters.open}
      {count > 0 && <Badge>{count}</Badge>}
      <ChevronDown
        data-icon="inline-end"
        className={cn("transition-transform", open && "rotate-180")}
      />
    </Button>
  );
};

/**
 * What is currently filtered away, as one removable chip per decision, plus
 * the way back to nothing. Without it the only place the state of the app is
 * written down is the panel itself, and the panel is the thing that has to be
 * open to be read – on a phone that means the list it describes is off screen
 * while the answer is on it. The row scrolls sideways rather than wrapping, so
 * a panel with eight filters never pushes the lists off the sheet.
 */
export const AppliedFilters = ({
  filters,
  setFilters,
  onReset,
  className,
}: {
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  onReset: () => void;
  className?: string;
}) => {
  const { t } = useT();
  const applied = appliedFilters(filters, t);
  if (applied.length === 0) return null;
  return (
    <div
      className={cn(
        "-mx-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-0.5",
        // A horizontal strip inside the phone's bottom sheet: the sheet must
        // not read a sideways drag on it as a swipe downwards.
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      data-base-ui-swipe-ignore
      aria-label={t.sidebar.filters.active}
    >
      {applied.map((chip) => (
        <Button
          key={chip.key}
          variant="secondary"
          size="sm"
          onClick={() => setFilters(chip.clear)}
          aria-label={fill(t.sidebar.filters.remove, { label: chip.label })}
          className={cn(
            "h-7 shrink-0 rounded-full pr-1.5 pl-3 font-normal",
            "pointer-coarse:h-9",
          )}
        >
          {chip.label}
          <X data-icon="inline-end" className="opacity-60" />
        </Button>
      ))}
      {applied.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-7 shrink-0 rounded-full px-2.5 font-normal pointer-coarse:h-9"
        >
          <RotateCcw data-icon="inline-start" />
          {t.sidebar.filters.all}
        </Button>
      )}
    </div>
  );
};

/**
 * The filter panel itself. Four decisions are always visible – the status, how
 * hard, how high, and whether only the bookmarks count – because those are the
 * ones a holiday planner makes first; the eight that answer a sharper question
 * wait behind "Weitere Filter", so the panel opens at a height a phone can
 * show in one piece instead of a screen and a half of controls.
 *
 * It lives inside the list's own scroll container rather than above it: the
 * sidebar's header is a fixed row, and a panel that grows inside a fixed row
 * simply runs off the bottom of the sheet with no way to reach its lower half.
 *
 * Nothing is applied on a button. The list, the map and the counts change
 * under every tap, which is what makes the panel answerable at all – the count
 * line at the end says what the current answer is, so the effect of a chip is
 * visible without closing the panel first.
 */
export const FilterBody = ({
  filters,
  setFilters,
  counts,
  totals,
  countWith,
  ranges,
  onRange,
  onReset,
  more,
  onMoreChange,
}: {
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  /** How many rows each list shows right now, and how many there are in all. */
  counts: Record<ListTab, number>;
  totals: Record<ListTab, number>;
  /**
   * How many roads would be left by a filter change – the number on every
   * chip. The patch carries the option *and* lifts its own group's filter, so
   * a group's numbers never depend on that group's own choice; `facetCount`
   * in `lib/rows.ts` says why that is the only honest way to count, and why
   * it also keeps the numbers still while a group is being tapped.
   */
  countWith: (patch: Partial<Filters>) => number;
  /**
   * The ranges the data holds a road for. The group only shows with two or
   * more: a chip row of one is a statement, not a choice, and "Alpen 262 ·
   * Vogesen 0" would list a range the map cannot show yet.
   */
  ranges: readonly RangeName[];
  /** A range chip pressed – the one chip that also frames (`range` in `reduce`). */
  onRange: (range: RangeName) => void;
  onReset: () => void;
  /** The second half of the panel; its state lives with the panel's own. */
  more: boolean;
  onMoreChange: (open: boolean) => void;
}) => {
  const { t, fmt } = useT();
  const words = t.vocab;
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const pickedRanges = pickedMembers(filters.ranges, ALL_RANGES);
  const pickedStatus = pickedMembers(filters.status, ALL_STATUS);
  const pickedTypes = pickedMembers(filters.types, ALL_TYPES);
  const pickedSurfaces = pickedMembers(filters.surfaces, ALL_SURFACES);
  const [lo, hi] = filters.difficulty;
  const wholeScale = lo === RATING_MIN && hi === RATING_MAX;
  const count = filterCount(filters, t);
  const relief = counts.pass > 0 ? null : bestRelief(filters, countWith, t);
  const reliefLabel = relief?.chip.label ?? "";

  return (
    <div className="grid gap-4 px-3 pt-3 pb-4">
      {/* The range first: it is the "where" before every other decision, and
          it is the one chip that moves the camera too – a range is a place,
          and a list of Jura roads under a picture of the Dolomites answers
          only half the question. */}
      {ranges.length > 1 && (
        <ChipGroup id="f-ranges" label={t.sidebar.filters.range}>
          {ranges.map((r) => (
            <FilterChip
              key={r}
              label={words.range[r].label}
              hint={words.range[r].hint}
              count={countWith({ ranges: [r] })}
              pressed={pickedRanges.includes(r)}
              onPressedChange={() => onRange(r)}
            >
              {words.range[r].label}
            </FilterChip>
          ))}
        </ChipGroup>
      )}

      <ChipGroup id="f-status" label={t.sidebar.filters.status}>
        {ALL_STATUS.map((s: Status) => {
          const on = pickedStatus.includes(s);
          return (
            <FilterChip
              key={s}
              label={t.status.label[s]}
              count={countWith({ status: [s] })}
              pressed={on}
              onPressedChange={() =>
                set("status", toggleMember(filters.status, ALL_STATUS, s))
              }
            >
              <StatusDot status={s} hollow={!on} />
              {t.status.label[s]}
            </FilterChip>
          );
        })}
      </ChipGroup>

      {/* Five cells, one per level of the editorial scale, and the window they
          span is the filter. Two of them are a range without a second thumb to
          aim at, and the cells say what the numbers mean by standing next to
          the same scale the list draws.
          The number on a cell is how many roads sit at that level, not what
          pressing it would leave: a cell extends or shrinks a window rather
          than replacing it, so "what happens if I press this" has no single
          answer here. The distribution is the more useful reading anyway, and
          it stays invariant like every other group's numbers. */}
      <ChipGroup
        id="f-difficulty"
        label={t.sidebar.filters.difficulty}
        value={
          wholeScale ? words.option.any : difficultyLabel(filters.difficulty, t)
        }
      >
        {LEVELS.map((n) => (
          <FilterChip
            key={n}
            label={fill(words.filter.difficultyOne, { level: n })}
            count={countWith({ difficulty: [n, n] })}
            pressed={!wholeScale && n >= lo && n <= hi}
            onPressedChange={() =>
              set("difficulty", toggleLevel(filters.difficulty, n))
            }
            className="px-2.5 tabular-nums"
          >
            {n}
          </FilterChip>
        ))}
      </ChipGroup>

      <ThresholdChips
        id="f-elevation"
        label={t.sidebar.filters.elevation}
        options={ELEVATION_OPTIONS}
        count={(v) => countWith({ minElevation: v })}
        value={filters.minElevation}
        onChange={(v) => set("minElevation", v)}
      />

      <FilterChip
        label={t.sidebar.filters.favoritesOnly}
        count={countWith({ favoritesOnly: true })}
        pressed={filters.favoritesOnly}
        onPressedChange={(on) => set("favoritesOnly", on)}
        className="w-fit"
      >
        <Star className={cn(filters.favoritesOnly && "fill-current")} />
        {t.sidebar.filters.favoritesOnly}
      </FilterChip>

      <Collapsible open={more} onOpenChange={onMoreChange}>
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              // A ghost trigger fills on `aria-expanded`; a filter group is
              // not a surface of its own, no more than a sidebar section is.
              className={cn(
                "-mx-1 w-full justify-start aria-expanded:bg-transparent",
                TOUCH_CONTROL,
              )}
            />
          }
        >
          <ChevronDown
            data-icon="inline-start"
            className={cn("transition-transform", more && "rotate-180")}
          />
          {t.sidebar.filters.more}
        </CollapsibleTrigger>
        <CollapsibleContent className="grid gap-4 pt-3">
          {/* Art and Merkmale: the two axes of plan 14. The type is topology
              and single-valued per road, so the set is a plain "which kinds do
              I want"; the labels are character and stack with and-semantics,
              which is why they carry their word next to the glyph – a strip of
              icons alone is scannable in a row but not choosable in a filter. */}
          <ChipGroup id="f-types" label={t.sidebar.filters.roadType}>
            {ALL_TYPES.map((type: RoadType) => (
              <FilterChip
                key={type}
                label={words.roadType[type].label}
                hint={words.roadType[type].hint}
                count={countWith({ types: [type] })}
                pressed={pickedTypes.includes(type)}
                onPressedChange={() =>
                  set("types", toggleMember(filters.types, ALL_TYPES, type))
                }
              >
                {words.roadType[type].label}
              </FilterChip>
            ))}
          </ChipGroup>

          {/* Road stays the default: all three pressed is no filter, and a
              road cyclist who presses nothing sees the gravel roads among the
              rest, dashed and named (plan 27). */}
          <ChipGroup id="f-surfaces" label={t.sidebar.filters.surface}>
            {ALL_SURFACES.map((x: Surface) => (
              <FilterChip
                key={x}
                label={words.surface[x].label}
                hint={words.surface[x].hint}
                count={countWith({ surfaces: [x] })}
                pressed={pickedSurfaces.includes(x)}
                onPressedChange={() =>
                  set(
                    "surfaces",
                    toggleMember(filters.surfaces, ALL_SURFACES, x),
                  )
                }
              >
                {words.surface[x].label}
              </FilterChip>
            ))}
          </ChipGroup>

          <ChipGroup
            id="f-tags"
            label={t.sidebar.filters.tags}
            hint={t.sidebar.filters.tagsHint}
          >
            {ROAD_TAGS.map((tag: RoadTag) => (
              <FilterChip
                key={tag}
                label={words.roadTag[tag].label}
                hint={words.roadTag[tag].hint}
                count={countWith({ tags: [tag] })}
                pressed={filters.tags.includes(tag)}
                onPressedChange={(on) =>
                  set(
                    "tags",
                    on
                      ? ROAD_TAGS.filter(
                          (x) => x === tag || filters.tags.includes(x),
                        )
                      : filters.tags.filter((x) => x !== tag),
                  )
                }
              >
                <TagIcon tag={tag} />
                {words.roadTag[tag].label}
              </FilterChip>
            ))}
          </ChipGroup>

          <ThresholdChips
            id="f-traffic"
            label={t.sidebar.filters.traffic}
            options={TRAFFIC_OPTIONS}
            count={(v) => countWith({ maxTraffic: v })}
            scale
            value={filters.maxTraffic}
            onChange={(v) => set("maxTraffic", v)}
          />
          <ThresholdChips
            id="f-beauty"
            label={t.sidebar.filters.beauty}
            options={BEAUTY_OPTIONS}
            count={(v) => countWith({ minBeauty: v })}
            scale
            value={filters.minBeauty}
            onChange={(v) => set("minBeauty", v)}
          />
          <ThresholdChips
            id="f-fame"
            label={t.sidebar.filters.fame}
            options={FAME_OPTIONS}
            count={(v) => countWith({ minFame: v })}
            scale
            value={filters.minFame}
            onChange={(v) => set("minFame", v)}
          />

          {/* The raw summer signals of the chosen half-month, not the composite:
              "unter 24 °C im Tal" is a question the status alone cannot answer.
              The valley value is derived from the summit series, and the label
              says so, as every derived value in the app does. */}
          <ThresholdChips
            id="f-heat"
            label={t.sidebar.filters.heat}
            options={HEAT_OPTIONS}
            count={(v) => countWith({ maxValleyTmax: v })}
            value={filters.maxValleyTmax}
            onChange={(v) => set("maxValleyTmax", v)}
          />
          <ThresholdChips
            id="f-wet"
            label={t.sidebar.filters.wet}
            options={WET_OPTIONS}
            count={(v) => countWith({ maxWetDays: v })}
            value={filters.maxWetDays}
            onChange={(v) => set("maxWetDays", v)}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* What the chips just did, in one line. Live filtering only works when
          the result of a tap is visible from where the tap happened – and a
          dead end is never silent: it names the one filter that would bring
          the most back, which the same counting machinery works out. */}
      <div className="border-border flex items-center gap-2 border-t pt-2">
        <p
          aria-live="polite"
          className="text-muted-foreground text-2xs min-w-0 flex-1 truncate"
        >
          {counts.pass === 0 && relief ? (
            <>
              {fill(t.sidebar.filters.noRoadsWithout, { label: reliefLabel })}
              <span className="text-foreground font-medium tabular-nums">
                {fmt(relief.n)}
              </span>
              .
            </>
          ) : (
            <>
              <span className="text-foreground font-medium tabular-nums">
                {fmt(counts.pass)}
              </span>{" "}
              {fill(t.sidebar.filters.countRoads, { total: fmt(totals.pass) })}
              {", "}
              <span className="text-foreground font-medium tabular-nums">
                {fmt(counts.tour)}
              </span>{" "}
              {t.sidebar.filters.countTours}
            </>
          )}
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={count === 0}
          onClick={onReset}
          className={TOUCH_CONTROL}
        >
          <RotateCcw data-icon="inline-start" />
          {t.sidebar.filters.reset}
        </Button>
      </div>
    </div>
  );
};
