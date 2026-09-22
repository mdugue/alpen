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
import { cn, OVERLAY_CONTROL } from "@/lib/utils";

/**
 * What makes white letters legible on a photograph of anything. Three fifths
 * of the hero's height, so a title of two lines still sits on the dark end.
 */
const Scrim = () => (
  <div
    aria-hidden
    className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
  />
);

/**
 * The photos of the selected entity, one swipe apart, as the panel's hero:
 * edge to edge at the very top, no border, no radius of its own – the panel
 * (and on a phone the drawer) already has one and clips it. The title, the
 * kicker and the panel's own controls lie on top of it.
 *
 * A slideshow rather than a grid: six photos in the height of one is what
 * makes room for them in a panel that already carries a season strip, two
 * profiles and a climate chart. And a *carousel* rather than one static hero,
 * which is the other thing it could be. The build picks up to six photos per
 * entity without an editorial step (`scripts/build-photos.ts`), so the first
 * one is not reliably the best one, and "what does it look like up there"
 * is a question one picture rarely answers – the reason the app shows photos
 * at all is that a destination is chosen by the look of it. A hero that can
 * be swiped costs nothing extra: the slides are already fetched lazily, the
 * horizontal drag is the gesture the sheet's vertical one leaves free, and
 * the counter in the corner says there is more without a second control.
 *
 * Every slide carries its own attribution, because that is what the licences
 * demand and because the credit for a photo has to be on the photo, not in a
 * footnote somewhere below. It is baked into each slide instead of being
 * derived from the carousel's current index: no state, nothing to get out of
 * sync, and it is correct while a slide is still half-scrolled into view.
 * That is also why the scrim is per slide rather than one sheet over the
 * whole hero – the slides sit edge to edge, so their scrims tile into one.
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
 * While the file is still on its way the box is reserved at the hero's own
 * height rather than left empty: the panel opens first and the photos follow,
 * and a carousel that appeared afterwards would push everything below it down.
 * What is known that early is the count in the page's `DetailAsset`, which is
 * also what decides the shape of the whole panel head (`heroShape` in
 * lib/detail-state.ts).
 *
 * Borrowed files can also fail to arrive, and this app is built for exactly
 * the connection where they do – the holiday Wi-Fi the whole payload
 * architecture is tuned for. A broken `<img>` renders its alt text in the
 * frame, so the slide became a grey box holding the file's own Commons title
 * over two lines, above a caption crediting a photographer for a photo nobody
 * could see. A slide that failed is therefore dropped rather than patched up:
 * it is reported through `onBroken` and the carousel renumbers itself around
 * it, and once every slide has failed the head gives way to the plain title
 * block an entity without photos gets, because white letters need a picture
 * under them. There is no placeholder that would not be a claim about a
 * picture that is not there (the skeleton below is a claim about one that is
 * still on its way, which is a different thing).
 */
export const PhotoCarousel = ({
  loading,
  photos,
  onBroken,
}: {
  /** The detail file is still on its way; the box is reserved meanwhile. */
  loading: boolean;
  /** The slides that are still worth showing – the failed ones are already out. */
  photos: Photo[];
  /** One slide's file did not arrive. */
  onBroken: (src: string) => void;
}) => {
  if (loading)
    return (
      <>
        <Skeleton
          aria-busy
          aria-label="Bilder werden geladen"
          className="aspect-video w-full rounded-none"
          role="status"
        />
        <Scrim />
      </>
    );

  return (
    <Carousel aria-label="Bilder" opts={{ duration: 18 }}>
      <CarouselContent className="ml-0">
        {photos.map((photo, i) => (
          <CarouselItem className="pl-0" key={photo.src}>
            <figure className="bg-muted relative overflow-hidden">
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
                onError={() => onBroken(photo.src)}
                sizes={PHOTO_SIZES}
                src={photo.src}
                srcSet={photoSrcSet(photo)}
                width={photo.width}
              />
              <Scrim />
              <figcaption className="text-2xs absolute inset-x-0 bottom-0 flex h-6 items-center gap-1.5 px-2.5 pb-1.5 leading-tight text-white/85">
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
            className={cn("left-2", OVERLAY_CONTROL)}
          />
          <CarouselNext
            aria-label="Nächstes Bild"
            className={cn("right-2", OVERLAY_CONTROL)}
          />
        </>
      )}
    </Carousel>
  );
};
