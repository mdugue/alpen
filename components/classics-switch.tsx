"use client";

import { useT } from "@/components/i18n";
import { FilterChip } from "@/components/sidebar/filter-chip";
import { CLASSIC_FAME, RATING_MIN } from "@/lib/app-state";
import { fill } from "@/lib/i18n/fill";
import { cn, MAP_CLUSTER } from "@/lib/utils";

/**
 * The one filter that stands on the map: the classics, or every road.
 *
 * The app opens on the classics (`CLASSIC_FAME`), so the chip that lifts it
 * has to be in sight at every width – on a phone the filter panel is a drawer
 * away, and a default nobody can see is a default nobody changes. It is the
 * fame floor of the filter panel, not a second state: two chips over the same
 * `minFame`, each carrying the count it would leave like every chip
 * (`facetCount`), and a floor the panel set elsewhere (3, 5) presses neither.
 * What the floor leaves out stays on the map as a grey shadow.
 */
export const ClassicsSwitch = ({
  minFame,
  countWith,
  searching,
  onChange,
}: {
  minFame: number;
  /** How many roads the floor would leave (`facetCount`). */
  countWith: (minFame: number) => number;
  /** A search looks past the floor (`fameFloor`); the chips say so. */
  searching: boolean;
  onChange: (minFame: number) => void;
}) => {
  const { t } = useT();
  const hint = searching
    ? t.map.classicsSearching
    : fill(t.map.classicsHint, { n: CLASSIC_FAME });
  return (
    <div
      role="group"
      aria-label={t.map.classicsGroup}
      className={cn(
        "flex gap-1 p-1 transition-opacity",
        MAP_CLUSTER,
        searching && "opacity-70",
      )}
    >
      <FilterChip
        pressed={minFame === CLASSIC_FAME}
        onPressedChange={(on) => onChange(on ? CLASSIC_FAME : RATING_MIN)}
        count={countWith(CLASSIC_FAME)}
        label={t.map.classics}
        hint={hint}
      >
        {t.map.classics}
      </FilterChip>
      <FilterChip
        pressed={minFame === RATING_MIN}
        onPressedChange={(on) => onChange(on ? RATING_MIN : CLASSIC_FAME)}
        count={countWith(RATING_MIN)}
        label={t.map.allRoads}
        hint={hint}
      >
        {t.map.allRoads}
      </FilterChip>
    </div>
  );
};
