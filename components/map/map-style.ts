import { BASEMAP_ID } from "@/lib/basemap";
import { DEFAULT_LANG, messagesOf } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

/**
 * The default: the vector map generated from the app's palette
 * (`lib/basemap.ts`), light or dark with the OS. Listed first in the popover.
 */
export const vectorBase = (lang: Lang = DEFAULT_LANG) =>
  ({ id: BASEMAP_ID, name: messagesOf(lang).map.vectorBase }) as const;

/** A raster alternative in the layer popover. */
export interface BaseLayerDef {
  id: string;
  name: string;
  tiles: string[];
  maxzoom: number;
  attribution: string;
}

/**
 * Raster base maps without a key; those requiring a key are only added when
 * it is set. The names and the OSM attribution are words the visitor reads,
 * so they come in the page's language.
 */
export const baseLayers = (lang: Lang = DEFAULT_LANG): BaseLayerDef[] => {
  const t = messagesOf(lang).map;
  const OSM = t.osmContributors;
  const list: BaseLayerDef[] = [
    {
      attribution: OSM,
      id: "osm",
      maxzoom: 19,
      name: "OpenStreetMap",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    },
    {
      attribution: `${OSM}, SRTM | © OpenTopoMap (CC-BY-SA)`,
      id: "opentopo",
      maxzoom: 17,
      name: "OpenTopoMap (Relief)",
      tiles: ["a", "b", "c"].map(
        (s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`,
      ),
    },
    {
      attribution: `${OSM} | CyclOSM`,
      id: "cyclosm",
      maxzoom: 20,
      name: "CyclOSM",
      tiles: ["a", "b", "c"].map(
        (s) =>
          `https://${s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png`,
      ),
    },
    {
      attribution: "Tiles © Esri, HERE, Garmin, FAO, NOAA, USGS",
      id: "esri-topo",
      maxzoom: 19,
      name: "Esri Topo",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      ],
    },
    {
      attribution: "Tiles © Esri, Maxar, Earthstar Geographics",
      id: "esri-sat",
      maxzoom: 19,
      name: t.satellite,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
    },
  ];

  const tf = process.env.NEXT_PUBLIC_THUNDERFOREST_KEY;
  if (tf) {
    list.push({
      attribution: `Maps © Thunderforest, ${OSM}`,
      id: "tf-outdoors",
      maxzoom: 22,
      name: "Thunderforest Outdoors",
      tiles: [
        `https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${tf}`,
      ],
    });
  }
  const mt = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (mt) {
    list.push({
      attribution: `© MapTiler, ${OSM}`,
      id: "mt-outdoor",
      maxzoom: 20,
      name: "MapTiler Outdoor",
      tiles: [
        `https://api.maptiler.com/maps/outdoor-v2/256/{z}/{x}/{y}.png?key=${mt}`,
      ],
    });
  }
  return list;
};

/** The overlays as the style knows them: ids, tiles, attribution – no words. */
export const OVERLAYS = [
  {
    attribution: "© waymarkedtrails.org",
    id: "waymarked",
    maxzoom: 18,
    opacity: 0.8,
    tiles: ["https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png"],
  },
] as const;

export type OverlayId = (typeof OVERLAYS)[number]["id"];

/** What the view menu calls each overlay, in the page's language. */
export const overlayName = (id: OverlayId, lang: Lang = DEFAULT_LANG) => {
  const t = messagesOf(lang).map;
  switch (id) {
    case "waymarked": {
      return t.cycleRoutes;
    }
    default: {
      return id satisfies never;
    }
  }
};
