"use client";

import { X } from "lucide-react";

import { SeasonStrip } from "@/components/season-strip";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DestinationRow } from "@/lib/rows";
import { cellAt } from "@/lib/status";
import type { Period } from "@/lib/types";
import { fmt } from "@/lib/utils";

/**
 * The holiday decision screen: up to three areas side by side, each with
 * its verdict for the chosen half-month, its derived year, what it holds and
 * where one would stay. Nothing here is computed – every column is a row of
 * the destination list, read again – so the sheet and the list can never
 * disagree about the same area.
 *
 * A dialog rather than a third panel: it is opened for one decision and
 * closed again, and on a phone a three-column table is the one thing the
 * drawer cannot hold.
 */
export const CompareSheet = ({
  open,
  onOpenChange,
  rows,
  period,
  onRemove,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The compared areas, in the order they were picked. */
  rows: readonly DestinationRow[];
  period: Period;
  onRemove: (slug: string) => void;
  onSelect: (slug: string) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Reiseziele im Vergleich</DialogTitle>
        <DialogDescription>
          Alles hier ist aus den Straßen der Gebiete abgeleitet – die Zahl gut
          befahrbarer Straßen im gewählten Halbmonat, der Jahresverlauf und die
          Orte als Standort.
        </DialogDescription>
      </DialogHeader>
      <div className="overflow-y-auto pr-1">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Kein Reiseziel gewählt – in der Liste bis zu drei zum Vergleich
            einschalten.
          </p>
        ) : (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`,
            }}
          >
            {rows.map((row) => {
              const { destination: d, verdict } = row;
              return (
                <section
                  key={d.slug}
                  className="border-border/70 flex min-w-0 flex-col gap-2 rounded-lg border p-3 text-xs"
                  aria-label={d.name}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto px-0 py-0 text-sm font-semibold"
                        onClick={() => onSelect(d.slug)}
                      >
                        <span className="truncate">{d.name}</span>
                      </Button>
                      <p className="text-muted-foreground text-2xs">
                        {d.country}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`${d.name} aus dem Vergleich nehmen`}
                      onClick={() => onRemove(d.slug)}
                    >
                      <X />
                    </Button>
                  </div>
                  <StatusBadge
                    cell={cellAt(verdict.year, period)}
                    period={period}
                  />
                  <p className="text-muted-foreground">{row.text}</p>
                  <SeasonStrip
                    cells={row.season}
                    current={period}
                    size="panel"
                  />
                  <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 tabular-nums">
                    <dt>Straßen</dt>
                    <dd className="text-foreground">
                      {fmt(row.members.passes.length)}
                    </dd>
                    <dt>Runden</dt>
                    <dd className="text-foreground">
                      {fmt(row.members.tours.length)}
                    </dd>
                    <dt>Orte</dt>
                    <dd className="text-foreground">
                      {fmt(row.members.towns.length)}
                    </dd>
                  </dl>
                  {row.baseTowns.length > 0 && (
                    <p>
                      <span className="text-muted-foreground">Standort: </span>
                      {row.baseTowns.map((t) => t.name).join(", ")}
                    </p>
                  )}
                  <p className="leading-relaxed">{d.character}</p>
                  <p className="text-muted-foreground leading-relaxed">
                    {d.multiDay}
                  </p>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </DialogContent>
  </Dialog>
);
