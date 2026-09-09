"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * One collapsible block of the sidebar with a sticky header. Controls that
 * belong to the section (e.g. the map-visibility switch) are rendered next to
 * the trigger, never inside it.
 *
 * The header carries no surface of its own, in neither state, so the panel's
 * frosted backdrop reads through it exactly as it does everywhere else: a tint
 * stacks on `bg-card/80` and turns the header into a white band across an
 * otherwise translucent panel, and the ghost trigger's `aria-expanded:bg-muted`
 * would paint the open section a second one.
 *
 * That is also why the header no longer sticks to the top: a pinned header has
 * rows scrolling underneath and needs a background to stay legible, and a
 * `backdrop-blur` of its own cannot supply one – the panel already filters its
 * backdrop, and Chromium makes that a backdrop root, so a nested filter never
 * sees the rows inside it. Collapsing a section is how a long list is skipped.
 */
export const Section = ({
  open,
  onOpenChange,
  glyph,
  label,
  count,
  total,
  control,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  glyph: React.ReactNode;
  label: string;
  count: number;
  total: number;
  control?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const filtered = count !== total;
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="border-border grid grid-cols-[minmax(0,1fr)_auto] items-center border-b pr-3">
        <h2 className="contents">
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                className="group/section hover:bg-muted/50 h-10 justify-start gap-2 rounded-none px-3 aria-expanded:bg-transparent"
              />
            }
          >
            <span
              className="flex size-4 items-center justify-center"
              aria-hidden
            >
              {glyph}
            </span>
            <span className="text-xs font-semibold tracking-widest uppercase">
              {label}
            </span>
            <span className="text-muted-foreground tabular-nums">
              <span className={cn(filtered && "text-foreground font-semibold")}>
                {count}
              </span>
              {filtered && <span> / {total}</span>}
            </span>
            <ChevronDown
              data-icon="inline-end"
              className="text-muted-foreground ml-auto transition-transform group-aria-expanded/section:rotate-180"
            />
          </CollapsibleTrigger>
        </h2>
        {control}
      </div>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
};

/** Legend glyphs; the same shapes the map uses for the three kinds. */
export const KIND_GLYPH = {
  pass: <span className="border-foreground/70 size-3 rounded-full border-2" />,
  tour: <span className="bg-tour h-1.5 w-4 rounded-full" />,
  town: <span className="bg-town size-2.5 rounded-full" />,
} as const;
