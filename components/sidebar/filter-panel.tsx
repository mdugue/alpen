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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel, FieldTitle } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import {
  ALL_STATUS,
  countCriteria,
  RATING_MAX,
  RATING_MIN,
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

/**
 * The one filter panel of the app: the status picker and the pass criteria.
 * Everything here applies to passes and tours alike (see `Filters`), so it
 * sits above the lists rather than inside one of them.
 */
export function FilterPanel({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
}) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const criteria = countCriteria(filters);
  // Opens by itself when a link carries criteria; the user's own toggling wins afterwards.
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? criteria > 0;
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
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-between font-normal"
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
            <ChevronDown className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
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
          </DropdownMenuContent>
        </DropdownMenu>
        <CollapsibleTrigger
          render={<Button size="sm" variant={open ? "secondary" : "ghost"} />}
        >
          <SlidersHorizontal data-icon="inline-start" />
          Filter
          {criteria > 0 && <Badge variant="secondary">{criteria}</Badge>}
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="grid gap-1.5 pt-2">
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
        <div className="grid grid-cols-3 gap-2">
          <Select
            id="max-traffic"
            label="Verkehr"
            value={filters.maxTraffic}
            onChange={(v) => set("maxTraffic", v)}
            options={[
              [5, "egal"],
              [3, "höchstens 3"],
              [2, "höchstens 2"],
              [1, "nur ruhige"],
            ]}
          />
          <Select
            id="min-beauty"
            label="Schönheit"
            value={filters.minBeauty}
            onChange={(v) => set("minBeauty", v)}
            options={[
              [1, "alle"],
              [3, "ab 3 von 5"],
              [4, "ab 4 von 5"],
              [5, "nur 5 von 5"],
            ]}
          />
          <Select
            id="min-fame"
            label="Bekanntheit"
            value={filters.minFame}
            onChange={(v) => set("minFame", v)}
            options={[
              [1, "alle"],
              [3, "ab 3 von 5"],
              [4, "nur Klassiker"],
            ]}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** A labelled native select for one 1–5 threshold; label above, so three fit in a row. */
function Select({
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
  options: [value: number, label: string][];
}) {
  return (
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
}
