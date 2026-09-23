"use client";

import { ArrowDownWideNarrow } from "lucide-react";

import { useT } from "@/components/i18n";
import { Rating } from "@/components/rating";
import { SeasonStrip } from "@/components/season-strip";
import { EntityRow } from "@/components/sidebar/entity-row";
import type { RowContext } from "@/components/sidebar/entity-row";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { ListToolbar } from "@/components/sidebar/list-toolbar";
import { RowList } from "@/components/sidebar/row-list";
import { StatusLabel } from "@/components/status-badge";
import { TagLine } from "@/components/tags";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PASS_SORTS } from "@/lib/app-state";
import type { Filters, PassSort } from "@/lib/app-state";
import { typeWord } from "@/lib/i18n";
import { fill } from "@/lib/i18n/fill";
import type { PassRow } from "@/lib/rows";
import { cn, TOUCH_CONTROL } from "@/lib/utils";

type RatingSort = "beauty" | "fame" | "difficulty" | "traffic";
const RATING_SORTS: ReadonlySet<PassSort> = new Set([
  "beauty",
  "fame",
  "difficulty",
  "traffic",
]);

export const PassList = ({
  rows,
  row,
  filters,
  setFilters,
  empty,
  mapControl,
}: {
  rows: readonly PassRow[];
  /** What every row does with its entity (`RowContext`). */
  row: RowContext;
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  empty: Omit<React.ComponentProps<typeof ListEmpty>, "title">;
  /** The "auf der Karte" switch for this kind; it lives in the list, not by the tabs. */
  mapControl: React.ReactNode;
}) => {
  const { t, fmtUnit } = useT();
  const ratingSort = RATING_SORTS.has(filters.sort)
    ? (filters.sort as RatingSort)
    : null;

  return (
    <>
      {/*
        A menu rather than a native select: on a coarse pointer every native
        control is forced to a 16 px font (app/globals.css, against Safari's
        focus zoom), which in this dense row reads as a headline sitting among
        the labels. A menu is ordinary markup and keeps the row's own scale,
        and it shows the seven keys in one list instead of behind an OS wheel.
      */}
      <ListToolbar control={mapControl}>
        <span className="text-muted-foreground text-2xs">
          {t.sidebar.lists.sort}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                aria-label={fill(t.sidebar.lists.sortBy, {
                  label: t.vocab.sort[filters.sort],
                })}
                className={cn("-my-0.5 px-2 font-normal", TOUCH_CONTROL)}
              />
            }
          >
            <ArrowDownWideNarrow data-icon="inline-start" />
            {t.vocab.sort[filters.sort]}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={filters.sort}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, sort: v as PassSort }))
              }
            >
              {PASS_SORTS.map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>
                  {t.vocab.sort[k]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ListToolbar>

      {rows.length === 0 ? (
        <ListEmpty title={t.sidebar.empty.noPasses} {...empty} />
      ) : (
        <RowList items={rows} keyOf={({ pass }) => pass.slug}>
          {({ pass, status, reason, favorite, season }) => (
            <EntityRow
              entity={{ kind: "pass", slug: pass.slug }}
              row={row}
              name={pass.name}
              subtitle={
                <TagLine
                  tags={pass.tags ?? []}
                  lead={[
                    typeWord(pass.type, t),
                    t.vocab.region[pass.region],
                    pass.country,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              }
              favorite={favorite}
              aside={
                <>
                  <span className="text-xs font-medium tabular-nums">
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
                  <SeasonStrip cells={season} current={filters.period} />
                </>
              }
            />
          )}
        </RowList>
      )}
    </>
  );
};
