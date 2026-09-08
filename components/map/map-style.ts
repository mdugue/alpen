export interface BaseLayerDef {
  id: string;
  name: string;
  tiles: string[];
  maxzoom: number;
  attribution: string;
}

const OSM = "© OpenStreetMap-Mitwirkende";

/** Base maps without a key; those requiring a key are only added when it is set. */
export const baseLayers = (): BaseLayerDef[] => {
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
      name: "Satellit",
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

export const OVERLAYS = [
  {
    attribution: "© waymarkedtrails.org",
    id: "waymarked",
    maxzoom: 18,
    name: "Radrouten",
    opacity: 0.8,
    tiles: ["https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png"],
  },
] as const;
