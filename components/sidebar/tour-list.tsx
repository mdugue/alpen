"use client";

import { ViewTransition } from "react";

import { SeasonStrip } from "@/components/season-strip";
import { EntityRow } from "@/components/sidebar/entity-row";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { StatusLabel } from "@/components/status-badge";
import { Switch } from "@/components/ui/switch";
import type { TourRow } from "@/lib/rows";
import type { Period } from "@/lib/types";
import { cn, fmtUnit } from "@/lib/utils";
import { MORPH, ROW, stripName } from "@/lib/view-transitions";

export const TourList = ({
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
}) => {
  if (rows.length === 0)
    return <ListEmpty title="Keine Touren für diese Filter" />;
  return (
    <ul>
      {rows.map(({ tour, status, reason, favorite, season }) => {
        const onMap = !hiddenTours.includes(tour.slug);
        const current = currentRow === `tour:${tour.slug}`;
        const strip = <SeasonStrip cells={season} current={period} />;
        return (
          // Row identity and the strip that morphs into the panel; see
          // `components/sidebar/pass-list.tsx` for what the two boundaries do.
          <ViewTransition key={tour.slug} {...ROW}>
            <EntityRow
              rowId={`tour:${tour.slug}`}
              current={current}
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
                  <span className="text-xs font-medium whitespace-nowrap tabular-nums">
                    {fmtUnit(tour.km, "km")} ·{" "}
                    {fmtUnit(tour.elevationGain, "hm")}
                  </span>
                  <StatusLabel
                    status={status}
                    reason={reason}
                    className="text-muted-foreground"
                  />
                  {current ? (
                    strip
                  ) : (
                    <ViewTransition
                      name={stripName("tour", tour.slug)}
                      {...MORPH}
                    >
                      {strip}
                    </ViewTransition>
                  )}
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
          </ViewTransition>
        );
      })}
    </ul>
  );
};
