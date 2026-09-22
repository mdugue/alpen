import type { Messages } from "./messages.de";

/** The English words, held to the German file's shape by the type. */
export const en = {
  header: {
    dataLine: "Climate 2015–2024 · 7-day forecast",
    hideSidebar: "Hide the sidebar",
    listAndFilters: "List and filters",
    noPass: "no pass in this selection.",
    scales: "Scales & sources",
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
  share: {
    counts: (passes: string, tours: string, towns: string) =>
      `${passes} passes · ${tours} loops · ${towns} towns`,
    headline: "Which region is worth it, and when?",
  },
  sidebar: {
    clearSearch: "Clear the search",
    footerNote: "The status is a heuristic, the scales are editorial.",
    search: "Search",
    searchPlaceholder: "Destination, pass, loop or town …",
    support: "Buy me a coffee",
    whatTheListShows: "What the list shows",
  },
} satisfies Messages;
