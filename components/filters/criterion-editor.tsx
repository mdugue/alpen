"use client";

import { Star } from "lucide-react";

import { useT } from "@/components/i18n";
import {
  ChipGroup,
  FilterChip,
  ThresholdChips,
} from "@/components/sidebar/filter-chip";
import { StatusDot } from "@/components/status-badge";
import { TagIcon } from "@/components/tags";
import {
  ALL_RANGES,
  ALL_STATUS,
  ALL_SURFACES,
  ALL_TOUR_TYPES,
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
import type { Filters } from "@/lib/app-state";
import { difficultyLabel } from "@/lib/filter-summary";
import type { CriterionId } from "@/lib/filter-summary";
import { fill } from "@/lib/i18n/fill";
import { periodLabel } from "@/lib/period";
import { CLASSIC_FAME, rangeRows, ROAD_TAGS } from "@/lib/regions";
import type { RangeName } from "@/lib/regions";
import type { RoadTag, RoadType, Status, Surface } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVELS = [1, 2, 3, 4, 5] as const;

export interface EditorProps {
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  /**
   * How many roads would be left by a filter change – the number on every
   * chip. The patch carries the option *and* lifts its own group's filter, so
   * a group's numbers never depend on that group's own choice; `facetCount`
   * in `lib/rows.ts` says why that is the only honest way to count, and why
   * it also keeps the numbers still while a group is being tapped.
   */
  countWith: (patch: Partial<Filters>) => number;
  /** The same for the loops, behind the tour criteria (`tourFacetCount`). */
  tourCountWith: (patch: Partial<Filters>) => number;
  /** The ranges the data holds a road for. */
  ranges: readonly RangeName[];
  /** A range chip pressed – the one chip that also frames (`range` in `reduce`). */
  onRange: (range: RangeName) => void;
}

/**
 * What one criterion's popover holds: its chips, each carrying the count it
 * would leave. The chips are the ones the old filter panel stacked into one
 * column; here each criterion is asked on its own, from its token in the bar
 * over the map, so the panel never has to be scrolled to find one.
 *
 * Nothing is applied on a button: the list, the map and the counts change
 * under every tap, and the token in the bar says what is set.
 */
export const CriterionEditor = ({
  id,
  filters,
  setFilters,
  countWith,
  tourCountWith,
  ranges,
  onRange,
}: EditorProps & { id: CriterionId }) => {
  const { t } = useT();
  const words = t.vocab;
  const label = t.sidebar.filters;
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  switch (id) {
    case "ranges": {
      const picked = pickedMembers(filters.ranges, ALL_RANGES);
      return (
        <>
          {rangeRows(ranges).map(({ trip, row }) => (
            <ChipGroup
              key={trip ?? "all"}
              id={`f-ranges${trip ? `-${trip}` : ""}`}
              label={
                trip
                  ? fill(label.rangeTrip, { trip: words.trip[trip] })
                  : label.range
              }
            >
              {row.map((r) => (
                <FilterChip
                  key={r}
                  label={words.range[r].label}
                  hint={words.range[r].hint}
                  count={countWith({ ranges: [r] })}
                  pressed={picked.includes(r)}
                  onPressedChange={() => onRange(r)}
                >
                  {words.range[r].label}
                </FilterChip>
              ))}
            </ChipGroup>
          ))}
        </>
      );
    }
    case "favorites": {
      return (
        <FilterChip
          label={label.favoritesOnly}
          count={countWith({ favoritesOnly: true })}
          pressed={filters.favoritesOnly}
          onPressedChange={(on) => set("favoritesOnly", on)}
          className="w-fit"
        >
          <Star className={cn(filters.favoritesOnly && "fill-current")} />
          {label.favoritesOnly}
        </FilterChip>
      );
    }
    case "fame": {
      return (
        <ThresholdChips
          id="f-fame"
          label={fill(label.fame, { n: CLASSIC_FAME })}
          options={FAME_OPTIONS}
          count={(v) => countWith({ minFame: v })}
          scale
          value={filters.minFame}
          onChange={(v) => set("minFame", v)}
        />
      );
    }
    case "difficulty": {
      // Five cells, one per level, and the window they span is the filter.
      // The number on a cell is how many roads sit at that level, not what
      // pressing it would leave: a cell extends or shrinks a window rather
      // than replacing it, so "what happens if I press this" has no single
      // answer here.
      const [lo, hi] = filters.difficulty;
      const whole = lo === RATING_MIN && hi === RATING_MAX;
      return (
        <ChipGroup
          id="f-difficulty"
          label={label.difficulty}
          value={
            whole ? words.option.any : difficultyLabel(filters.difficulty, t)
          }
        >
          {LEVELS.map((n) => (
            <FilterChip
              key={n}
              label={fill(words.filter.difficultyOne, { level: n })}
              count={countWith({ difficulty: [n, n] })}
              pressed={!whole && n >= lo && n <= hi}
              onPressedChange={() =>
                set("difficulty", toggleLevel(filters.difficulty, n))
              }
              className="px-2.5 tabular-nums"
            >
              {n}
            </FilterChip>
          ))}
        </ChipGroup>
      );
    }
    case "elevation": {
      return (
        <ThresholdChips
          id="f-elevation"
          label={label.elevation}
          options={ELEVATION_OPTIONS}
          count={(v) => countWith({ minElevation: v })}
          value={filters.minElevation}
          onChange={(v) => set("minElevation", v)}
        />
      );
    }
    case "types": {
      const picked = pickedMembers(filters.types, ALL_TYPES);
      return (
        <ChipGroup id="f-types" label={label.roadType}>
          {ALL_TYPES.map((type: RoadType) => (
            <FilterChip
              key={type}
              label={words.roadType[type].label}
              hint={words.roadType[type].hint}
              count={countWith({ types: [type] })}
              pressed={picked.includes(type)}
              onPressedChange={() =>
                set("types", toggleMember(filters.types, ALL_TYPES, type))
              }
            >
              {words.roadType[type].label}
            </FilterChip>
          ))}
        </ChipGroup>
      );
    }
    case "surfaces": {
      // All three pressed is no filter, and a road cyclist who presses
      // nothing sees the gravel roads among the rest, dashed (plan 27).
      const picked = pickedMembers(filters.surfaces, ALL_SURFACES);
      return (
        <ChipGroup id="f-surfaces" label={label.surface}>
          {ALL_SURFACES.map((x: Surface) => (
            <FilterChip
              key={x}
              label={words.surface[x].label}
              hint={words.surface[x].hint}
              count={countWith({ surfaces: [x] })}
              pressed={picked.includes(x)}
              onPressedChange={() =>
                set("surfaces", toggleMember(filters.surfaces, ALL_SURFACES, x))
              }
            >
              {words.surface[x].label}
            </FilterChip>
          ))}
        </ChipGroup>
      );
    }
    case "tags": {
      return (
        <ChipGroup id="f-tags" label={label.tags} hint={label.tagsHint}>
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
      );
    }
    case "traffic": {
      return (
        <ThresholdChips
          id="f-traffic"
          label={label.traffic}
          options={TRAFFIC_OPTIONS}
          count={(v) => countWith({ maxTraffic: v })}
          scale
          value={filters.maxTraffic}
          onChange={(v) => set("maxTraffic", v)}
        />
      );
    }
    case "beauty": {
      return (
        <ThresholdChips
          id="f-beauty"
          label={label.beauty}
          options={BEAUTY_OPTIONS}
          count={(v) => countWith({ minBeauty: v })}
          scale
          value={filters.minBeauty}
          onChange={(v) => set("minBeauty", v)}
        />
      );
    }
    case "status": {
      const picked = pickedMembers(filters.status, ALL_STATUS);
      return (
        <ChipGroup id="f-status" label={label.status}>
          {ALL_STATUS.map((s: Status) => {
            const on = picked.includes(s);
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
      );
    }
    case "heat": {
      // The raw summer signal of the chosen half-month, derived from the
      // summit series – and the label says so, as every derived value does.
      return (
        <ThresholdChips
          id="f-heat"
          label={label.heat}
          options={HEAT_OPTIONS}
          count={(v) => countWith({ maxValleyTmax: v })}
          value={filters.maxValleyTmax}
          onChange={(v) => set("maxValleyTmax", v)}
        />
      );
    }
    case "wet": {
      return (
        <ThresholdChips
          id="f-wet"
          label={label.wet}
          options={WET_OPTIONS}
          count={(v) => countWith({ maxWetDays: v })}
          value={filters.maxWetDays}
          onChange={(v) => set("maxWetDays", v)}
        />
      );
    }
    case "tourTypes": {
      const picked = pickedMembers(filters.tourTypes, ALL_TOUR_TYPES);
      return (
        <ChipGroup id="f-tour-types" label={label.tourType}>
          {ALL_TOUR_TYPES.map((type) => (
            <FilterChip
              key={type}
              label={words.tourType[type].label}
              hint={words.tourType[type].hint}
              count={tourCountWith({ tourTypes: [type] })}
              left={label.toursLeft}
              pressed={picked.includes(type)}
              onPressedChange={() =>
                set(
                  "tourTypes",
                  toggleMember(filters.tourTypes, ALL_TOUR_TYPES, type),
                )
              }
            >
              {words.tourType[type].label}
            </FilterChip>
          ))}
        </ChipGroup>
      );
    }
    case "onDate": {
      const text = fill(label.onDate, {
        period: periodLabel(filters.period, t),
      });
      return (
        <FilterChip
          label={text}
          hint={label.onDateHint}
          count={tourCountWith({ onDate: true })}
          left={label.toursLeft}
          pressed={filters.onDate}
          onPressedChange={(on) => set("onDate", on)}
          className="w-fit"
        >
          {text}
        </FilterChip>
      );
    }
    case "pastEditions": {
      return (
        <FilterChip
          label={label.pastEditions}
          hint={label.pastEditionsHint}
          count={tourCountWith({ pastEditions: true })}
          left={label.toursLeft}
          pressed={filters.pastEditions}
          onPressedChange={(on) => set("pastEditions", on)}
          className="w-fit"
        >
          {label.pastEditions}
        </FilterChip>
      );
    }
    default: {
      return id satisfies never;
    }
  }
};
