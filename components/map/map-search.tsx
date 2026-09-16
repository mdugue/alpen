"use client";

import { Search } from "lucide-react";

import { KIND_LABEL } from "@/components/sidebar/kind-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EntityKind } from "@/lib/app-state";
import { ALL_KINDS } from "@/lib/app-state";
import { cn, fmt, MAP_CLUSTER, TOUCH_CONTROL } from "@/lib/utils";

/**
 * The phone's way into the list: a control that floats **on the map**, not
 * inside a drawer.
 *
 * The list used to live in a drawer that was always on screen, resting on a
 * peek row that carried this button. That is an odd shape for a trigger: the
 * thing you press to open the list is a piece of the list, permanently parked
 * at the bottom of the map, with a swipe handle above it that does nothing
 * useful and a drawer edge that says "there is something here" before anything
 * has been asked for. On a phone the map *is* the page (the same rule the
 * desktop layout follows), so nothing should cover it until a visitor asks for
 * something.
 *
 * It sits on the same panel surface as the period scrubber and the map tools
 * (`MAP_CLUSTER`), so everything floating over the map reads as one material.
 * The counts beside it are the only thing on the first screen that says what
 * the app holds, and they move with the filters – so the button is both the
 * way in and the answer to "is there anything in here".
 */
export const MapSearch = ({
  counts,
  query,
  filters,
  onOpen,
}: {
  counts: Record<EntityKind, number>;
  /** The current search text, shown in place of the word when there is one. */
  query: string;
  /** How many filters are set; the badge, so the map says it too. */
  filters: number;
  onOpen: () => void;
}) => (
  <div
    className={cn(
      "flex min-w-0 items-center gap-2",
      MAP_CLUSTER,
      "max-w-[calc(100vw-1.5rem)]",
    )}
  >
    <Button
      variant="secondary"
      onClick={onOpen}
      className={cn("shrink-0", TOUCH_CONTROL)}
    >
      <Search data-icon="inline-start" />
      {query ? `„${query}“` : "Suche"}
    </Button>
    <p className="text-muted-foreground text-2xs min-w-0 flex-1 truncate">
      {ALL_KINDS.map((kind) => `${fmt(counts[kind])} ${KIND_LABEL[kind]}`).join(
        " · ",
      )}
    </p>
    {filters > 0 && (
      <Badge variant="secondary" className="shrink-0">
        {filters} Filter
      </Badge>
    )}
  </div>
);
