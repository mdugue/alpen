"use client";

import { RotateCcw, SearchX } from "lucide-react";

import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { Filters } from "@/lib/app-state";
import { appliedFilters, bestRelief } from "@/lib/filter-summary";
import { fill } from "@/lib/i18n/fill";

/**
 * The one empty state, with the way out inside it.
 *
 * There used to be three of these on screen at once, word for word identical,
 * and not one of them offered anything to press: the search field's clear
 * button was in the header and the reset lived at the bottom of a filter panel
 * that has to be *opened* to be read. A dead end with no door is the worst
 * thing a live-filtering list can do, and this list filters live on every
 * keystroke.
 *
 * The relief line is the same arithmetic the filter panel already runs
 * (`bestRelief`, lib/filter-summary.ts), which was the best idea in the panel
 * and was only ever visible inside it. Here it is a button: the sentence names
 * the one filter that would bring the most back, and pressing it lifts exactly
 * that one.
 */
export const ListEmpty = ({
  title,
  filters,
  setFilters,
  onReset,
  countWith,
}: {
  title: string;
  filters: Filters;
  setFilters: (update: (f: Filters) => Filters) => void;
  onReset: () => void;
  /** How many roads a filter patch would leave; see `facetCount` in `lib/rows.ts`. */
  countWith?: (patch: Partial<Filters>) => number;
}) => {
  const { t, fmt } = useT();
  const applied = appliedFilters(filters, t);
  const hasQuery = filters.query.trim().length > 0;
  const relief = countWith ? bestRelief(filters, countWith, t) : undefined;
  const reliefLabel = relief?.chip.label ?? "";

  return (
    <Empty className="gap-2 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>
          {hasQuery
            ? fill(
                applied.length > 0
                  ? t.sidebar.empty.queryMatchesNothingFiltered
                  : t.sidebar.empty.queryMatchesNothing,
                { query: filters.query.trim() },
              )
            : t.sidebar.empty.filtersMatchNothing}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center gap-2">
        {hasQuery && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFilters((f) => ({ ...f, query: "" }))}
          >
            {t.sidebar.clearSearch}
          </Button>
        )}
        {relief && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFilters(relief.chip.clear)}
          >
            {fill(t.sidebar.empty.without, {
              label: reliefLabel,
              n: fmt(relief.n),
            })}
          </Button>
        )}
        {applied.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onReset}>
            <RotateCcw data-icon="inline-start" />
            {t.sidebar.empty.resetAll}
          </Button>
        )}
      </EmptyContent>
    </Empty>
  );
};
