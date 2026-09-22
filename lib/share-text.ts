import { RANGE, rangeOf, ROAD_TYPE } from "@/lib/regions";
import { seasonText } from "@/lib/status";
import type { Destination, Pass, Tour, Town } from "@/lib/types";
import { fmt, fmtUnit } from "@/lib/utils";

/**
 * The title and the description of an entity route – what a search result
 * and a link preview show (plan 02). Pure text over the data, so the page's
 * metadata, its share image and the sitemap read the same sentences.
 */

/** An entity as the routes see it: its kind and the record behind it. */
export type Entity =
  | { kind: "pass"; pass: Pass }
  | { kind: "tour"; tour: Tour }
  | { kind: "town"; town: Town }
  | { kind: "destination"; destination: Destination };

/** The first sentence of a note, for a description that must stay short. */
const firstSentence = (text: string): string => {
  const m = /^.*?[.!?](?=\s|$)/su.exec(text.trim());
  return m ? m[0] : text.trim();
};

export const entityName = (e: Entity): string => {
  switch (e.kind) {
    case "pass": {
      return e.pass.name;
    }
    case "tour": {
      return e.tour.name;
    }
    case "town": {
      return e.town.name;
    }
    case "destination": {
      return e.destination.name;
    }
    default: {
      return e satisfies never;
    }
  }
};

/** "Col du Galibier · 2.642 m", "Sellaronda · Rundtour", "Bormio · Rad-Ort", "Oisans · Reiseziel". */
export const entityTitle = (e: Entity): string => {
  switch (e.kind) {
    case "pass": {
      return `${e.pass.name} · ${fmtUnit(e.pass.elevation, "m")}`;
    }
    case "tour": {
      return `${e.tour.name} · Rundtour`;
    }
    case "town": {
      return `${e.town.name} · Rad-Ort`;
    }
    case "destination": {
      return `${e.destination.name} · Reiseziel`;
    }
    default: {
      return e satisfies never;
    }
  }
};

/** The season sentence and the first sentence of the note; a loop its description. */
export const entityDescription = (e: Entity): string => {
  switch (e.kind) {
    case "pass": {
      return `${ROAD_TYPE[e.pass.type].label} ${RANGE[rangeOf(e.pass.region)].inside} (${e.pass.country}). ${seasonText(e.pass)} ${firstSentence(e.pass.note)}`;
    }
    case "tour": {
      return `Rundtour, ca. ${fmt(e.tour.km)} km und ${fmt(e.tour.elevationGain)} hm über ${fmt(e.tour.passes.length)} Pässe. ${firstSentence(e.tour.description)}`;
    }
    case "town": {
      return `Rad-Ort (${e.town.country}). ${firstSentence(e.town.why)}`;
    }
    case "destination": {
      return `Reiseziel (${e.destination.country}). ${firstSentence(e.destination.character)} ${firstSentence(e.destination.multiDay)}`;
    }
    default: {
      return e satisfies never;
    }
  }
};
