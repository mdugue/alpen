"use client";

import { Check, ChevronLeft, Share, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { cn, ICON_TOGGLE, OVERLAY_CONTROL, TOUCH_ICON } from "@/lib/utils";

/**
 * The panel's own controls, lying on the hero rather than in a bar above it –
 * which is what lets the photo start at the panel's top edge. The row is
 * transparent there and lets the pointer through, and each control carries its
 * own translucent surface (`OVERLAY_CONTROL`) so it reads on a photograph.
 *
 * Past the head it becomes an ordinary header instead: the row takes the
 * surface, the controls give theirs up, and the name appears – because the
 * title is written on the photo and has scrolled away with it. That is also
 * the honest reason for the change of tone: what is under the controls a
 * moment later is body text, and a scrim that works on a photograph does not.
 */
export const PanelBar = ({
  name,
  solid,
  scrolled,
  backToList,
  favorite,
  shared,
  onBack,
  onShare,
  onToggleFavorite,
}: {
  name: string;
  /** Past the head: the row carries the surface, not the controls. */
  solid: boolean;
  /** Past the head, so the name is no longer anywhere else on screen. */
  scrolled: boolean;
  /** A list drawer underneath: leaving means going back to it, not closing. */
  backToList: boolean;
  favorite: boolean;
  /** The link has just been handed over; the share icon says so for a moment. */
  shared: boolean;
  onBack: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
}) => (
  <div
    className={cn(
      "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-1.5 p-2.5 transition-colors duration-200",
      solid &&
        "border-border/60 bg-card/90 supports-not-[backdrop-filter:blur(0)]:bg-card border-b backdrop-blur-md",
    )}
  >
    {backToList && (
      <Button
        size="sm"
        variant="ghost"
        onClick={onBack}
        aria-label="Zurück zur Liste"
        className={cn(
          "pointer-events-auto shrink-0 gap-1 px-2",
          !solid && OVERLAY_CONTROL,
        )}
      >
        <ChevronLeft />
        Liste
      </Button>
    )}
    {/* The name, once the head it was written on has scrolled away. */}
    <p
      className={cn(
        "min-w-0 flex-1 truncate text-sm font-semibold transition-opacity duration-200",
        scrolled ? "opacity-100" : "opacity-0",
      )}
      aria-hidden
    >
      {name}
    </p>
    <Button
      size="icon"
      variant="ghost"
      onClick={onShare}
      aria-label={shared ? "Link kopiert" : `${name} teilen`}
      className={cn(
        "pointer-events-auto",
        !solid && OVERLAY_CONTROL,
        TOUCH_ICON,
      )}
    >
      {shared ? <Check className="text-status-open" /> : <Share />}
    </Button>
    <Toggle
      pressed={favorite}
      onPressedChange={onToggleFavorite}
      aria-label={favorite ? `${name} nicht mehr merken` : `${name} merken`}
      className={cn(
        "pointer-events-auto",
        ICON_TOGGLE,
        !solid && OVERLAY_CONTROL,
        TOUCH_ICON,
      )}
    >
      <Star className={cn(favorite && "fill-accent text-accent")} />
    </Toggle>
    {!backToList && (
      <Button
        size="icon"
        variant="ghost"
        onClick={onBack}
        aria-label="Details schließen"
        className={cn(
          "pointer-events-auto",
          !solid && OVERLAY_CONTROL,
          TOUCH_ICON,
        )}
      >
        <X />
      </Button>
    )}
  </div>
);
