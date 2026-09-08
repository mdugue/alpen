"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { Rating } from "@/components/rating";
import { SeasonStrip } from "@/components/season-strip";
import { EntityRow } from "@/components/sidebar/entity-row";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { StatusLabel } from "@/components/status-badge";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { countPassFilters, RATING_MAX, RATING_MIN } from "@/lib/app-state";
import type { Filters, PassSort } from "@/lib/app-state";
import { REGIONS } from "@/lib/regions";
import { PASS_SORT_LABEL, sortPassRows } from "@/lib/rows";
import type { PassRow } from "@/lib/rows";
import type { Region } from "@/lib/types";
import { cn, fmtUnit, PRESSED } from "@/lib/utils";

type RatingSort = "beauty" | "fame" | "difficulty" | "traffic";
const RATING_SORTS: readonly PassSort[] = [
  "beauty",
  "fame",
  "difficulty",
  "traffic",
];

/** Base UI hands back a number for a single thumb and an array for a range. */
const asRange = (v: number | readonly number[]): [number, number] =>
  Array.isArray(v)
    ? [v[0] ?? RATING_MIN, v[1] ?? RATING_MAX]
    : [v as number, v as number];

export function PassList({
  rows,
  currentRow,
  filters,
  setFilters,
  onSelect,
  onToggleFavorite,
}: {
  rows: PassRow[];
  currentRow: string | null;
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  onSelect: (slug: string) => void;
  onToggleFavorite: (slug: string) => void;
}) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const passFilters = countPassFilters(filters);
  // Opens by itself when a link carries pass filters; the user's own toggling wins afterwards.
  const [filtersManual, setFiltersManual] = useState<boolean | null>(null);
  const filtersOpen = filtersManual ?? passFilters > 0;
  const sorted = sortPassRows(rows, filters.sort);
  const ratingSort = RATING_SORTS.includes(filters.sort)
    ? (filters.sort as RatingSort)
    : null;
  const [minDifficulty, maxDifficulty] = filters.difficulty;
  const difficultyLabel =
    minDifficulty === RATING_MIN && maxDifficulty === RATING_MAX
      ? "Jede Schwierigkeit"
      : minDifficulty === maxDifficulty
        ? `Schwierigkeit ${minDifficulty}`
        : `Schwierigkeit ${minDifficulty}–${maxDifficulty}`;

  return (
    <>
      <Collapsible open={filtersOpen} onOpenChange={setFiltersManual}>
        <div className="border-border flex items-center gap-2 border-b px-3 py-1.5">
          <NativeSelect
            size="sm"
            value={filters.sort}
            onChange={(e) => set("sort", e.target.value as PassSort)}
            aria-label="Sortieren nach"
          >
            {(Object.keys(PASS_SORT_LABEL) as PassSort[]).map((k) => (
              <NativeSelectOption key={k} value={k}>
                {PASS_SORT_LABEL[k]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <CollapsibleTrigger
            render={<Button size="sm" variant="ghost" className="ml-auto" />}
          >
            <SlidersHorizontal data-icon="inline-start" />
            Filter
            {passFilters > 0 && (
              <Badge variant="secondary">{passFilters}</Badge>
            )}
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="border-border border-b px-3 py-2">
          <FieldGroup className="gap-2">
            <Field>
              <FieldTitle id="regions">Region</FieldTitle>
              <ToggleGroup
                multiple
                variant="outline"
                size="sm"
                spacing={0}
                value={filters.regions}
                onValueChange={(v) =>
                  set(
                    "regions",
                    REGIONS.filter((r) => v.includes(r)),
                  )
                }
                aria-labelledby="regions"
                className="w-full"
              >
                {REGIONS.map((r: Region) => (
                  <ToggleGroupItem
                    key={r}
                    value={r}
                    className={cn(
                      "flex-1 px-1 text-[11px]",
                      !filters.regions.includes(r) && "text-muted-foreground",
                      PRESSED,
                    )}
                  >
                    {r}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <div className="grid gap-2">
              <Field orientation="horizontal">
                <FieldTitle
                  id="difficulty"
                  className="w-24 shrink-0 tabular-nums"
                >
                  {difficultyLabel}
                </FieldTitle>
                <Slider
                  aria-labelledby="difficulty"
                  value={filters.difficulty}
                  min={RATING_MIN}
                  max={RATING_MAX}
                  step={1}
                  onValueChange={(v) => set("difficulty", asRange(v))}
                  className="max-w-48"
                />
              </Field>
              <Field orientation="horizontal">
                <FieldTitle
                  id="min-elevation"
                  className="w-24 shrink-0 tabular-nums"
                >
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
                  className="max-w-48"
                />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="max-traffic" className="w-24 shrink-0">
                  Verkehr
                </FieldLabel>
                <NativeSelect
                  size="sm"
                  id="max-traffic"
                  value={filters.maxTraffic}
                  onChange={(e) => set("maxTraffic", Number(e.target.value))}
                >
                  <NativeSelectOption value={5}>egal</NativeSelectOption>
                  <NativeSelectOption value={3}>höchstens 3</NativeSelectOption>
                  <NativeSelectOption value={2}>höchstens 2</NativeSelectOption>
                  <NativeSelectOption value={1}>nur ruhige</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="min-beauty" className="w-24 shrink-0">
                  Schönheit
                </FieldLabel>
                <NativeSelect
                  size="sm"
                  id="min-beauty"
                  value={filters.minBeauty}
                  onChange={(e) => set("minBeauty", Number(e.target.value))}
                >
                  <NativeSelectOption value={1}>alle</NativeSelectOption>
                  <NativeSelectOption value={3}>ab 3 von 5</NativeSelectOption>
                  <NativeSelectOption value={4}>ab 4 von 5</NativeSelectOption>
                  <NativeSelectOption value={5}>
                    nur die schönsten
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="min-fame" className="w-24 shrink-0">
                  Bekanntheit
                </FieldLabel>
                <NativeSelect
                  size="sm"
                  id="min-fame"
                  value={filters.minFame}
                  onChange={(e) => set("minFame", Number(e.target.value))}
                >
                  <NativeSelectOption value={1}>alle</NativeSelectOption>
                  <NativeSelectOption value={3}>ab 3 von 5</NativeSelectOption>
                  <NativeSelectOption value={4}>
                    nur Klassiker
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
          </FieldGroup>
        </CollapsibleContent>
      </Collapsible>

      {sorted.length === 0 ? (
        <ListEmpty title="Keine Pässe für diese Filter" />
      ) : (
        <ul>
          {sorted.map(({ pass, status, favorite, season }) => (
            <EntityRow
              key={pass.slug}
              rowId={`pass:${pass.slug}`}
              current={currentRow === `pass:${pass.slug}`}
              title={pass.name}
              subtitle={`${pass.region} · ${pass.country}`}
              favorite={favorite}
              onToggleFavorite={() => onToggleFavorite(pass.slug)}
              onSelect={() => onSelect(pass.slug)}
              aside={
                <>
                  <span className="text-[13px] font-medium tabular-nums">
                    {fmtUnit(pass.elevation, "m")}
                  </span>
                  {ratingSort ? (
                    <Rating
                      value={pass[ratingSort]}
                      muted={ratingSort === "traffic"}
                    />
                  ) : (
                    <StatusLabel
                      status={status}
                      className="text-muted-foreground"
                    />
                  )}
                  <SeasonStrip statuses={season} current={filters.period} />
                </>
              }
            />
          ))}
        </ul>
      )}
    </>
  );
}
