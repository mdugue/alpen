"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Rating } from "@/components/rating";
import { StatusDot } from "@/components/status-badge";
import { periodLabel, passStatus, tourStatus, STATUS_LABEL } from "@/lib/status";
import { cn, fmt } from "@/lib/utils";
import type { EntityKind, Filters, Selection } from "@/lib/app-state";
import { statusMatches } from "@/lib/app-state";
import type { Pass, Period, Status, Tour, Town } from "@/lib/types";

export interface Row {
  kind: EntityKind;
  slug: string;
  name: string;
  subtitle: string;
  favorite: boolean;
  sortOrder: number;
  metric: number;
  metricLabel: string;
  status: Status | null;
  statusRank: number;
  beauty: number;
  fame: number;
  difficulty: number;
  traffic: number;
  color?: string;
  onMap?: boolean;
}

type SortKey = "favorite" | "kind" | "name" | "metric" | "statusRank" | "beauty" | "fame" | "difficulty" | "traffic";

const KIND_LABEL: Record<EntityKind, string> = { pass: "Pass", tour: "Tour", town: "Ort" };
const KIND_CLASS: Record<EntityKind, string> = {
  pass: "bg-primary text-primary-foreground",
  tour: "bg-tour text-white",
  town: "bg-town text-white",
};

export function buildRows(
  passes: Pass[],
  tours: Tour[],
  towns: Town[],
  filters: Filters,
  isFavorite: (k: EntityKind, s: string) => boolean,
  visibleTours: string[],
): Row[] {
  const q = filters.query.trim().toLowerCase();
  const matchesQuery = (...parts: string[]) => !q || parts.join(" ").toLowerCase().includes(q);
  const rows: Row[] = [];

  if (filters.kinds.includes("pass")) {
    for (const p of passes) {
      const status = passStatus(p, filters.period);
      if (p.elevation < filters.minElevation || p.fame < filters.minFame) continue;
      if (filters.favoritesOnly && !isFavorite("pass", p.slug)) continue;
      if (!matchesQuery(p.name, p.region, p.country)) continue;
      if (!statusMatches(status, filters.status)) continue;
      rows.push({
        kind: "pass",
        slug: p.slug,
        name: p.name,
        subtitle: `${p.region} · ${p.country}`,
        favorite: isFavorite("pass", p.slug),
        sortOrder: 1,
        metric: p.elevation,
        metricLabel: `${fmt(p.elevation)} m`,
        status,
        statusRank: { open: 0, risky: 1, closed: 2 }[status],
        beauty: p.beauty,
        fame: p.fame,
        difficulty: p.difficulty,
        traffic: p.traffic,
      });
    }
  }

  if (filters.kinds.includes("tour")) {
    for (const t of tours) {
      const status = tourStatus(t, passes, filters.period);
      if (filters.favoritesOnly && !isFavorite("tour", t.slug)) continue;
      if (!matchesQuery(t.name, t.description)) continue;
      if (!statusMatches(status, filters.status)) continue;
      rows.push({
        kind: "tour",
        slug: t.slug,
        name: t.name,
        subtitle: `${t.passes.length} Pässe · ${t.season.split(";")[0]}`,
        favorite: isFavorite("tour", t.slug),
        sortOrder: 2,
        metric: t.elevationGain,
        metricLabel: `${t.km} km · ${fmt(t.elevationGain)} hm`,
        status,
        statusRank: { open: 0, risky: 1, closed: 2 }[status],
        beauty: 0,
        fame: 0,
        difficulty: 0,
        traffic: 0,
        color: t.color,
        onMap: visibleTours.includes(t.slug),
      });
    }
  }

  if (filters.kinds.includes("town")) {
    for (const t of towns) {
      if (filters.favoritesOnly && !isFavorite("town", t.slug)) continue;
      if (!matchesQuery(t.name, t.why)) continue;
      // Altitude and status filters only apply to passes; towns drop out then.
      if (filters.minElevation > 0 || filters.minFame > 1 || filters.status !== "all") continue;
      rows.push({
        kind: "town",
        slug: t.slug,
        name: t.name,
        subtitle: `${t.country} · ${t.why.split(".")[0]}`,
        favorite: isFavorite("town", t.slug),
        sortOrder: 3,
        metric: 0,
        metricLabel: "",
        status: null,
        statusRank: -1,
        beauty: 0,
        fame: 0,
        difficulty: 0,
        traffic: 0,
      });
    }
  }
  return rows;
}

export function EntityTable({
  rows,
  period,
  selection,
  onSelect,
  onToggleFavorite,
  onToggleTour,
}: {
  rows: Row[];
  period: Period;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
  onToggleFavorite: (k: EntityKind, s: string) => void;
  onToggleTour: (slug: string, on: boolean) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "metric", asc: false });

  const sorted = useMemo(() => {
    const dir = sort.asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      const cmp =
        typeof x === "string" && typeof y === "string"
          ? x.localeCompare(y, "de") * dir
          : (Number(x) - Number(y)) * dir;
      return cmp || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de");
    });
  }, [rows, sort]);

  const header = (key: SortKey, label: string, className?: string, title?: string) => (
    <th
      className={cn(
        "sticky top-0 z-10 cursor-pointer border-b-2 border-border bg-card px-2 py-2 text-left text-[11px] font-semibold tracking-widest text-muted-foreground uppercase select-none",
        sort.key === key && "text-foreground",
        className,
      )}
      title={title}
      onClick={() =>
        setSort((s) =>
          s.key === key
            ? { key, asc: !s.asc }
            : { key, asc: !["metric", "beauty", "fame", "difficulty", "favorite"].includes(key) },
        )
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sort.key === key &&
          (sort.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </span>
    </th>
  );

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          {header("favorite", "★", "w-8")}
          {header("kind", "Typ", "w-16")}
          {header("name", "Name")}
          {header("metric", "Höhe / Länge", "text-right")}
          {header("statusRank", `Status ${periodLabel(period)}`)}
          {header("beauty", "Schön.", "w-14", "Schönheit")}
          {header("fame", "Bek.", "w-14", "Bekanntheit")}
          {header("difficulty", "Schw.", "w-14", "Schwierigkeit")}
          {header("traffic", "Verk.", "w-14", "Verkehr")}
          <th className="sticky top-0 z-10 border-b-2 border-border bg-card px-2 py-2 text-left text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            Karte
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const active = selection?.kind === r.kind && selection.slug === r.slug;
          return (
            <tr
              key={`${r.kind}:${r.slug}`}
              tabIndex={0}
              onClick={() => onSelect({ kind: r.kind, slug: r.slug })}
              onKeyDown={(e) => e.key === "Enter" && onSelect({ kind: r.kind, slug: r.slug })}
              className={cn(
                "cursor-pointer border-b border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                active && "bg-accent/15",
              )}
            >
              <td className="px-2 py-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(r.kind, r.slug);
                  }}
                  aria-label={r.favorite ? "Merkung entfernen" : "Merken"}
                >
                  <Star
                    className={cn("size-4", r.favorite ? "fill-accent text-accent" : "text-border")}
                  />
                </button>
              </td>
              <td className="px-2 py-1.5">
                <Badge className={cn("rounded px-1.5 py-0 text-[10px] tracking-wide uppercase", KIND_CLASS[r.kind])}>
                  {KIND_LABEL[r.kind]}
                </Badge>
              </td>
              <td className="px-2 py-1.5">
                <span className="flex items-center gap-1.5 font-medium">
                  {r.color && <span className="h-1 w-3 rounded" style={{ background: r.color }} />}
                  {r.name}
                </span>
                <span className="text-xs text-muted-foreground">{r.subtitle}</span>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{r.metricLabel}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                {r.status ? (
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot status={r.status} />
                    {STATUS_LABEL[r.status]}
                  </span>
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
              </td>
              <td className="px-2 py-1.5">{r.kind === "pass" && <Rating value={r.beauty} />}</td>
              <td className="px-2 py-1.5">{r.kind === "pass" && <Rating value={r.fame} />}</td>
              <td className="px-2 py-1.5">{r.kind === "pass" && <Rating value={r.difficulty} />}</td>
              <td className="px-2 py-1.5">{r.kind === "pass" && <Rating value={r.traffic} muted />}</td>
              <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                {r.kind === "tour" && (
                  <Checkbox
                    checked={r.onMap}
                    onCheckedChange={(v) => onToggleTour(r.slug, Boolean(v))}
                    aria-label="Tour auf der Karte zeigen"
                  />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
