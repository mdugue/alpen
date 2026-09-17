"use client";

import type { CSSProperties } from "react";

import { SeasonStrip } from "@/components/season-strip";
import { EntityRow } from "@/components/sidebar/entity-row";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { ListToolbar } from "@/components/sidebar/list-toolbar";
import { StatusLabel } from "@/components/status-badge";
import { Switch } from "@/components/ui/switch";
import type { Selection } from "@/lib/app-state";
import type { TourRow } from "@/lib/rows";
import type { Period } from "@/lib/types";
import { useRoving } from "@/lib/use-roving";
import { cn, fmtUnit } from "@/lib/utils";

export const TourList = ({
  rows,
  currentRow,
  hovered,
  onHover,
  period,
  hiddenTours,
  empty,
  mapControl,
  onToggleTour,
  onSelect,
  onToggleFavorite,
}: {
  rows: TourRow[];
  currentRow: string | null;
  hovered: Selection | null;
  onHover: (sel: Selection | null) => void;
  period: Period;
  hiddenTours: string[];
  empty: Omit<React.ComponentProps<typeof ListEmpty>, "title">;
  /** The "auf der Karte" switch for this kind; it lives in the list, not by the tabs. */
  mapControl: React.ReactNode;
  onToggleTour: (slug: string, on: boolean) => void;
  onSelect: (slug: string) => void;
  onToggleFavorite: (slug: string) => void;
}) => {
  const rovingList = useRoving<HTMLUListElement>();
  const hoveredSlug = hovered?.kind === "tour" ? hovered.slug : null;
  return (
    <>
      <ListToolbar control={mapControl} />
      {rows.length === 0 ? (
        <ListEmpty title="Keine Touren gefunden" {...empty} />
      ) : (
        <ul ref={rovingList}>
          {rows.map(({ tour, status, reason, favorite, season }) => {
            const onMap = !hiddenTours.includes(tour.slug);
            return (
              <EntityRow
                key={tour.slug}
                rowId={`tour:${tour.slug}`}
                current={currentRow === `tour:${tour.slug}`}
                hovered={hoveredSlug === tour.slug}
                onHover={(over) =>
                  onHover(over ? { kind: "tour", slug: tour.slug } : null)
                }
                className={cn(!onMap && "opacity-60")}
                leading={
                  <span
                    className="h-1.5 w-4 shrink-0 rounded-full bg-(--tour-color)"
                    style={{ "--tour-color": tour.color } as CSSProperties}
                  />
                }
                name={tour.name}
                title={tour.name}
                subtitle={`${tour.passes.length} Pässe · ${tour.season.split(";")[0]}`}
                favorite={favorite}
                onToggleFavorite={() => onToggleFavorite(tour.slug)}
                onSelect={() => onSelect(tour.slug)}
                aside={
                  <>
                    <span className="text-xs font-medium whitespace-nowrap tabular-nums">
                      {fmtUnit(tour.km, "km")} ·{" "}
                      {fmtUnit(tour.elevationGain, "hm")}
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
                    aria-label={`${tour.name} auf der Karte anzeigen`}
                  />
                }
              />
            );
          })}
        </ul>
      )}
    </>
  );
};
