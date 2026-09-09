"use client";

import { Rating } from "@/components/rating";
import { SeasonStrip } from "@/components/season-strip";
import { EntityRow } from "@/components/sidebar/entity-row";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { StatusLabel } from "@/components/status-badge";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { Filters, PassSort } from "@/lib/app-state";
import { PASS_SORT_LABEL, PASS_SORTS, sortPassRows } from "@/lib/rows";
import type { PassRow } from "@/lib/rows";
import { fmtUnit, TOUCH_SELECT } from "@/lib/utils";

type RatingSort = "beauty" | "fame" | "difficulty" | "traffic";
const RATING_SORTS: ReadonlySet<PassSort> = new Set([
  "beauty",
  "fame",
  "difficulty",
  "traffic",
]);

export const PassList = ({
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
}) => {
  const sorted = sortPassRows(rows, filters.sort);
  const ratingSort = RATING_SORTS.has(filters.sort)
    ? (filters.sort as RatingSort)
    : null;

  return (
    <>
      <div className="border-border flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-muted-foreground text-[11px]">Sortieren</span>
        <NativeSelect
          size="sm"
          value={filters.sort}
          onChange={(e) =>
            setFilters((f) => ({ ...f, sort: e.target.value as PassSort }))
          }
          aria-label="Sortieren nach"
          className={TOUCH_SELECT}
        >
          {PASS_SORTS.map((k) => (
            <NativeSelectOption key={k} value={k}>
              {PASS_SORT_LABEL[k]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {sorted.length === 0 ? (
        <ListEmpty title="Keine Pässe für diese Filter" />
      ) : (
        <ul>
          {sorted.map(({ pass, status, reason, favorite, season }) => (
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
                      reason={reason}
                      className="text-muted-foreground"
                    />
                  )}
                  <SeasonStrip grades={season} current={filters.period} />
                </>
              }
            />
          ))}
        </ul>
      )}
    </>
  );
};
