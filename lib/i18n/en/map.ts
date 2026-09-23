import type { map as de } from "../de/map";
import type { Layout } from "../fill";

export const map = {
  alignNorth: "Point north",
  attribution: "Sources",
  base: "Base map",
  cycleRoutes: "Cycle routes",
  fit: "Fit the view",
  fitHint: "Fit the view – again for the whole of the Alps",
  hillshade: "Hillshade",
  /** The view menu's last group: the same place in the other language. */
  language: "Language",
  levelLine: "At this zoom level: {word}",
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
