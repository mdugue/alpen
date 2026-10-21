import type { map as de } from "../de/map";
import type { Layout } from "../fill";

export const map = {
  alignNorth: "Point north",
  allRoads: "All",
  attribution: "Sources",
  base: "Base map",
  classics: "Classics",
  classicsGroup: "Which roads and tours are shown",
  classicsHint:
    "The classics – roads of fame {n} and up, tours with at least one of them. The other roads stay on the map as grey dots.",
  classicsSearching: "Search finds every road, with or without “All”.",
  cycleRoutes: "Cycle routes",
  filteredOut: "outside the filters",
  fit: "Fit the view",
  fitHint: "Fit the view – again for the whole of the Alps",
  hillshade: "Hillshade",
  /** The view menu's last group: the same place in the other language. */
  language: "Language",
  levelLine: "At this zoom level: {word}",
  locate: "My location",
  locateDenied:
    "Location not allowed – this can be changed in the browser's settings",
  locateHint: "My location – with the roads nearby",
  locateUnavailable: "Location not available right now",
  osmContributors: "© OpenStreetMap contributors",
  overlays: "Overlays",
  satellite: "Satellite",
  terrain: "Terrain",
  threeD: "3D view",
  title: "Map",
  vectorBase: "Map (light/dark automatically)",
  view: "View",
  viewMenu: "View: map, layers, 3D and language",
} as const satisfies Layout<typeof de>;
