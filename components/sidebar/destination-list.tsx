"use client";

import { Columns3 } from "lucide-react";

import { useT } from "@/components/i18n";
import { SeasonStrip } from "@/components/season-strip";
import { EntityRow } from "@/components/sidebar/entity-row";
import { KIND_GLYPH } from "@/components/sidebar/kind-tabs";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { ListToolbar } from "@/components/sidebar/list-toolbar";
import { RowList } from "@/components/sidebar/row-list";
import { TagLine } from "@/components/tags";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { COMPARE_MAX } from "@/lib/app-state";
import type { Selection } from "@/lib/app-state";
import { fill } from "@/lib/i18n";
import { entityKey } from "@/lib/route-key";
import { nestTowns } from "@/lib/rows";
import type { DestinationRow, TownRow } from "@/lib/rows";
import type { Period } from "@/lib/types";
import { useRoving } from "@/lib/use-roving";

/** One line of the list: an area, or a town under the area it lies in. */
type Entry =
  | { kind: "destination"; row: DestinationRow }
  | { kind: "town"; row: TownRow };

/**
 * The list the product goal asks for first: the areas, ranked by what is
 * rideable in the chosen half-month (`buildDestinationRows`, lib/rows.ts),
 * each with the towns one would stay in right under it. An area and its
 * towns answer one question – where to go, and where there to sleep – so they
 * are one list rather than two tabs; a town the listed areas do not hold
 * (none holds it, or the filters dropped its area) follows in a last group
 * of its own (`nestTowns`).
 *
 * A row says the name, the country, the count of the half-month, and the
 * strip is the year derived from the roads inside. The switch at the end
 * picks the area for the compare sheet, at most `COMPARE_MAX` of them; the
 * bar above the list is where that sheet opens from, and where the towns'
 * map switch sits.
 */
export const DestinationList = ({
  rows,
  towns,
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
  mapControl,
}: {
  rows: readonly DestinationRow[];
  /** The towns that pass the filters, each knowing its area (`TownRow.area`). */
  towns: readonly TownRow[];
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
  onSelect: (sel: Selection) => void;
  onToggleFavorite: (sel: Selection) => void;
  /** The towns' "auf der Karte" switch; the areas are always drawn. */
  mapControl: React.ReactNode;
}) => {
  const { t, fmt } = useT();
  const areaList = useRoving<HTMLDivElement>();
  const restList = useRoving<HTMLDivElement>();
  const full = compare.length >= COMPARE_MAX;
  const groups = nestTowns(rows, towns);
  const rest = groups.find((g) => g.area === null)?.towns ?? [];
  const entries: Entry[] = groups.flatMap((g) =>
    g.area
      ? [
          { kind: "destination" as const, row: g.area },
          ...g.towns.map((row) => ({ kind: "town" as const, row })),
        ]
      : [],
  );
  const isHovered = (sel: Selection) =>
    hovered?.kind === sel.kind && hovered.slug === sel.slug;

  const townRow = (row: TownRow, nested: boolean) => {
    const sel: Selection = { kind: "town", slug: row.town.slug };
    const key = entityKey(sel);
    return (
      <EntityRow
        key={key}
        rowId={key}
        className={nested ? "pl-4" : undefined}
        current={currentRow === key}
        hovered={isHovered(sel)}
        onHover={(over) => onHover(over ? sel : null)}
        leading={
          <span className="flex size-3 items-center justify-center" aria-hidden>
            {KIND_GLYPH.town}
          </span>
        }
        name={row.town.name}
        title={row.town.name}
        subtitle={
          <TagLine
            tags={row.town.tags}
            lead={[
              showRange && row.range ? t.vocab.range[row.range].label : null,
              row.town.country,
              // Under its area the row needs no way up; out of it, it names it.
              nested ? null : row.area?.name,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        }
        favorite={row.favorite}
        onToggleFavorite={() => onToggleFavorite(sel)}
        onSelect={() => onSelect(sel)}
      />
    );
  };

  const areaRow = ({
    destination,
    text,
    favorite,
    season,
    range,
  }: DestinationRow) => {
    const sel: Selection = { kind: "destination", slug: destination.slug };
    const key = entityKey(sel);
    const picked = compare.includes(destination.slug);
    return (
      <EntityRow
        key={key}
        rowId={key}
        current={currentRow === key}
        hovered={isHovered(sel)}
        onHover={(over) => onHover(over ? sel : null)}
        name={destination.name}
        title={destination.name}
        subtitle={[
          showRange && range ? t.vocab.range[range].label : null,
          destination.country,
        ]
          .filter(Boolean)
          .join(" · ")}
        favorite={favorite}
        onToggleFavorite={() => onToggleFavorite(sel)}
        onSelect={() => onSelect(sel)}
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
            aria-label={fill(t.sidebar.compare.toggle, {
              name: destination.name,
            })}
          />
        }
      />
    );
  };

  return (
    <>
      <ListToolbar control={mapControl} label={t.sidebar.lists.townsOnMap}>
        <span className="text-muted-foreground text-2xs min-w-0 truncate">
          {compare.length === 0
            ? fill(t.sidebar.compare.pick, { max: fmt(COMPARE_MAX) })
            : fill(t.sidebar.compare.picked, {
                max: fmt(COMPARE_MAX),
                n: fmt(compare.length),
              })}
        </span>
        <Button
          variant="outline"
          size="xs"
          className="shrink-0"
          disabled={compare.length < 2}
          onClick={onOpenCompare}
        >
          <Columns3 data-icon="inline-start" aria-hidden />
          {t.sidebar.compare.open}
        </Button>
      </ListToolbar>
      {groups.length === 0 ? (
        <ListEmpty title={t.sidebar.empty.noDestinations} {...empty} />
      ) : (
        <>
          {entries.length > 0 && (
            <RowList
              ref={areaList}
              items={entries}
              keyOf={(e) =>
                entityKey(
                  e.kind,
                  e.kind === "town" ? e.row.town.slug : e.row.destination.slug,
                )
              }
            >
              {(e) =>
                e.kind === "town" ? townRow(e.row, true) : areaRow(e.row)
              }
            </RowList>
          )}
          {rest.length > 0 && (
            <>
              <h3 className="text-muted-foreground text-2xs border-border border-b px-3 pt-3 pb-1 font-semibold tracking-wide uppercase">
                {t.sidebar.lists.otherTowns}
              </h3>
              <RowList
                ref={restList}
                items={rest}
                keyOf={(row) => row.town.slug}
              >
                {(row) => townRow(row, false)}
              </RowList>
            </>
          )}
        </>
      )}
    </>
  );
};
