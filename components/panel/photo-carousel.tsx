"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { PHOTO_SIZES, photoSrcSet } from "@/lib/photos";
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
 * this is a plain `<img>` and not `next/image`: they are already rendered,
 * already cached, and routing a few hundred of them through the image
 * optimiser would add a hop and a bill for the same bytes. What the optimiser
 * would have brought, the two attributes below bring without it – a `srcset`
 * off Commons' own width ladder (`photoSrcSet`), so a 1x panel fetches 500 px
 * instead of 960, and a placeholder baked into the metadata (`Photo.blur`),
 * laid under the photo so the slide opens on its own colours and the sharp
 * file lands on top of them.
 *
 * The placeholder is `BLUR_WIDTH` px wide and drawn twenty times that, so it
 * is blurred rather than left to the browser's upscaling: at this scale the
 * upscaling is visibly blocky, and a blur is what makes a stand-in read as
 * "not yet sharp" instead of "badly rendered". It sits in a layer of its own
 * because `filter` applies to an element's children too – on the figure it
 * would smear the attribution as well – and that layer is scaled up, because
 * a blur samples past the edges and would otherwise fade them out.
 *
 * `count` is what the page knows before the file arrives (`DetailAsset`). The
 * panel opens first and the photos follow, so without it the carousel would
 * appear late and push everything below it down; with it the slide's box is
 * there from the first frame and the photo fills it in place.
 */
export const PhotoCarousel = ({
  count,
  photos,
}: {
  /** Photos this entity has, known before they arrive. */
  count: number;
  photos: Photo[];
}) => {
  if (photos.length === 0) {
    // Nothing to wait for: an entity without photos reserves nothing.
    if (count === 0) return null;
    return (
      <Skeleton
        aria-busy
        aria-label="Bilder werden geladen"
        className="mt-3 aspect-video w-full rounded-lg"
        role="status"
      />
    );
  }

  return (
    <Carousel aria-label="Bilder" className="mt-3" opts={{ duration: 18 }}>
      <CarouselContent className="-ml-1.5">
        {photos.map((photo, i) => (
          <CarouselItem className="pl-1.5" key={photo.src}>
            <figure className="border-border/60 bg-muted relative overflow-hidden rounded-lg border">
              {photo.blur && (
                <div
                  aria-hidden
                  className="absolute inset-0 scale-110 bg-cover bg-center blur-md"
                  style={{ backgroundImage: `url("${photo.blur}")` }}
                />
              )}
              <img
                alt={photo.title}
                className="relative aspect-video w-full object-cover"
                decoding="async"
                height={photo.height}
                // The first photo is the hero and is visible as the panel
                // opens; the rest are one swipe away and can wait.
                loading={i === 0 ? "eager" : "lazy"}
                sizes={PHOTO_SIZES}
                src={photo.src}
                srcSet={photoSrcSet(photo)}
                width={photo.width}
              />
              <figcaption className="text-2xs absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2 pt-6 pb-1.5 leading-tight text-white/85">
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
