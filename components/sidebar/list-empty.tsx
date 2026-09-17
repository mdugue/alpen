"use client";

import { RotateCcw, SearchX } from "lucide-react";

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
import { appliedFilters } from "@/lib/filter-summary";
import { fmt } from "@/lib/utils";

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
 * The relief line is the same arithmetic the filter panel already runs ("ohne
 * „ab 2.500 m" wären es 188"), which was the best idea in the panel and was
 * only ever visible inside it. Here it is a button: the sentence names the one
 * filter that would bring the most back, and pressing it lifts exactly that
 * one.
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
  const applied = appliedFilters(filters);
  const hasQuery = filters.query.trim().length > 0;
  // Which single applied filter, lifted on its own, brings the most back.
  const relief = countWith
    ? applied
        .map((chip) => ({ chip, n: countWith(chip.clear(filters)) }))
        .filter((r) => r.n > 0)
        .toSorted((a, b) => b.n - a.n)[0]
    : undefined;

  return (
    <Empty className="gap-2 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>
          {hasQuery
            ? `„${filters.query.trim()}" passt zu keinem Eintrag${applied.length ? " – zusammen mit den gesetzten Filtern" : ""}.`
            : "Die gesetzten Filter passen zu keinem Eintrag."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center gap-2">
        {hasQuery && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFilters((f) => ({ ...f, query: "" }))}
          >
            Suche leeren
          </Button>
        )}
        {relief && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFilters(relief.chip.clear)}
          >
            Ohne „{relief.chip.label}“: {fmt(relief.n)}
          </Button>
        )}
        {applied.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onReset}>
            <RotateCcw data-icon="inline-start" />
            Alle Filter zurücksetzen
          </Button>
        )}
      </EmptyContent>
    </Empty>
  );
};
