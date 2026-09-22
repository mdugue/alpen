import type { vocab as de } from "../de/vocab";

/** The English vocabulary, held to the German tables' shape. */
export const vocab = {
  band: {
    day: {
      hint: "Doable as a day loop from the town.",
      label: "day loop",
    },
    door: {
      hint: "Straight out of the town, no car.",
      label: "on the doorstep",
    },
    trip: {
      hint: "Worth the transfer – a day out.",
      label: "day trip",
    },
  },
  country: {
    AD: "Andorra",
    AT: "Austria",
    CH: "Switzerland",
    DE: "Germany",
    ES: "Spain",
    FR: "France",
    IT: "Italy",
    SI: "Slovenia",
  },
  filter: {
    beauty: (option: string) => `Beauty ${option}`,
    difficulty: (lo: number, hi: number) =>
      lo === hi ? `Difficulty ${lo}` : `Difficulty ${lo}–${hi}`,
    fame: (option: string) => `Fame ${option}`,
    favoritesOnly: "favourites only",
    statusOr: " or ",
    traffic: (option: string) => `Traffic ${option}`,
    valley: (option: string) => `Valley ${option}`,
    wetDays: (option: string) => `Rain days ${option}`,
  },
  option: {
    any: "any",
    elevationFrom: (m: string) => `from ${m} m`,
    from: (n: number) => `from ${n}`,
    only: (n: number) => `only ${n}`,
    under: (t: number) => `under ${t} °C`,
    upTo: (n: number) => `up to ${n}`,
    upToOf15: (n: number) => `up to ${n} of 15`,
  },
  prominence: {
    famous: "famous passes",
    known: "well-known passes",
  },
  range: {
    Alpen: {
      hint: "From the Maritime Alps to Slovenia – Western, Central and Eastern Alps and the Dolomites.",
      inside: "in the Alps",
      label: "Alps",
      outside: "outside the Alps",
    },
    Jura: {
      hint: "Grand Colombier, Mont du Chat, Faucille, Chasseral: a long season, little traffic, two hours from Basel.",
      inside: "in the Jura",
      label: "Jura",
      outside: "outside the Jura",
    },
    Pyrenäen: {
      hint: "Tourmalet, Aubisque, Peyresourde, Ariège and Andorra: the Tour's other mountains, with the long season of the Spanish side.",
      inside: "in the Pyrenees",
      label: "Pyrenees",
      outside: "outside the Pyrenees",
    },
    Vogesen: {
      hint: "Grand Ballon, Schlucht, Ballon d'Alsace and the Route des Crêtes: the weekend from Freiburg, Basel or Karlsruhe.",
      inside: "in the Vosges",
      label: "Vosges",
      outside: "outside the Vosges",
    },
  },
  reach: {
    areaLine: (rideable: string, total: string) =>
      `${rideable} of ${total} roads good`,
    areaNone: "no road in the area",
    count: {
      best: (n: number) => `${n} at their best`,
      closed: (n: number) => `${n} often closed`,
      good: (n: number) => `${n} good`,
      limited: (n: number) => `${n} limited`,
    },
    noneRideable: (total: number) =>
      `None of the ${total} passes within reach is good to ride in this half-month.`,
    noneWithin: (km: number) => `No pass within ${km} km.`,
    ofTotal: (total: number, parts: string) =>
      `Of ${total} passes within reach: ${parts}.`,
  },
  roadTag: {
    carfree: {
      hint: "Closed to cars, at least on set days – the note says when.",
      label: "Car-free",
    },
    cobbles: {
      hint: "A stretch is cobbled – Tremola, Vršič – which changes the tyre choice, not the bike.",
      label: "Cobbles",
    },
    glacier: {
      hint: "Ends at a glacier or runs alongside one.",
      label: "Glacier road",
    },
    gorge: {
      hint: "A notable stretch runs through a gorge or a canyon.",
      label: "Gorge",
    },
    hairpins: {
      hint: "The hairpin structure is a monument in itself – Tremola, Lacets de Montvernier, San Boldo.",
      label: "Hairpin structure",
    },
    panorama: {
      hint: "Built for the view, and the name or the routing says so.",
      label: "Panoramic road",
    },
    reservoir: {
      hint: "The road exists because of a dam; it ends at the lake or runs along it.",
      label: "Reservoir",
    },
    toll: {
      hint: "Toll road; whether bikes pay is in the note. Says nothing about whether it is cleared.",
      label: "Toll",
    },
    tunnels: {
      hint: "Unlit tunnels or galleries to reckon with.",
      label: "Tunnels & galleries",
    },
  },
  roadType: {
    balcony: {
      hint: "Cut into a wall, with no summit the ride runs towards: Combe Laval, Gorges de la Bourne.",
      label: "Balcony road",
    },
    pass: {
      hint: "A crossing: up on one side, down on the other.",
      label: "Pass",
    },
    plateau: {
      hint: "Stays up instead of crossing once: a high road, a plateau.",
      label: "High road",
    },
    spur: {
      hint: "A climb to a point where the road ends – the way down is the same ascent back.",
      label: "Dead-end climb",
    },
    valley: {
      hint: "A quiet dead-end valley with little gradient.",
      label: "Valley road",
    },
  },
  sort: {
    beauty: "Beauty",
    difficulty: "Difficulty",
    elevation: "Elevation",
    fame: "Fame",
    name: "Name",
    status: "Status",
    traffic: "Traffic",
  },
  surface: {
    asphalt: {
      hint: "Paved throughout – the road a road bike rides.",
      label: "Asphalt",
    },
    gravel: {
      hint: "Unpaved – gravel, military road, alpine track: gravel or mountain bike, and open as soon as the snow is gone.",
      label: "Gravel",
    },
    mixed: {
      hint: "Asphalt with a gravel stretch no road bike rides – the note says where.",
      label: "Mixed",
    },
  },
  townTag: {
    events: {
      hint: "Start or hub of a big cycling marathon.",
      label: "Marathon town",
    },
    hotels: {
      hint: "Places to stay with a bike room, a wash bay and route advice.",
      label: "Bike hotels",
    },
    hub: {
      hint: "A fixture of the road-cycling calendar: full of road bikes in summer, service points, a training destination.",
      label: "Cycling mecca",
    },
    passes: {
      hint: "Several classic climbs start right outside the door, no transfer.",
      label: "Passes on the doorstep",
    },
    quiet: {
      hint: "Little through traffic: a side valley rather than a transit axis.",
      label: "Quiet",
    },
    scenic: {
      hint: "The setting and the landscape are a reason to come on their own.",
      label: "Especially scenic",
    },
    season: {
      hint: "Low and mild – rides early in the year and still late in autumn.",
      label: "Long season",
    },
    train: {
      hint: "Reachable without a car: a station in the town or in the valley below.",
      label: "Rail link",
    },
    workshops: {
      hint: "Road-bike shops with a workshop and rental bikes in town.",
      label: "Workshops & rental",
    },
  },
} satisfies typeof de;
