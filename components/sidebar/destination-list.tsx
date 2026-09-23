"use client";

import { Columns3 } from "lucide-react";

import { useT } from "@/components/i18n";
import { SeasonStrip } from "@/components/season-strip";
import { EntityRow } from "@/components/sidebar/entity-row";
import type { RowContext } from "@/components/sidebar/entity-row";
import { KIND_GLYPH } from "@/components/sidebar/kind-tabs";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { ListToolbar } from "@/components/sidebar/list-toolbar";
import { RowList } from "@/components/sidebar/row-list";
import { TagLine } from "@/components/tags";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { COMPARE_MAX } from "@/lib/app-state";
import { fill } from "@/lib/i18n";
import { entityKey } from "@/lib/route-key";
import type { AreaGroup, DestinationRow, TownRow } from "@/lib/rows";
import type { Period } from "@/lib/types";

/** One line of the list: an area, or a town under one of its areas. */
type Entry =
  | { kind: "destination"; row: DestinationRow }
  | { kind: "town"; row: TownRow; under: string };

/**
 * The areas, ranked by what is rideable in the chosen half-month
 * (`buildDestinationRows`, lib/rows.ts), each with the towns one would stay
 * in right under it. An area and its towns answer one question – where to go,
 * and where there to sleep – so they are one list rather than two tabs; a
 * town the listed areas do not hold (none holds it, or the filters dropped
 * its areas) follows in a last group of its own (`nestTowns`). A town that
 * is the base of two areas is listed under both.
 *
 * A row says the name, the country, the count of the half-month, and the
 * strip is the year derived from the roads inside. The switch at the end
 * picks the area for the compare sheet, at most `COMPARE_MAX` of them; the
 * bar above the list is where that sheet opens from, and where the towns'
 * map switch sits.
 */
export const DestinationList = ({
  groups,
  row,
  period,
  empty,
  showRange,
  compare,
  onCompare,
  onOpenCompare,
  mapControl,
}: {
  /** The areas and their towns, as `nestTowns` groups them. */
  groups: readonly AreaGroup[];
  /** What every row does with its entity (`RowContext`). */
  row: RowContext;
  period: Period;
  empty: Omit<React.ComponentProps<typeof ListEmpty>, "title">;
  /** Name the range first once the data holds more than one. */
  showRange: boolean;
  /** The slugs picked for the compare sheet (`AppState.compare`). */
  compare: readonly string[];
  onCompare: (slug: string, on: boolean) => void;
  onOpenCompare: () => void;
  /** The towns' "auf der Karte" switch; the areas are always drawn. */
  mapControl: React.ReactNode;
}) => {
  const { t, fmt } = useT();
  const full = compare.length >= COMPARE_MAX;
  const rest = groups.find((g) => g.area === null)?.towns ?? [];
  const entries: Entry[] = groups.flatMap(({ area, towns }) =>
    area
      ? [
          { kind: "destination" as const, row: area },
          ...towns.map((town) => ({
            kind: "town" as const,
            row: town,
            under: area.destination.slug,
          })),
        ]
      : [],
  );

  const townRow = (
    { town, favorite, range, areas }: TownRow,
    nested: boolean,
  ) => (
    <EntityRow
      entity={{ kind: "town", slug: town.slug }}
      row={row}
      className={nested ? "pl-4" : undefined}
      leading={
        <span className="flex size-3 items-center justify-center" aria-hidden>
          {KIND_GLYPH.town}
        </span>
      }
      name={town.name}
      subtitle={
        <TagLine
          tags={town.tags}
          lead={[
            showRange && range ? t.vocab.range[range].label : null,
            town.country,
            // Under its area the row needs no way up; out of it, it names it.
            nested ? null : areas[0]?.name,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      }
      favorite={favorite}
    />
  );

  const areaRow = ({
    destination,
    text,
    favorite,
    season,
    range,
  }: DestinationRow) => {
    const picked = compare.includes(destination.slug);
    return (
      <EntityRow
        entity={{ kind: "destination", slug: destination.slug }}
        row={row}
        name={destination.name}
        subtitle={[
          showRange && range ? t.vocab.range[range].label : null,
          destination.country,
        ]
          .filter(Boolean)
          .join(" · ")}
        favorite={favorite}
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
              items={entries}
              keyOf={(e) =>
                e.kind === "town"
                  ? `${e.under}/${entityKey("town", e.row.town.slug)}`
                  : entityKey("destination", e.row.destination.slug)
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
                {entries.length > 0 ? t.sidebar.lists.otherTowns : t.kinds.town}
              </h3>
              <RowList items={rest} keyOf={({ town }) => town.slug}>
                {(town) => townRow(town, false)}
              </RowList>
            </>
          )}
        </>
      )}
    </>
  );
};
