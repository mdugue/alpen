"use client";

import { Columns3 } from "lucide-react";

import { SeasonStrip } from "@/components/season-strip";
import { EntityRow } from "@/components/sidebar/entity-row";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { RowList } from "@/components/sidebar/row-list";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { COMPARE_MAX } from "@/lib/app-state";
import type { Selection } from "@/lib/app-state";
import { RANGE } from "@/lib/regions";
import { entityKey } from "@/lib/route-key";
import type { DestinationRow } from "@/lib/rows";
import type { Period } from "@/lib/types";
import { useRoving } from "@/lib/use-roving";
import { fmt } from "@/lib/utils";

/**
 * The list the product goal asks for first: the areas, ranked by what is
 * rideable in the chosen half-month (`buildDestinationRows`, lib/rows.ts).
 * A row says the name, the country, the count of the half-month and the
 * bases one would sleep in; the strip is the year derived from the roads
 * inside. The switch at the end picks the area for the compare sheet, at
 * most `COMPARE_MAX` of them – the same control the tour rows carry, doing a
 * different job here, which its label says. The bar above the list is where
 * that sheet opens from, in the place the other lists keep their map switch.
 */
export const DestinationList = ({
  rows,
  currentRow,
  hovered,
  onHover,
  period,
  empty,
  showRange,
  compare,
  onCompare,
  onOpenCompare,
  onSelect,
  onToggleFavorite,
}: {
  rows: readonly DestinationRow[];
  currentRow: string | null;
  hovered: Selection | null;
  onHover: (sel: Selection | null) => void;
  period: Period;
  empty: Omit<React.ComponentProps<typeof ListEmpty>, "title">;
  /** Name the range first once the data holds more than one. */
  showRange: boolean;
  /** The slugs picked for the compare sheet (`AppState.compare`). */
  compare: readonly string[];
  onCompare: (slug: string, on: boolean) => void;
  onOpenCompare: () => void;
  onSelect: (slug: string) => void;
  onToggleFavorite: (slug: string) => void;
}) => {
  const rovingList = useRoving<HTMLDivElement>();
  const hoveredSlug = hovered?.kind === "destination" ? hovered.slug : null;
  const full = compare.length >= COMPARE_MAX;
  return (
    <>
      <div className="text-muted-foreground text-2xs flex h-9 items-center justify-between gap-2 px-3">
        <span className="truncate">
          {compare.length === 0
            ? `Bis zu ${COMPARE_MAX} Reiseziele zum Vergleich wählen`
            : `${fmt(compare.length)} von ${COMPARE_MAX} zum Vergleich`}
        </span>
        <Button
          variant="outline"
          size="xs"
          disabled={compare.length < 2}
          onClick={onOpenCompare}
        >
          <Columns3 data-icon="inline-start" aria-hidden />
          Vergleichen
        </Button>
      </div>
      {rows.length === 0 ? (
        <ListEmpty title="Keine Reiseziele gefunden" {...empty} />
      ) : (
        <RowList
          ref={rovingList}
          items={rows}
          keyOf={({ destination }) => destination.slug}
        >
          {({ destination, text, favorite, season, baseTowns, range }) => {
            const picked = compare.includes(destination.slug);
            return (
              <EntityRow
                key={destination.slug}
                rowId={entityKey("destination", destination.slug)}
                current={
                  currentRow === entityKey("destination", destination.slug)
                }
                hovered={hoveredSlug === destination.slug}
                onHover={(over) =>
                  onHover(
                    over
                      ? { kind: "destination", slug: destination.slug }
                      : null,
                  )
                }
                name={destination.name}
                title={destination.name}
                subtitle={[
                  showRange && range ? RANGE[range].label : null,
                  destination.country,
                  baseTowns.map((t) => t.name).join(", ") || null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                favorite={favorite}
                onToggleFavorite={() => onToggleFavorite(destination.slug)}
                onSelect={() => onSelect(destination.slug)}
                aside={
                  <>
                    <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                      {text}
                    </span>
                    <SeasonStrip cells={season} current={period} />
                  </>
                }
                trailing={
                  <Switch
                    size="sm"
                    checked={picked}
                    disabled={!picked && full}
                    onCheckedChange={(on) => onCompare(destination.slug, on)}
                    aria-label={`${destination.name} vergleichen`}
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
