import passes from "@/data/passes.json";
import tours from "@/data/tours.json";
import towns from "@/data/towns.json";
import { BRAND, SITE_NAME } from "@/lib/brand";
import { fill, langOf } from "@/lib/i18n";
import { messagesOf } from "@/lib/i18n/dictionaries";
import { periodLabel } from "@/lib/period";
import { STATUSES } from "@/lib/regions";
import {
  dotMap,
  SHARE_PERIOD,
  SHARE_SIZE,
  ShareCard,
  shareResponse,
} from "@/lib/share-image";
import { fmt } from "@/lib/utils";

/**
 * Share image. The graphic is the data itself: every pass as a dot at its
 * real position, coloured by rideability for one half-month – the arc of the
 * Alps emerges on its own (`lib/share-image.tsx`, which the entity routes
 * draw from too). The lockup (mark, wordmark, accent) is the one from
 * lib/brand.ts, so a link preview and the browser tab show the same thing.
 * One per language (plan 08): the words on it and its alt text come from the
 * message files, the dots are the same – `generateImageMetadata` rather than
 * a static `alt`, which would be one text for both.
 */
export const generateImageMetadata = ({
  params,
}: {
  params?: { lang?: string };
}) => [
  {
    alt: messagesOf(langOf(params?.lang)).share.alt,
    contentType: "image/png",
    id: "card",
    size: SHARE_SIZE,
  },
];

export default async function Image({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = langOf(raw);
  const w = messagesOf(lang);
  const { dots } = dotMap();
  // Same words as the sidebar sections, so the preview and the app agree.
  const counts = fill(w.share.counts, {
    passes: fmt(passes.length, 0, lang),
    tours: fmt(tours.length, 0, lang),
    towns: fmt(towns.length, 0, lang),
  });

  return await shareResponse(
    <ShareCard
      dots={dots}
      width={330}
      column={
        <>
          <div
            style={{
              color: BRAND.primary,
              fontSize: 54,
              fontWeight: 700,
              letterSpacing: 3,
              lineHeight: 1,
              marginTop: 22,
              textTransform: "uppercase",
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              color: BRAND.ink,
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1.3,
              marginTop: 20,
            }}
          >
            {w.share.headline}
          </div>
          <div
            style={{
              color: BRAND.muted,
              fontSize: 20,
              fontWeight: 500,
              marginTop: 14,
            }}
          >
            {counts}
          </div>
        </>
      }
    >
      <div
        style={{
          bottom: 64,
          color: BRAND.muted,
          display: "flex",
          flexDirection: "column",
          fontSize: 21,
          fontWeight: 500,
          gap: 10,
          left: 72,
          position: "absolute",
        }}
      >
        <div
          style={{
            alignItems: "center",
            color: BRAND.ink,
            display: "flex",
            fontSize: 17,
            gap: 12,
            letterSpacing: 2,
            marginBottom: 4,
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              background: BRAND.accent,
              borderRadius: 999,
              height: 4,
              width: 26,
            }}
          />
          <span>{periodLabel(SHARE_PERIOD, w)}</span>
        </div>
        {STATUSES.map((s) => (
          <div
            key={s}
            style={{ alignItems: "center", display: "flex", gap: 12 }}
          >
            <div
              style={{
                background: BRAND.status[s],
                borderRadius: 999,
                height: 14,
                width: 14,
              }}
            />
            <span>{w.status.label[s]}</span>
          </div>
        ))}
      </div>
    </ShareCard>,
  );
}
