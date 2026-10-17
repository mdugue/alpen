"use client";

import { useT } from "@/components/i18n";
import { SeasonStrip } from "@/components/season-strip";
import { EntityRow } from "@/components/sidebar/entity-row";
import type { RowContext } from "@/components/sidebar/entity-row";
import { FilterChip } from "@/components/sidebar/filter-chip";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { ListToolbar } from "@/components/sidebar/list-toolbar";
import { RowList } from "@/components/sidebar/row-list";
import { StatusLabel } from "@/components/status-badge";
import { Switch } from "@/components/ui/switch";
import { ALL_TOUR_TYPES, pickedMembers, toggleMember } from "@/lib/app-state";
import type { Filters } from "@/lib/app-state";
import { fill } from "@/lib/i18n/fill";
import type { TourRow } from "@/lib/rows";
import type { Period, TourType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const TourList = ({
  rows,
  row,
  period,
  tourTypes,
  onTourTypes,
  countWith,
  isShown,
  empty,
  mapControl,
  showRange,
  onToggleTour,
}: {
  rows: readonly TourRow[];
  /** What every row does with its entity (`RowContext`). */
  row: RowContext;
  period: Period;
  /** The kinds of tour the list keeps (`Filters.tourTypes`). */
  tourTypes: TourType[];
  onTourTypes: (types: TourType[]) => void;
  /** How many loops a filter change would leave (`tourFacetCount`). */
  countWith: (patch: Partial<Filters>) => number;
  /** Whether a tour's "auf der Karte" switch is on (`isShown`, lib/app-state.ts). */
  isShown: (slug: string) => boolean;
  empty: Omit<React.ComponentProps<typeof ListEmpty>, "title">;
  /** The "auf der Karte" switch for this kind; it lives in the list, not by the tabs. */
  mapControl: React.ReactNode;
  /** Name the range first once the data holds more than one. */
  showRange: boolean;
  onToggleTour: (slug: string, on: boolean) => void;
}) => {
  const { t, fmt, fmtUnit } = useT();
  const picked = pickedMembers(tourTypes, ALL_TOUR_TYPES);
  return (
    <>
      <ListToolbar control={mapControl} />
      {/* The one filter only loops have, so it sits over their list rather
          than in the panel whose chips count roads. One row that scrolls
          sideways, like the applied filters, so it never pushes the list
          down on a phone. */}
      <div
        role="group"
        aria-label={t.sidebar.filters.tourType}
        className={cn(
          "border-border flex gap-1.5 overflow-x-auto border-b px-3 py-1.5",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
        data-base-ui-swipe-ignore
      >
        {ALL_TOUR_TYPES.map((type) => (
          <FilterChip
            key={type}
            label={t.vocab.tourType[type].label}
            hint={t.vocab.tourType[type].hint}
            count={countWith({ tourTypes: [type] })}
            left={t.sidebar.filters.toursLeft}
            pressed={picked.includes(type)}
            onPressedChange={() =>
              onTourTypes(toggleMember(tourTypes, ALL_TOUR_TYPES, type))
            }
            className="shrink-0"
          >
            {t.vocab.tourType[type].label}
          </FilterChip>
        ))}
      </div>
      {rows.length === 0 ? (
        <ListEmpty title={t.sidebar.empty.noTours} {...empty} />
      ) : (
        <RowList items={rows} keyOf={({ tour }) => tour.slug}>
          {({ tour, status, reason, favorite, season, window, range }) => {
            const onMap = isShown(tour.slug);
            return (
              <EntityRow
                entity={{ kind: "tour", slug: tour.slug }}
                row={row}
                className={cn(!onMap && "opacity-60")}
                leading={
                  <span
                    className="h-1.5 w-4 shrink-0 rounded-full"
                    style={{ background: tour.color }}
                  />
                }
                name={tour.name}
                subtitle={[
                  t.vocab.tourType[tour.type].label,
                  showRange && range ? t.vocab.range[range].label : null,
                  fill(t.sidebar.lists.passes, { n: fmt(tour.passes.length) }),
                  window,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                favorite={favorite}
                aside={
                  <>
                    <span className="text-xs font-medium whitespace-nowrap tabular-nums">
                      {fmtUnit(tour.km, "km")} ·{" "}
                      {fmtUnit(tour.elevationGain, t.vocab.unit.climb)}
                    </span>
                    <StatusLabel
                      status={status}
                      reason={reason}
                      className="text-muted-foreground"
                    />
                    <SeasonStrip cells={season} current={period} />
                  </>
                }
                trailing={
                  <Switch
                    size="sm"
                    checked={onMap}
                    onCheckedChange={(on) => onToggleTour(tour.slug, on)}
                    aria-label={fill(t.sidebar.lists.showTour, {
                      name: tour.name,
                    })}
                  />
                }
              />
            );
          }}
        </RowList>
      )}
    </>
  );
};
