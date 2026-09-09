"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { Photo } from "@/lib/types";
import { cn, MAP_CONTROL } from "@/lib/utils";

/**
 * The photos of the selected entity, one swipe apart. A slideshow rather than a
 * grid: six photos in the height of one is what makes room for them in a panel
 * that already carries a season strip, two profiles and a climate chart.
 *
 * Every slide carries its own attribution, because that is what the licences
 * demand and because the credit for a photo has to be on the photo, not in a
 * footnote somewhere below. It is baked into each slide instead of being
 * derived from the carousel's current index: no state, nothing to get out of
 * sync, and it is correct while a slide is still half-scrolled into view.
 *
 * The files are loaded from Wikimedia's CDN (`lib/photos.ts`), which is why
 * this is a plain `<img>` – they are already the right size and already
 * cached; routing a few hundred of them through the image optimiser would buy
 * nothing.
 */
export const PhotoCarousel = ({ photos }: { photos: Photo[] }) => {
  if (photos.length === 0) return null;

  return (
    <Carousel aria-label="Bilder" className="mt-3" opts={{ duration: 18 }}>
      <CarouselContent className="-ml-1.5">
        {photos.map((photo, i) => (
          <CarouselItem className="pl-1.5" key={photo.src}>
            <figure className="border-border/60 bg-muted relative overflow-hidden rounded-lg border">
              <img
                alt={photo.title}
                className="aspect-video w-full object-cover"
                decoding="async"
                height={photo.height}
                // The first photo is the hero and is visible as the panel
                // opens; the rest are one swipe away and can wait.
                loading={i === 0 ? "eager" : "lazy"}
                src={photo.src}
                width={photo.width}
              />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2 pt-6 pb-1.5 text-[10px] leading-tight text-white/85">
                <a
                  className="min-w-0 truncate underline-offset-2 hover:underline"
                  href={photo.page}
                  rel="noopener noreferrer"
                  target="_blank"
                  title={`${photo.title} – auf Wikimedia Commons ansehen`}
                >
                  {photo.artist || "unbekannt"}
                </a>
                <span aria-hidden>·</span>
                <a
                  className="shrink-0 underline-offset-2 hover:underline"
                  href={photo.licenseUrl ?? photo.page}
                  rel="noopener noreferrer license"
                  target="_blank"
                >
                  {photo.license}
                </a>
                {photos.length > 1 && (
                  <span className="ml-auto shrink-0 tabular-nums opacity-70">
                    {i + 1}/{photos.length}
                  </span>
                )}
              </figcaption>
            </figure>
          </CarouselItem>
        ))}
      </CarouselContent>
      {photos.length > 1 && (
        <>
          <CarouselPrevious
            aria-label="Vorheriges Bild"
            className={cn("left-2", MAP_CONTROL)}
          />
          <CarouselNext
            aria-label="Nächstes Bild"
            className={cn("right-2", MAP_CONTROL)}
          />
        </>
      )}
    </Carousel>
  );
};
