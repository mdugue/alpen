import type { StyleSpecification } from "maplibre-gl";

export interface BaseLayerDef {
  id: string;
  name: string;
  tiles: string[];
  maxzoom: number;
  attribution: string;
}

const OSM = "© OpenStreetMap-Mitwirkende";

/** Base maps without a key; those requiring a key are only added when it is set. */
export function baseLayers(): BaseLayerDef[] {
  const list: BaseLayerDef[] = [
    {
      id: "osm",
      name: "OpenStreetMap",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      maxzoom: 19,
      attribution: OSM,
    },
    {
      id: "opentopo",
      name: "OpenTopoMap (Relief)",
      tiles: ["a", "b", "c"].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
      maxzoom: 17,
      attribution: `${OSM}, SRTM | © OpenTopoMap (CC-BY-SA)`,
    },
    {
      id: "cyclosm",
      name: "CyclOSM",
      tiles: ["a", "b", "c"].map((s) => `https://${s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png`),
      maxzoom: 20,
      attribution: `${OSM} | CyclOSM`,
    },
    {
      id: "esri-topo",
      name: "Esri Topo",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"],
      maxzoom: 19,
      attribution: "Tiles © Esri, HERE, Garmin, FAO, NOAA, USGS",
    },
    {
      id: "esri-sat",
      name: "Satellit",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      maxzoom: 19,
      attribution: "Tiles © Esri, Maxar, Earthstar Geographics",
    },
  ];

  const tf = process.env.NEXT_PUBLIC_THUNDERFOREST_KEY;
  if (tf) {
    list.push({
      id: "tf-outdoors",
      name: "Thunderforest Outdoors",
      tiles: [`https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${tf}`],
      maxzoom: 22,
      attribution: `Maps © Thunderforest, ${OSM}`,
    });
  }
  const mt = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (mt) {
    list.push({
      id: "mt-outdoor",
      name: "MapTiler Outdoor",
      tiles: [`https://api.maptiler.com/maps/outdoor-v2/256/{z}/{x}/{y}.png?key=${mt}`],
      maxzoom: 20,
      attribution: `© MapTiler, ${OSM}`,
    });
  }
  return list;
}

export const OVERLAYS = [
  {
    id: "waymarked",
    name: "Radrouten",
    tiles: ["https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png"],
    maxzoom: 18,
    opacity: 0.8,
    attribution: "© waymarkedtrails.org",
  },
] as const;
