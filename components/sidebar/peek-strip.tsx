"use client";

import { useRef } from "react";

import { SeasonStrip } from "@/components/season-strip";
import { StatusDot } from "@/components/status-badge";
import type { EntityKind, Selection } from "@/lib/app-state";
import type { PassRow, TourRow, TownRow } from "@/lib/rows";
import type { Period } from "@/lib/types";
import { cn, fmt, fmtUnit } from "@/lib/utils";

/**
 * What the phone shows before anything is opened.
 *
 * The peek row used to be a search field on an empty map: the first thing a
 * phone visitor saw was a blank page with a text box, and the only way to
 * learn that the app knows 201 roads was to drag a sheet upwards. A map app
 * whose first screen contains no result is asking to be closed.
 *
 * It is also the mobile half of the list↔map link. A finger has no hover, so
 * the desktop answer (point at a row, the mark lights up) has no mobile
 * translation – but a *card in view* is the same statement as a row under the
 * pointer, and a horizontal strip makes "in view" a thing the thumb controls.
 * Swiping the strip therefore hovers the card that comes to rest, which on the
 * map highlights the mark and, if it is off screen, brings it into view. The
 * strip is the phone's pointer.
 *
 * Only the first few rows are carried: this is a preview of the answer, not
 * the list. The list is one swipe up, and its order is the same one, so
 * nothing has to be learned twice.
 */
const MAX = 12;

interface Props {
  kind: EntityKind;
  passRows: PassRow[];
  tourRows: TourRow[];
  townRows: TownRow[];
  period: Period;
  total: number;
  hovered: Selection | null;
  /** Highlight this card's mark on the map and, if it is off screen, bring it in. */
  onReveal: (sel: Selection | null) => void;
  onSelect: (sel: Selection) => void;
  /** Opens the sheet on the full list; the strip is a preview, not the list. */
  onOpenList: () => void;
}

interface Card {
  slug: string;
  name: string;
  line: string;
  status?: React.ReactNode;
  season?: React.ReactNode;
  leading?: React.ReactNode;
}

export const PeekStrip = (p: Props) => {
  const cards: Card[] =
    p.kind === "pass"
      ? p.passRows.slice(0, MAX).map(({ pass, status, season }) => ({
          line: `${fmtUnit(pass.elevation, "m")} · ${pass.region}`,
          name: pass.name,
          season: <SeasonStrip cells={season} current={p.period} />,
          slug: pass.slug,
          status: <StatusDot status={status} />,
        }))
      : p.kind === "tour"
        ? p.tourRows.slice(0, MAX).map(({ tour, status, season }) => ({
            leading: (
              <span
                className="h-1.5 w-4 shrink-0 rounded-full"
                style={{ background: tour.color }}
              />
            ),
            line: `${fmtUnit(tour.km, "km")} · ${fmtUnit(tour.elevationGain, "hm")}`,
            name: tour.name,
            season: <SeasonStrip cells={season} current={p.period} />,
            slug: tour.slug,
            status: <StatusDot status={status} />,
          }))
        : p.townRows.slice(0, MAX).map(({ town }) => ({
            leading: (
              <span
                className="bg-town size-2.5 shrink-0 rounded-full"
                aria-hidden
              />
            ),
            line: town.country,
            name: town.name,
            slug: town.slug,
          }));

  const strip = useRef<HTMLDivElement>(null);
  /**
   * Which card has come to rest at the left edge – the phone's equivalent of
   * "the row under the pointer". Read off the DOM after the scroll settles
   * rather than tracked per frame: the map answers it with a highlight and,
   * when the mark is off screen, a gentle pan, and doing that sixty times a
   * second during a flick is both wasted and unreadable.
   */
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScroll = () => {
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = strip.current;
      if (!el) return;
      const left = el.scrollLeft + 8;
      const at = [...el.querySelectorAll<HTMLElement>("[data-slug]")].find(
        (c) => c.offsetLeft + c.offsetWidth > left,
      )?.dataset.slug;
      p.onReveal(at ? ({ kind: p.kind, slug: at } as Selection) : null);
    }, 140);
  };

  if (cards.length === 0) return null;

  return (
    <div
      ref={strip}
      onScroll={onScroll}
      // A sideways drag on this strip must not be read as a downward swipe on
      // the sheet it sits in.
      data-base-ui-swipe-ignore
      className="-mx-3 flex snap-x snap-mandatory [scrollbar-width:none] gap-2 overflow-x-auto px-3 pb-1 [&::-webkit-scrollbar]:hidden"
      aria-label="Treffer"
    >
      {cards.map((c) => {
        const sel = { kind: p.kind, slug: c.slug } as Selection;
        const on = p.hovered?.kind === p.kind && p.hovered.slug === c.slug;
        return (
          <button
            key={c.slug}
            data-slug={c.slug}
            type="button"
            onClick={() => p.onSelect(sel)}
            onFocus={() => p.onReveal(sel)}
            className={cn(
              "border-border/70 bg-card/70 flex w-40 shrink-0 snap-start flex-col gap-1 rounded-lg border px-2.5 py-2 text-left",
              on && "border-accent bg-accent/10",
            )}
          >
            <span className="flex items-center gap-1.5">
              {c.leading}
              {c.status}
              <span className="truncate text-xs font-medium">{c.name}</span>
            </span>
            <span className="text-muted-foreground text-2xs truncate">
              {c.line}
            </span>
            {c.season}
          </button>
        );
      })}
      {p.total > cards.length && (
        <button
          type="button"
          onClick={p.onOpenList}
          className="border-border/70 text-muted-foreground text-2xs flex w-28 shrink-0 snap-start items-center justify-center rounded-lg border border-dashed px-2 text-center"
        >
          alle {fmt(p.total)} ansehen
        </button>
      )}
    </div>
  );
};
