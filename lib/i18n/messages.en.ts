import { SITE_NAME } from "@/lib/brand";

import { map } from "./en/map";
import { panel } from "./en/panel";
import { scales } from "./en/scales";
import { sidebar } from "./en/sidebar";
import { status } from "./en/status";
import { vocab } from "./en/vocab";
import type { Layout } from "./fill";
import type { de } from "./messages.de";

/** The English words, held to the German file's layout by the type and to its placeholders by a test. */
export const en = {
  backToMap: "Back to the map",
  band: {
    backToToday: "Back to today ({label})",
    daylight: "{hours} h of daylight",
    filters: "Filters",
    legend: {
      bar: "Bar height = mean daily maximum of the passes shown",
      ribbon: "Band = rideability of most of them",
      snow: "Hanging bar = share of days with snowfall",
    },
    mostly: "mostly {grade}",
    noPass: "no pass in this selection",
    period: "Period",
    snow: "{pct} % snow",
    today: "today: {label}",
    wet: "{pct} % wet",
    whatBarsMean: "What the bars mean",
  },
  calendar: {
    early: "early {month}",
    late: "late {month}",
    months: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
  },
  favorite: {
    save: "Save {name}",
    unsave: "Remove {name} from favourites",
  },
  header: {
    counts: {
      best: "{n} passes at their best time",
      closed: "{n} often closed",
      good: "{n} good",
      limited: "{n} limited",
    },
    dataLine: "Climate 2015–2024 · 7-day forecast",
    details: "Details",
    drawer: {
      details: {
        collapse: "Collapse the details",
        expand: "Expand the details",
      },
      list: { collapse: "Collapse the list", expand: "Expand the list" },
    },
    hideSidebar: "Hide the sidebar",
    list: "List",
    listAndFilters: "List and filters",
    noPass: "no pass in this selection.",
    scales: "Scales & sources",
    skipToMap: "Skip to the map",
  },
  kinds: {
    destination: "Destinations",
    pass: "Roads",
    tour: "Loops",
    town: "Towns",
  },
  lang: "en",
  legal: {
    englishNote:
      "This page is in German: it is the legal notice a site operated from Germany has to carry, and a translation would not be the binding text.",
    imprint: "Legal notice",
    privacy: "Privacy policy",
    seeAlso: "See also:",
  },
  map,
  notFound: {
    text: "There is no road, loop, town or destination at this address – perhaps it was renamed.",
    title: "Not found",
  },
  panel,
  scales,
  share: {
    alt: `${SITE_NAME} – which passes, loops and cycling towns can be ridden when?`,
    counts: "{passes} passes · {tours} loops · {towns} towns",
    entity: {
      alt: `{title} – marked on the ${SITE_NAME} map`,
      destination: "Destination",
      destinationDescription: "Destination ({country}).",
      loop: "Loop",
      loopDescription:
        "Loop, about {km} km and {gain} m of climbing over {passes} passes.",
      passDescription: "{type} {inside} ({country}).",
      town: "Cycling town",
      townDescription: "Cycling town ({country}).",
    },
    headline: "Which region is worth it, and when?",
  },
  sidebar,
  site: {
    claim:
      "Passes, loops and cycling towns in the Alps – by rideability per half-month.",
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
} as const satisfies Layout<typeof de>;
