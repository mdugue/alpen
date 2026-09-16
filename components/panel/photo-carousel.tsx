"use client";

import { useState } from "react";

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
 *
 * Borrowed files can also fail to arrive, and this app is built for exactly
 * the connection where they do – the holiday Wi-Fi the whole payload
 * architecture is tuned for. A broken `<img>` renders its alt text in the
 * frame, so the slide became a grey box holding the file's own Commons title
 * over two lines, above a caption crediting a photographer for a photo nobody
 * could see. A slide that failed is therefore dropped rather than patched up:
 * the carousel renumbers itself around it, and once every slide has failed
 * the block disappears the same way an entity without photos never shows one.
 * That is also the honest outcome – there is no placeholder that would not be
 * a claim about a picture that is not there.
 */
export const PhotoCarousel = ({ photos }: { photos: Photo[] }) => {
  const [broken, setBroken] = useState<string[]>([]);
  const shown = photos.filter((p) => !broken.includes(p.src));
  if (shown.length === 0) return null;

  return (
    <Carousel aria-label="Bilder" className="mt-3" opts={{ duration: 18 }}>
      <CarouselContent className="-ml-1.5">
        {shown.map((photo, i) => (
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
                onError={() =>
                  setBroken((b) =>
                    b.includes(photo.src) ? b : [...b, photo.src],
                  )
                }
                src={photo.src}
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
                {shown.length > 1 && (
                  <span className="ml-auto shrink-0 tabular-nums opacity-70">
                    {i + 1}/{shown.length}
                  </span>
                )}
              </figcaption>
            </figure>
          </CarouselItem>
        ))}
      </CarouselContent>
      {shown.length > 1 && (
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
