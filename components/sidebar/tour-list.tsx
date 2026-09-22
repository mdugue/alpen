"use client";

import { useT } from "@/components/i18n";
import { SeasonStrip } from "@/components/season-strip";
import { EntityRow } from "@/components/sidebar/entity-row";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { ListToolbar } from "@/components/sidebar/list-toolbar";
import { RowList } from "@/components/sidebar/row-list";
import { StatusLabel } from "@/components/status-badge";
import { Switch } from "@/components/ui/switch";
import type { Selection } from "@/lib/app-state";
import { entityKey } from "@/lib/route-key";
import type { TourRow } from "@/lib/rows";
import type { Period } from "@/lib/types";
import { useRoving } from "@/lib/use-roving";
import { cn } from "@/lib/utils";

export const TourList = ({
  rows,
  currentRow,
  hovered,
  onHover,
  period,
  isShown,
  empty,
  mapControl,
  showRange,
  onToggleTour,
  onSelect,
  onToggleFavorite,
}: {
  rows: readonly TourRow[];
  currentRow: string | null;
  hovered: Selection | null;
  onHover: (sel: Selection | null) => void;
  period: Period;
  /** Whether a tour's "auf der Karte" switch is on (`isShown`, lib/app-state.ts). */
  isShown: (slug: string) => boolean;
  empty: Omit<React.ComponentProps<typeof ListEmpty>, "title">;
  /** The "auf der Karte" switch for this kind; it lives in the list, not by the tabs. */
  mapControl: React.ReactNode;
  /** Name the range first once the data holds more than one. */
  showRange: boolean;
  onToggleTour: (slug: string, on: boolean) => void;
  onSelect: (slug: string) => void;
  onToggleFavorite: (slug: string) => void;
}) => {
  const { t, fmt, fmtUnit } = useT();
  const rovingList = useRoving<HTMLDivElement>();
  const hoveredSlug = hovered?.kind === "tour" ? hovered.slug : null;
  return (
    <>
      <ListToolbar control={mapControl} />
      {rows.length === 0 ? (
        <ListEmpty title={t.sidebar.empty.noTours} {...empty} />
      ) : (
        <RowList ref={rovingList} items={rows} keyOf={({ tour }) => tour.slug}>
          {({ tour, status, reason, favorite, season, window, range }) => {
            const onMap = isShown(tour.slug);
            return (
              <EntityRow
                key={tour.slug}
                rowId={entityKey("tour", tour.slug)}
                current={currentRow === entityKey("tour", tour.slug)}
                hovered={hoveredSlug === tour.slug}
                onHover={(over) =>
                  onHover(over ? { kind: "tour", slug: tour.slug } : null)
                }
                className={cn(!onMap && "opacity-60")}
                leading={
                  <span
                    className="h-1.5 w-4 shrink-0 rounded-full"
                    style={{ background: tour.color }}
                  />
                }
                name={tour.name}
                title={tour.name}
                subtitle={[
                  showRange && range ? t.vocab.range[range].label : null,
                  t.sidebar.lists.passes(fmt(tour.passes.length)),
                  window,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                favorite={favorite}
                onToggleFavorite={() => onToggleFavorite(tour.slug)}
                onSelect={() => onSelect(tour.slug)}
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
                    aria-label={t.sidebar.lists.showTour(tour.name)}
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
