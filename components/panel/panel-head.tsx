"use client";

import { PhotoCarousel } from "@/components/panel/photo-carousel";
import type { Photo } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The panel's head. Two shapes, one element: the kicker and the name lie on
 * the hero photo where there is one, and stand in the panel's own colours
 * where there is not – but they are the *same* nodes either way, only
 * differently placed. Rendering them in two branches would take the heading
 * out of the document the moment the last slide failed to load.
 */
export const PanelHead = ({
  hero,
  kicker,
  name,
  loading,
  photos,
  onBroken,
}: {
  /** The panel opens on a photograph; the title lies on it rather than above it. */
  hero: boolean;
  kicker: string;
  name: string;
  /**
   * The detail file is on its way (`DetailState.phase === "pending"`) and the
   * hero reserves its box meanwhile. A file that failed is not loading: it
   * ends the wait rather than extending it.
   */
  loading: boolean;
  /** The slides worth showing; the failed ones are already out (`shownPhotos`). */
  photos: Photo[];
  onBroken: (src: string) => void;
}) => (
  <div
    className={cn(
      "relative",
      // A thin margin rather than none at all: the photo is then a card
      // inside the panel's card, and its corners can be cut concentric
      // with the panel's own instead of running into them. Full bleed
      // put the picture's corner exactly where the drawer's radius is,
      // which is the one place a right angle and a curve cannot agree.
      hero && "mx-1.5 mt-1.5 overflow-hidden rounded-lg",
    )}
  >
    {hero && (
      <PhotoCarousel loading={loading} onBroken={onBroken} photos={photos} />
    )}
    {/*
     * 10 px inside a hero that is 6 px inside the panel: the name then starts
     * on the same line as the numbers under it.
     */}
    <div
      className={cn(
        hero
          ? "pointer-events-none absolute inset-x-0 bottom-6 px-2.5 text-white"
          : "px-4 pt-11",
      )}
    >
      <p
        className={cn(
          "text-2xs truncate font-semibold tracking-widest uppercase",
          hero ? "text-white/85" : "text-muted-foreground",
        )}
      >
        {kicker}
      </p>
      <h2
        id="detail-title"
        className={cn(
          "text-xl leading-tight font-bold tracking-tight text-balance",
          hero && "drop-shadow-[0_1px_10px_rgb(0_0_0/0.55)]",
        )}
      >
        {name}
      </h2>
    </div>
  </div>
);
