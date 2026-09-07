"use client";

import { Search, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PERIODS, periodLabel } from "@/lib/status";
import type { EntityKind, Filters } from "@/lib/app-state";

interface Props {
  filters: Filters;
  onFilters: (f: (prev: Filters) => Filters) => void;
  showTowns: boolean;
  onShowTowns: (v: boolean) => void;
  allToursVisible: boolean;
  onAllTours: (on: boolean) => void;
  rowCount: number;
  passCount: number;
  favoriteCount: number;
  onOpenScales: () => void;
}

export function Toolbar({
  filters,
  onFilters,
  showTowns,
  onShowTowns,
  allToursVisible,
  onAllTours,
  onOpenScales,
}: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
      <NativeSelect
        value={filters.period}
        onChange={(e) => set("period", Number(e.target.value))}
        aria-label="Zeitraum"
        className="border-accent font-semibold"
      >
        {PERIODS.map((p) => (
          <option key={p} value={p}>
            {periodLabel(p)}
          </option>
        ))}
      </NativeSelect>

      <ToggleGroup
        type="multiple"
        value={filters.kinds}
        onValueChange={(v) => v.length && set("kinds", v as EntityKind[])}
        aria-label="Typen"
      >
        <ToggleGroupItem value="pass">Pässe</ToggleGroupItem>
        <ToggleGroupItem value="tour">Touren</ToggleGroupItem>
        <ToggleGroupItem value="town">Orte</ToggleGroupItem>
      </ToggleGroup>

      <NativeSelect
        value={filters.status}
        onChange={(e) => set("status", e.target.value as Filters["status"])}
        aria-label="Befahrbarkeit"
      >
        <option value="all">Status: alle</option>
        <option value="open">nur meist offen</option>
        <option value="openRisky">offen oder wetterabhängig</option>
      </NativeSelect>

      <NativeSelect
        value={filters.minFame}
        onChange={(e) => set("minFame", Number(e.target.value))}
        aria-label="Bekanntheit"
      >
        <option value={1}>Bekanntheit: alle</option>
        <option value={3}>ab 3</option>
        <option value={4}>nur Klassiker</option>
      </NativeSelect>

      <label className="flex items-center gap-2 text-[13px] whitespace-nowrap text-muted-foreground">
        ab {filters.minElevation} m
        <Slider
          value={[filters.minElevation]}
          min={0}
          max={2800}
          step={100}
          onValueChange={([v]) => set("minElevation", v ?? 0)}
          className="w-28"
          aria-label="Mindesthöhe"
        />
      </label>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
          placeholder="Suchen …"
          className="w-40 pl-7"
          aria-label="Suchen"
        />
      </div>

      <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <input type="checkbox" checked={showTowns} onChange={(e) => onShowTowns(e.target.checked)} />
        Orte auf Karte
      </label>
      <Button size="xs" variant="outline" onClick={() => onAllTours(!allToursVisible)}>
        Touren {allToursVisible ? "ausblenden" : "einblenden"}
      </Button>

      <Button size="xs" variant="ghost" className="ml-auto" onClick={onOpenScales}>
        <HelpCircle /> Skalen &amp; Quellen
      </Button>
    </div>
  );
}
