import { ImageResponse } from "next/og";

import { BRAND, SITE_NAME } from "@/lib/brand";
import { entityAt } from "@/lib/data";
import { fill, langOf } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n";
import { messagesOf } from "@/lib/i18n/dictionaries";
import { MarkBadge } from "@/lib/mark";
import { DotLayer, dotMap, SHARE_SIZE, shareFonts } from "@/lib/share-image";
import { entityDescription, entityTitle } from "@/lib/share-text";
import type { Entity } from "@/lib/share-text";
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

interface Segments {
  kind: string;
  lang: string;
  slug: string;
}

/** The entity and the words of a route's segments; no entity for a path that names none. */
const read = ({ kind, lang: raw, slug }: Segments) => {
  const w = messagesOf(langOf(raw));
  return { entity: entityAt(kind, slug, w.lang)?.entity, w };
};

/** The alt text names the entity, in the route's language (a static `alt` could do neither). */
export const generateImageMetadata = ({ params }: { params: Segments }) => {
  const { entity, w } = read(params);
  return [
    {
      alt: entity
        ? fill(w.share.entity.alt, { title: entityTitle(entity, w) })
        : w.share.alt,
      contentType: "image/png",
      id: "card",
      size: SHARE_SIZE,
    },
  ];
};

/** Where the ring goes: the entity's own point, a loop's first waypoint, an area's centre. */
const pointOf = (e: Entity): LatLon => {
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
const lineOf = (e: Entity, w: Messages): string => {
  switch (e.kind) {
    case "pass": {
      return seasonText(e.pass, w);
    }
    case "tour": {
      return tourSeasonText(e.tour, w);
    }
    case "town":
    case "destination": {
      return entityDescription(e, w);
    }
    default: {
      return e satisfies never;
    }
  }
};

export default async function Image({ params }: { params: Promise<Segments> }) {
  const { entity, w } = read(await params);
  const { dots, project } = dotMap();
  const mark = entity ? project(pointOf(entity)) : null;
  const title = entity ? entityTitle(entity, w) : SITE_NAME;
  const line = entity ? lineOf(entity, w) : "";

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
    { ...SHARE_SIZE, fonts: await shareFonts() },
  );
}
