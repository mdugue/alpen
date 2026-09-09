"use client";

import { EntityRow } from "@/components/sidebar/entity-row";
import { ListEmpty } from "@/components/sidebar/list-empty";
import type { TownRow } from "@/lib/rows";

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
          subtitle={`${town.country} · ${town.why.split(".")[0]}`}
          favorite={favorite}
          onToggleFavorite={() => onToggleFavorite(town.slug)}
          onSelect={() => onSelect(town.slug)}
        />
      ))}
    </ul>
  );
};
