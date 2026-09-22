"use client";

import { Button } from "@/components/ui/button";
import type { EntityKind } from "@/lib/app-state";
import { ALL_KINDS, KIND_LABEL } from "@/lib/app-state";
import { cn, fmt, TOUCH_CONTROL } from "@/lib/utils";

/** Legend glyphs; the same shapes the map uses for the three kinds. */
export const KIND_GLYPH: Record<EntityKind, React.ReactNode> = {
  pass: <span className="border-foreground/70 size-3 rounded-full border-2" />,
  tour: <span className="bg-tour h-1.5 w-4 rounded-full" />,
  town: <span className="bg-town size-2.5 rounded-full" />,
};

/**
 * Which of the three lists is on screen.
 *
 * They used to be three collapsible blocks stacked inside one scroll
 * container, which made the sidebar a single **12 841 px** column against a
 * 730 px viewport: the tours sat below all 201 roads and the towns below
 * those, so the second and third kind were seventeen screens of scrolling
 * away or, failing that, a fold of the first one away. Three lists that are
 * never read together are not one document.
 *
 * A tab row fixes more than the distance. The section headers deliberately
 * did not stick, because a pinned header over scrolling rows needs an opaque
 * background and a nested `backdrop-blur` cannot supply one inside a panel
 * that already filters its backdrop; in the header row there is nothing
 * scrolling underneath, so the counts can simply stay on screen. And each
 * kind's map-visibility switch now sits next to its own tab rather than
 * inside a header that may be scrolled out of sight.
 *
 * The count is on the tab because it is the answer to the filter: a planner
 * who narrows to "ab 2.500 m" wants to see the tours collapse from 9 to 2
 * without going to look.
 */
export const KindTabs = ({
  active,
  onChange,
  counts,
  totals,
}: {
  active: EntityKind;
  onChange: (kind: EntityKind) => void;
  counts: Record<EntityKind, number>;
  totals: Record<EntityKind, number>;
}) => (
  <div
    role="tablist"
    aria-label="Was die Liste zeigt"
    className="bg-muted/60 flex min-w-0 gap-0.5 rounded-lg p-0.5"
  >
    {ALL_KINDS.map((kind) => {
      const on = kind === active;
      const filtered = counts[kind] !== totals[kind];
      return (
        <Button
          key={kind}
          role="tab"
          aria-selected={on}
          variant="ghost"
          size="sm"
          onClick={() => onChange(kind)}
          className={cn(
            "min-w-0 flex-1 gap-1.5 rounded-md px-1.5 font-normal",
            on
              ? "bg-card text-foreground hover:bg-card shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            TOUCH_CONTROL,
          )}
        >
          <span
            className="flex size-3 shrink-0 items-center justify-center"
            aria-hidden
          >
            {KIND_GLYPH[kind]}
          </span>
          <span className="truncate text-xs">{KIND_LABEL[kind]}</span>
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              filtered
                ? "text-foreground font-semibold"
                : "text-muted-foreground",
            )}
          >
            {fmt(counts[kind])}
          </span>
        </Button>
      );
    })}
  </div>
);
