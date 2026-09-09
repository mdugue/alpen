"use client";

import { SlidersHorizontal, Star } from "lucide-react";
import { useState } from "react";

import { StatusDot } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ALL_STATUS,
  BEAUTY_OPTIONS,
  countCriteria,
  FAME_OPTIONS,
  HEAT_OPTIONS,
  RATING_MAX,
  RATING_MIN,
  TRAFFIC_OPTIONS,
  WET_OPTIONS,
} from "@/lib/app-state";
import type { Filters } from "@/lib/app-state";
import { STATUS_LABEL } from "@/lib/status";
import type { Status } from "@/lib/types";
import { cn, fmtUnit, PRESSED, TOUCH_CONTROL, TOUCH_SELECT } from "@/lib/utils";

/** Base UI hands back a number for a single thumb and an array for a range. */
const asRange = (v: number | readonly number[]): [number, number] =>
  Array.isArray(v)
    ? [v[0] ?? RATING_MIN, v[1] ?? RATING_MAX]
    : [v as number, v as number];

/** A labelled native select for one 1–5 threshold; label above, so three fit in a row. */
const Select = ({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  options: readonly (readonly [value: number, label: string])[];
}) => (
  <Field className={cn("gap-1")}>
    <FieldLabel htmlFor={id} className="text-muted-foreground text-2xs">
      {label}
    </FieldLabel>
    <NativeSelect
      size="sm"
      id={id}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn("w-full", TOUCH_SELECT)}
    >
      {options.map(([v, text]) => (
        <NativeSelectOption key={v} value={v}>
          {text}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  </Field>
);

/**
 * The one filter panel of the app: the bookmarks, the status picker and the
 * pass criteria. Everything here applies to passes and tours alike (see
 * `Filters`), so it sits above the lists rather than inside one of them, and
 * every control is inline – a popup over a bottom sheet is one edge case too
 * many on a phone.
 */
export const FilterPanel = ({
  filters,
  setFilters,
  favoriteCount,
  search,
  hidden,
}: {
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  /** Shown on the bookmark filter, which is the only filter with a count. */
  favoriteCount: number;
  /** The search row; the trigger sits at its end so the panel costs no row of its own. */
  search: React.ReactNode;
  /** Bottom sheet at its peek height: only the search row stays. */
  hidden?: boolean;
}) => {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const statusFiltered = filters.status.length !== ALL_STATUS.length;
  const active =
    countCriteria(filters) +
    (statusFiltered ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0);
  // Opens by itself when a link carries filters; the user's own toggling wins afterwards.
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? active > 0;
  const [minDifficulty, maxDifficulty] = filters.difficulty;
  const difficultyLabel =
    minDifficulty === RATING_MIN && maxDifficulty === RATING_MAX
      ? "Jede Schwierigkeit"
      : minDifficulty === maxDifficulty
        ? `Schwierigkeit ${minDifficulty}`
        : `Schwierigkeit ${minDifficulty}–${maxDifficulty}`;

  return (
    <Collapsible open={open} onOpenChange={setManual}>
      <div className="flex items-center gap-2">
        {search}
        <CollapsibleTrigger
          render={
            <Button
              variant="outline"
              className={cn(TOUCH_CONTROL, hidden && "hidden")}
            />
          }
        >
          <SlidersHorizontal data-icon="inline-start" />
          Filter
          {active > 0 && <Badge variant="secondary">{active}</Badge>}
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent
        className={cn("grid gap-1.5 pt-2", hidden && "hidden")}
      >
        <Toggle
          variant="outline"
          pressed={filters.favoritesOnly}
          onPressedChange={(on) => set("favoritesOnly", on)}
          aria-label="Nur Gemerkte anzeigen"
          className={cn("justify-start gap-2", TOUCH_CONTROL, PRESSED)}
        >
          <Star className={cn(filters.favoritesOnly && "fill-current")} />
          Nur Gemerkte
          {favoriteCount > 0 && (
            <span className="ml-auto tabular-nums">{favoriteCount}</span>
          )}
        </Toggle>
        <ToggleGroup
          multiple
          spacing={0}
          variant="outline"
          value={filters.status}
          onValueChange={(picked) =>
            set(
              "status",
              ALL_STATUS.filter((s) => picked.includes(s)),
            )
          }
          aria-label="Status filtern"
          className="w-full"
        >
          {/* Filled dot = kept in the lists and on the map, hollow = filtered out. */}
          {ALL_STATUS.map((s: Status) => (
            <ToggleGroupItem
              key={s}
              value={s}
              className={cn("flex-1", TOUCH_CONTROL)}
            >
              <StatusDot status={s} hollow={!filters.status.includes(s)} />
              <span className="truncate">{STATUS_LABEL[s]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {/* The drawer must not read a drag on a slider as a swipe on the sheet. */}
        <Field orientation="horizontal" data-base-ui-swipe-ignore>
          <FieldTitle id="difficulty" className="w-32 shrink-0 tabular-nums">
            {difficultyLabel}
          </FieldTitle>
          <Slider
            aria-labelledby="difficulty"
            value={filters.difficulty}
            min={RATING_MIN}
            max={RATING_MAX}
            step={1}
            onValueChange={(v) => set("difficulty", asRange(v))}
          />
        </Field>
        <Field orientation="horizontal" data-base-ui-swipe-ignore>
          <FieldTitle id="min-elevation" className="w-32 shrink-0 tabular-nums">
            {filters.minElevation > 0
              ? `ab ${fmtUnit(filters.minElevation, "m")}`
              : "Jede Höhe"}
          </FieldTitle>
          <Slider
            aria-labelledby="min-elevation"
            value={[filters.minElevation]}
            min={0}
            max={2800}
            step={100}
            onValueChange={(v) =>
              set("minElevation", Array.isArray(v) ? (v[0] ?? 0) : v)
            }
          />
        </Field>
        <FieldGroup className="grid grid-cols-3 gap-2">
          <Select
            id="max-traffic"
            label="Verkehr"
            value={filters.maxTraffic}
            onChange={(v) => set("maxTraffic", v)}
            options={TRAFFIC_OPTIONS}
          />
          <Select
            id="min-beauty"
            label="Schönheit"
            value={filters.minBeauty}
            onChange={(v) => set("minBeauty", v)}
            options={BEAUTY_OPTIONS}
          />
          <Select
            id="min-fame"
            label="Bekanntheit"
            value={filters.minFame}
            onChange={(v) => set("minFame", v)}
            options={FAME_OPTIONS}
          />
        </FieldGroup>
        {/* The raw summer signals of the chosen half-month, not the composite:
            "unter 28 °C im Tal" is a question the status alone cannot answer. */}
        <FieldGroup className="grid grid-cols-3 gap-2">
          <Select
            id="max-heat"
            label="Hitze im Tal"
            value={filters.maxValleyTmax}
            onChange={(v) => set("maxValleyTmax", v)}
            options={HEAT_OPTIONS}
          />
          <Select
            id="max-wet"
            label="Regentage"
            value={filters.maxWetPct}
            onChange={(v) => set("maxWetPct", v)}
            options={WET_OPTIONS}
          />
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  );
};
