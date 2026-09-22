import { ImageResponse } from "next/og";

import { BRAND, SITE_NAME } from "@/lib/brand";
import { getEntity, staticParams } from "@/lib/data";
import { langOf } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { MarkBadge } from "@/lib/mark";
import { selectionOf } from "@/lib/routes";
import { DotLayer, dotMap, SHARE_SIZE, shareFonts } from "@/lib/share-image";
import { entityDescription, entityTitle } from "@/lib/share-text";
import { seasonText, tourSeasonText } from "@/lib/status";
import type { LatLon } from "@/lib/types";

/**
 * The share image of one entity (plan 02): the site's dot map with the
 * entity ringed, its name, and the line that holds at share time. The
 * half-month cannot be known then, so the card shows the typical season
 * rather than a status – a status would be a claim about a day the card
 * knows nothing about (Principle 3). One per language (plan 08): the words
 * on it follow the route's segment, the dots are the same.
 */
export const generateStaticParams = () => staticParams();
// A static export, so one text for both languages: Next reads `alt` from the
// module, not from the params.
export const alt = `${SITE_NAME} – Karte mit der markierten Straße, Tour, dem Ort oder Reiseziel`;
export const size = SHARE_SIZE;
export const contentType = "image/png";

type Found = NonNullable<ReturnType<typeof getEntity>>;

/** Where the ring goes: the entity's own point, a loop's first waypoint, an area's centre. */
const pointOf = (e: Found): LatLon => {
  switch (e.kind) {
    case "pass": {
      return e.pass;
    }
    case "tour": {
      return e.tour.waypoints[0]!;
    }
    case "town": {
      return e.town;
    }
    case "destination": {
      return e.destination.center;
    }
    default: {
      return e satisfies never;
    }
  }
};

/** The one line under the name: the season where there is one, else the description. */
const lineOf = (e: Found, lang: Lang): string => {
  switch (e.kind) {
    case "pass": {
      return seasonText(e.pass, lang);
    }
    case "tour": {
      return tourSeasonText(e.tour, lang);
    }
    case "town":
    case "destination": {
      return entityDescription(e, lang);
    }
    default: {
      return e satisfies never;
    }
  }
};

export default async function Image({
  params,
}: {
  params: Promise<{ kind: string; lang: string; slug: string }>;
}) {
  const { kind, lang: raw, slug } = await params;
  const lang = langOf(raw);
  const selection = selectionOf(`/${kind}/${encodeURIComponent(slug)}`);
  const entity = selection && getEntity(selection, lang);
  const { dots, project } = dotMap();
  const mark = entity ? project(pointOf(entity)) : null;
  const title = entity ? entityTitle(entity, lang) : SITE_NAME;
  const line = entity ? lineOf(entity, lang) : "";

  return new ImageResponse(
    <div
      style={{
        background: BRAND.day,
        color: BRAND.ink,
        display: "flex",
        fontFamily: "Oxanium",
        height: "100%",
        position: "relative",
        width: "100%",
      }}
    >
      <DotLayer dots={dots} mark={mark} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          left: 72,
          position: "absolute",
          top: 68,
          width: 360,
        }}
      >
        <MarkBadge size={62} />
        <div
          style={{
            color: BRAND.primary,
            fontSize: 26,
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
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1.15,
            marginTop: 18,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: BRAND.muted,
            fontSize: 22,
            fontWeight: 500,
            lineHeight: 1.35,
            marginTop: 16,
          }}
        >
          {line}
        </div>
      </div>
    </div>,
    { ...size, fonts: await shareFonts() },
  );
}
