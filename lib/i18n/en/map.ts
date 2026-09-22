import type { map as de } from "../de/map";

export const map = {
  alignNorth: "Point north",
  attribution: "Sources",
  base: "Base map",
  cycleRoutes: "Cycle routes",
  fit: "Fit the view",
  fitHint: "Fit the view – again for the whole of the Alps",
  hillshade: "Hillshade",
  levelLine: (word: string) => `At this zoom level: ${word}`,
  osmContributors: "© OpenStreetMap contributors",
  overlays: "Overlays",
  satellite: "Satellite",
  terrain: "Terrain",
  threeD: "3D view",
  title: "Map",
  vectorBase: "Map (light/dark automatically)",
  view: "View",
  viewMenu: "View: map, layers and 3D",
} satisfies typeof de;
