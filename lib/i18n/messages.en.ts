import { SITE_NAME } from "@/lib/brand";

import { map } from "./en/map";
import { panel } from "./en/panel";
import { scales } from "./en/scales";
import { sidebar } from "./en/sidebar";
import { status } from "./en/status";
import { vocab } from "./en/vocab";
import type { Messages } from "./messages.de";

/** The English words, held to the German file's shape by the type. */
export const en = {
  band: {
    backToToday: (label: string) => `Back to today (${label})`,
    daylight: (hours: string) => `${hours} h of daylight`,
    filters: "Filters",
    legend: {
      bar: "Bar height = mean daily maximum of the passes shown",
      ribbon: "Band = rideability of most of them",
      snow: "Hanging bar = share of days with snowfall",
    },
    mostly: (grade: string) => `mostly ${grade}`,
    noPass: "no pass in this selection",
    period: "Period",
    snow: (pct: string) => `${pct} % snow`,
    today: (label: string) => `today: ${label}`,
    wet: (pct: string) => `${pct} % wet`,
    whatBarsMean: "What the bars mean",
  },
  header: {
    collapse: (label: string) => `Collapse ${label.toLowerCase()}`,
    counts: {
      best: (n: string) => `${n} passes at their best time`,
      closed: (n: string) => `${n} often closed`,
      good: (n: string) => `${n} good`,
      limited: (n: string) => `${n} limited`,
    },
    dataLine: "Climate 2015–2024 · 7-day forecast",
    details: "Details",
    expand: (label: string) => `Expand ${label.toLowerCase()}`,
    hideSidebar: "Hide the sidebar",
    hint: "Diese Karte gibt es auch auf Deutsch.",
    hintDismiss: "Ausblenden",
    hintOpen: "Deutsche Version",
    list: "List",
    listAndFilters: "List and filters",
    noPass: "no pass in this selection.",
    scales: "Scales & sources",
    skipToMap: "Skip to the map",
    switchTo: "Deutsche Version",
  },
  kinds: {
    destination: "Destinations",
    pass: "Roads",
    tour: "Loops",
    town: "Towns",
  },
  legal: {
    englishNote:
      "This page is in German: it is the legal notice a site operated from Germany has to carry, and a translation would not be the binding text.",
  },
  map,
  panel,
  scales,
  share: {
    counts: (passes: string, tours: string, towns: string) =>
      `${passes} passes · ${tours} loops · ${towns} towns`,
    entity: {
      destination: "Destination",
      destinationDescription: (country: string) => `Destination (${country}).`,
      loop: "Loop",
      loopDescription: (km: string, gain: string, passes: string) =>
        `Loop, about ${km} km and ${gain} m of climbing over ${passes} passes.`,
      passDescription: (type: string, inside: string, country: string) =>
        `${type} ${inside} (${country}).`,
      town: "Cycling town",
      townDescription: (country: string) => `Cycling town (${country}).`,
    },
    headline: "Which region is worth it, and when?",
  },
  sidebar,
  site: {
    description:
      "Where to go with the road bike, and when? Alpine passes, ascents with elevation profiles, loops and cycling towns on one map – with rideability per half-month, weather and climate.",
    keywords: [
      "Alpine passes",
      "road bike",
      "road cycling holiday",
      "cycling holiday Alps",
      "pass summits",
      "loops",
      "elevation profile",
      "pass opening",
      "when are the Alpine passes open",
      "cycling destinations",
    ],
    tagline: "Road bike map",
    title: `${SITE_NAME} – Road bike map`,
  },
  status,
  vocab,
} satisfies Messages;
