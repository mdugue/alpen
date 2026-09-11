"use client";

import { EntityRow } from "@/components/sidebar/entity-row";
import { ListEmpty } from "@/components/sidebar/list-empty";
import { TagLine } from "@/components/tags";
import type { TownRow } from "@/lib/rows";

/**
 * The subtitle is the town's own labels rather than the first sentence of
 * `why`: what a planner scans a list of bases for is what kind of place it is,
 * and the sentence with the pass names is one click away in the detail panel.
 * Each label carries its icon, which is what the eye picks out of a list of
 * 48 rows before it reads a single word.
 */
export const TownList = ({
  rows,
  currentRow,
  onSelect,
  onToggleFavorite,
}: {
  rows: TownRow[];
  currentRow: string | null;
  onSelect: (slug: string) => void;
  onToggleFavorite: (slug: string) => void;
}) => {
  if (rows.length === 0)
    return <ListEmpty title="Keine Orte für diese Filter" />;
  return (
    <ul>
      {rows.map(({ town, favorite }) => (
        <EntityRow
          key={town.slug}
          rowId={`town:${town.slug}`}
          current={currentRow === `town:${town.slug}`}
          title={town.name}
          subtitle={<TagLine tags={town.tags} lead={town.country} />}
          favorite={favorite}
          onToggleFavorite={() => onToggleFavorite(town.slug)}
          onSelect={() => onSelect(town.slug)}
        />
      ))}
    </ul>
  );
};
