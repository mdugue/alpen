"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { EntityRow } from "@/components/sidebar/entity-row";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { Rating } from "@/components/rating";
import { StatusLabel } from "@/components/status-badge";
import { SeasonStrip } from "@/components/season-strip";
import { PASS_SORT_LABEL, sortPassRows, type PassRow, type PassSort } from "@/lib/rows";
import type { Filters } from "@/lib/app-state";
import { fmtUnit } from "@/lib/utils";

type RatingSort = "beauty" | "fame" | "difficulty" | "traffic";
const RATING_SORTS: readonly PassSort[] = ["beauty", "fame", "difficulty", "traffic"];

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
  const [sort, setSort] = useState<PassSort>("elevation");
  const passFilters = (filters.minFame > 1 ? 1 : 0) + (filters.minElevation > 0 ? 1 : 0);
  // Opens by itself when a link carries pass filters; the user's own toggling wins afterwards.
  const [filtersManual, setFiltersManual] = useState<boolean | null>(null);
  const filtersOpen = filtersManual ?? passFilters > 0;
  const sorted = sortPassRows(rows, sort);
  const ratingSort = RATING_SORTS.includes(sort) ? (sort as RatingSort) : null;

  return (
    <>
      <Collapsible open={filtersOpen} onOpenChange={setFiltersManual}>
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <NativeSelect
            size="sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as PassSort)}
            aria-label="Sortieren nach"
          >
            {(Object.keys(PASS_SORT_LABEL) as PassSort[]).map((k) => (
              <NativeSelectOption key={k} value={k}>
                {PASS_SORT_LABEL[k]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <CollapsibleTrigger render={<Button size="sm" variant="ghost" className="ml-auto" />}>
            <SlidersHorizontal data-icon="inline-start" />
            Filter
            {passFilters > 0 && <Badge variant="secondary">{passFilters}</Badge>}
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="border-b border-border px-3 py-2">
          <FieldGroup className="gap-2">
            <Field orientation="horizontal">
              <FieldLabel htmlFor="min-fame" className="w-24 shrink-0">
                Bekanntheit
              </FieldLabel>
              <NativeSelect
                size="sm"
                id="min-fame"
                value={filters.minFame}
                onChange={(e) => setFilters((f) => ({ ...f, minFame: Number(e.target.value) }))}
              >
                <NativeSelectOption value={1}>alle</NativeSelectOption>
                <NativeSelectOption value={3}>ab 3 von 5</NativeSelectOption>
                <NativeSelectOption value={4}>nur Klassiker</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field orientation="horizontal">
              <FieldTitle id="min-elevation" className="w-24 shrink-0 tabular-nums">
                {filters.minElevation > 0 ? `ab ${fmtUnit(filters.minElevation, "m")}` : "Jede Höhe"}
              </FieldTitle>
              <Slider
                aria-labelledby="min-elevation"
                value={[filters.minElevation]}
                min={0}
                max={2800}
                step={100}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, minElevation: Array.isArray(v) ? (v[0] ?? 0) : v }))
                }
                className="max-w-40"
              />
            </Field>
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
                  <span className="text-[13px] font-medium tabular-nums">{fmtUnit(pass.elevation, "m")}</span>
                  {ratingSort ? (
                    <Rating value={pass[ratingSort]} muted={ratingSort === "traffic"} />
                  ) : (
                    <StatusLabel status={status} className="text-muted-foreground" />
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
