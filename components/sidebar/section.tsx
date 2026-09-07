"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * One collapsible block of the sidebar with a sticky header. Controls that
 * belong to the section (e.g. the map-visibility switch) are rendered next to
 * the trigger, never inside it.
 */
export function Section({
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
}) {
  const filtered = count !== total;
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border bg-card pr-3">
        <CollapsibleTrigger
          render={<Button variant="ghost" className="group/section h-10 justify-start gap-2 rounded-none px-3" />}
        >
          <span className="flex size-4 items-center justify-center" aria-hidden>
            {glyph}
          </span>
          <span className="text-xs font-semibold tracking-widest uppercase">{label}</span>
          <span className="tabular-nums text-muted-foreground">
            <span className={cn(filtered && "font-semibold text-foreground")}>{count}</span>
            {filtered && <span> / {total}</span>}
          </span>
          <ChevronDown className="ml-auto text-muted-foreground transition-transform group-aria-expanded/section:rotate-180" />
        </CollapsibleTrigger>
        {control}
      </div>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** Legend glyphs; the same shapes the map uses for the three kinds. */
export const KIND_GLYPH = {
  pass: <span className="size-3 rounded-full border-2 border-card bg-primary shadow-[0_0_0_1px_var(--color-border)]" />,
  tour: <span className="h-1.5 w-4 rounded-full bg-tour" />,
  town: <span className="size-2.5 rotate-45 rounded-[2px] bg-town" />,
} as const;
