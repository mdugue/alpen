"use client";

import { SeasonStrip } from "@/components/season-strip";
import { EntityRow } from "@/components/sidebar/entity-row";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { StatusLabel } from "@/components/status-badge";
import { Switch } from "@/components/ui/switch";
import type { TourRow } from "@/lib/rows";
import type { Period } from "@/lib/types";
import { cn, fmtUnit } from "@/lib/utils";

export function TourList({
  rows,
  currentRow,
  period,
  hiddenTours,
  onToggleTour,
  onSelect,
  onToggleFavorite,
}: {
  rows: TourRow[];
  currentRow: string | null;
  period: Period;
  hiddenTours: string[];
  onToggleTour: (slug: string, on: boolean) => void;
  onSelect: (slug: string) => void;
  onToggleFavorite: (slug: string) => void;
}) {
  if (rows.length === 0)
    return <ListEmpty title="Keine Touren für diese Filter" />;
  return (
    <ul>
      {rows.map(({ tour, status, favorite, season }) => {
        const onMap = !hiddenTours.includes(tour.slug);
        return (
          <EntityRow
            key={tour.slug}
            rowId={`tour:${tour.slug}`}
            current={currentRow === `tour:${tour.slug}`}
            className={cn(!onMap && "opacity-60")}
            leading={
              <span
                className="h-1.5 w-4 shrink-0 rounded-full"
                style={{ background: tour.color }}
              />
            }
            title={tour.name}
            subtitle={`${tour.passes.length} Pässe · ${tour.season.split(";")[0]}`}
            favorite={favorite}
            onToggleFavorite={() => onToggleFavorite(tour.slug)}
            onSelect={() => onSelect(tour.slug)}
            aside={
              <>
                <span className="text-[13px] font-medium whitespace-nowrap tabular-nums">
                  {fmtUnit(tour.km, "km")} · {fmtUnit(tour.elevationGain, "hm")}
                </span>
                <StatusLabel
                  status={status}
                  className="text-muted-foreground"
                />
                <SeasonStrip statuses={season} current={period} />
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
  );
}
