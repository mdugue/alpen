"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  ALL_STATUS,
  BEAUTY_OPTIONS,
  countCriteria,
  FAME_OPTIONS,
  RATING_MAX,
  RATING_MIN,
  TRAFFIC_OPTIONS,
} from "@/lib/app-state";
import type { Filters } from "@/lib/app-state";
import { STATUS_LABEL } from "@/lib/status";
import type { Status } from "@/lib/types";
import { cn, fmtUnit } from "@/lib/utils";

/** Base UI hands back a number for a single thumb and an array for a range. */
const asRange = (v: number | readonly number[]): [number, number] =>
  Array.isArray(v)
    ? [v[0] ?? RATING_MIN, v[1] ?? RATING_MAX]
    : [v as number, v as number];

const statusSummary = (status: Status[]) =>
  status.length === ALL_STATUS.length
    ? "Jeder Status"
    : status.length === 0
      ? "Kein Status"
      : status.map((s) => STATUS_LABEL[s]).join(", ");

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
    <FieldLabel htmlFor={id} className="text-muted-foreground text-[11px]">
      {label}
    </FieldLabel>
    <NativeSelect
      size="sm"
      id={id}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
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
 * The one filter panel of the app: the status picker and the pass criteria.
 * Everything here applies to passes and tours alike (see `Filters`), so it
 * sits above the lists rather than inside one of them.
 */
export const FilterPanel = ({
  filters,
  setFilters,
  search,
  hidden,
}: {
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  /** The search row; the trigger sits at its end so the panel costs no row of its own. */
  search: React.ReactNode;
  /** Bottom sheet at its peek height: only the search row stays. */
  hidden?: boolean;
}) => {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const statusFiltered = filters.status.length !== ALL_STATUS.length;
  const active = countCriteria(filters) + (statusFiltered ? 1 : 0);
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
            <Button variant="outline" className={cn(hidden && "hidden")} />
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
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                className="justify-between font-normal"
              />
            }
            aria-label="Status filtern"
          >
            <span className="flex items-center gap-1.5 truncate">
              {ALL_STATUS.map((s) => (
                <StatusDot
                  key={s}
                  status={s}
                  hollow={!filters.status.includes(s)}
                />
              ))}
              <span className="truncate">{statusSummary(filters.status)}</span>
            </span>
            <ChevronDown
              data-icon="inline-end"
              className="text-muted-foreground"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              {ALL_STATUS.map((s: Status) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={filters.status.includes(s)}
                  onCheckedChange={(on) =>
                    set(
                      "status",
                      ALL_STATUS.filter((x) =>
                        x === s ? on : filters.status.includes(x),
                      ),
                    )
                  }
                >
                  <StatusDot status={s} />
                  {STATUS_LABEL[s]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Field orientation="horizontal">
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
        <Field orientation="horizontal">
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
      </CollapsibleContent>
    </Collapsible>
  );
};
