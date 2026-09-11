"use client";

import { ChevronDown, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NO_SECTIONS, SECTIONS_KEY, useStored } from "@/lib/app-state";

/**
 * The one heading level inside the detail panel: small caps, a hairline, and
 * room above it. Every section folds away, because the panel is a column on a
 * map and a phone sheet shows maybe two of them at a time – whoever is looking
 * for the climate should not have to scroll past two elevation profiles first.
 *
 * The title says what the block is and nothing else; where the source or its
 * caveat has to be named, `info` puts one short sentence behind an icon – a
 * `Popover`, not a `Tooltip`: the detail panel is the one place a phone
 * reaches this app most, and a hover-only disclosure is simply unreachable
 * with a finger. `openOnHover` still opens it on hover with a mouse, exactly
 * like a tooltip would, because Base UI's own hover interaction is
 * `mouseOnly` and stands down once the current open state came from a touch
 * press – so the one trigger serves both without a media query of our own.
 * There is no second kind of disclosure here: the scales dialog is reachable
 * from the sidebar footer, so a header never opens one.
 *
 * Which sections are folded is kept per session and shared by all of them
 * (`SECTIONS_KEY`), so it survives switching to the next pass but not the next
 * visit. Stored are the *closed* ids: a section that did not exist yet opens
 * by itself.
 */
export const Section = ({
  id,
  title,
  info,
  children,
}: {
  /** Stable across entities – that is what makes the fold carry over. */
  id: string;
  title: string;
  info?: string;
  children: React.ReactNode;
}) => {
  const [closed, setClosed] = useStored<string[]>(
    SECTIONS_KEY,
    NO_SECTIONS,
    "session",
  );

  return (
    <Collapsible
      className="mt-6"
      onOpenChange={(open) =>
        setClosed((ids) =>
          open ? ids.filter((x) => x !== id) : [...ids, id].toSorted(),
        )
      }
      open={!closed.includes(id)}
    >
      <h3 className="border-border mb-2.5 flex items-center gap-2 border-b pb-1.5">
        <CollapsibleTrigger
          render={
            <Button
              className="group/section h-auto min-w-0 flex-1 justify-start gap-2 rounded-sm px-0 py-0 hover:bg-transparent"
              variant="ghost"
            />
          }
        >
          <span className="text-muted-foreground text-2xs font-semibold tracking-widest uppercase">
            {title}
          </span>
          <ChevronDown
            className="text-muted-foreground/60 ml-auto transition-transform group-aria-expanded/section:rotate-180"
            data-icon="inline-end"
          />
        </CollapsibleTrigger>
        {info && (
          <Popover>
            <PopoverTrigger
              delay={400}
              openOnHover
              render={
                <Button
                  aria-label={`${title}: Hinweis zur Quelle`}
                  className="text-muted-foreground/70"
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <Info />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 text-xs leading-relaxed"
              side="bottom"
            >
              {info}
            </PopoverContent>
          </Popover>
        )}
      </h3>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
};
