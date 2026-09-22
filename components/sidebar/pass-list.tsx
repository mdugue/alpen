"use client";

import { ArrowDownWideNarrow } from "lucide-react";

import { useT } from "@/components/i18n";
import { Rating } from "@/components/rating";
import { SeasonStrip } from "@/components/season-strip";
import { EntityRow } from "@/components/sidebar/entity-row";
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
import type { Filters, PassSort, Selection } from "@/lib/app-state";
import { typeWord } from "@/lib/i18n";
import { entityKey } from "@/lib/route-key";
import { sortLabel } from "@/lib/rows";
import type { PassRow } from "@/lib/rows";
import { useRoving } from "@/lib/use-roving";
import { cn, fmtUnit, TOUCH_CONTROL } from "@/lib/utils";

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
  hovered,
  onHover,
  filters,
  setFilters,
  empty,
  mapControl,
  onSelect,
  onToggleFavorite,
}: {
  rows: readonly PassRow[];
  currentRow: string | null;
  hovered: Selection | null;
  onHover: (sel: Selection | null) => void;
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  empty: Omit<React.ComponentProps<typeof ListEmpty>, "title">;
  /** The "auf der Karte" switch for this kind; it lives in the list, not by the tabs. */
  mapControl: React.ReactNode;
  onSelect: (slug: string) => void;
  onToggleFavorite: (slug: string) => void;
}) => {
  const { lang } = useT();
  const rovingList = useRoving<HTMLDivElement>();
  const hoveredSlug = hovered?.kind === "pass" ? hovered.slug : null;
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
        <span className="text-muted-foreground text-2xs">Sortieren</span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Sortieren nach: ${sortLabel(filters.sort, lang)}`}
                className={cn("-my-0.5 px-2 font-normal", TOUCH_CONTROL)}
              />
            }
          >
            <ArrowDownWideNarrow data-icon="inline-start" />
            {sortLabel(filters.sort, lang)}
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
                  {sortLabel(k, lang)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ListToolbar>

      {rows.length === 0 ? (
        <ListEmpty title="Keine Straßen gefunden" {...empty} />
      ) : (
        <RowList ref={rovingList} items={rows} keyOf={({ pass }) => pass.slug}>
          {({ pass, status, reason, favorite, season }) => (
            <EntityRow
              key={pass.slug}
              rowId={entityKey("pass", pass.slug)}
              current={currentRow === entityKey("pass", pass.slug)}
              hovered={hoveredSlug === pass.slug}
              onHover={(over) =>
                onHover(over ? { kind: "pass", slug: pass.slug } : null)
              }
              name={pass.name}
              title={pass.name}
              subtitle={
                <TagLine
                  tags={pass.tags ?? []}
                  lead={[typeWord(pass.type, lang), pass.region, pass.country]
                    .filter(Boolean)
                    .join(" · ")}
                />
              }
              favorite={favorite}
              onToggleFavorite={() => onToggleFavorite(pass.slug)}
              onSelect={() => onSelect(pass.slug)}
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
