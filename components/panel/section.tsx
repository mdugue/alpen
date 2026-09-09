"use client";

import { ChevronDown, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The one heading level inside the detail panel: small caps, a hairline, and
 * room above it. Every section folds away, because the panel is a column on a
 * map and a phone sheet shows maybe two of them at a time – whoever is looking
 * for the climate should not have to scroll past two elevation profiles first.
 * They start open: the panel's job is to answer without being operated, and a
 * block folded away stays folded while the panel is, so closing the climate
 * once holds for the next pass too.
 *
 * `hint` names the source in passing, `info` hides the caveat that belongs to
 * it behind an icon – a sentence about grid resolution must not take the place
 * a fact could have. `action` is for a control that belongs to the section
 * (the scales dialog); it sits next to the trigger, never inside it.
 */
export const Section = ({
  title,
  hint,
  info,
  action,
  defaultOpen = true,
  children,
}: {
  title: string;
  hint?: string;
  info?: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => (
  <Collapsible defaultOpen={defaultOpen} className="mt-6">
    <h3 className="border-border mb-2.5 flex items-center gap-2 border-b pb-1.5">
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            className="group/section h-auto min-w-0 flex-1 justify-start gap-2 rounded-sm px-0 py-0 hover:bg-transparent"
          />
        }
      >
        <span className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">
          {title}
        </span>
        {hint && (
          <span className="text-muted-foreground min-w-0 truncate text-[11px] font-normal">
            {hint}
          </span>
        )}
        <ChevronDown
          data-icon="inline-end"
          className="text-muted-foreground/60 ml-auto transition-transform group-aria-expanded/section:rotate-180"
        />
      </CollapsibleTrigger>
      {action}
      {info && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Hinweis zur Quelle"
                className="text-muted-foreground/70"
              />
            }
          >
            <Info />
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{info}</TooltipContent>
        </Tooltip>
      )}
    </h3>
    <CollapsibleContent>{children}</CollapsibleContent>
  </Collapsible>
);
