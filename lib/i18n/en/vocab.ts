import type { vocab as de } from "../de/vocab";
import type { Layout } from "../fill";

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
    BE: "Belgium",
    CH: "Switzerland",
    CZ: "Czechia",
    DE: "Germany",
    ES: "Spain",
    FR: "France",
    IT: "Italy",
    LI: "Liechtenstein",
    PL: "Poland",
    SI: "Slovenia",
    SK: "Slovakia",
  },
  filter: {
    beauty: "Beauty {option}",
    /** The fame floor the app opens on (`CLASSIC_FAME`). */
    classics: "Classics",
    difficulty: "Difficulty {lo}–{hi}",
    difficultyOne: "Difficulty {level}",
    fame: "Fame {option}",
    favoritesOnly: "favourites only",
    traffic: "Traffic {option}",
    valley: "Valley {option}",
    wetDays: "Rain days {option}",
  },
  option: {
    any: "any",
    elevationFrom: "from {m} m",
    from: "from {n}",
    only: "only {n}",
    under: "under {n} °C",
    upTo: "up to {n}",
    wetDays: "up to {n} of 15",
  },
  prominence: {
    famous: "classics and the finest well-known passes",
    known: "classics and well-known passes",
    most: "most roads",
  },
  range: {
    Alpen: {
      hint: "From the Maritime Alps to Slovenia – Western, Central and Eastern Alps and the Dolomites.",
      inside: "in the Alps",
      label: "Alps",
      outside: "outside the Alps",
    },
    Andalusien: {
      hint: "Spain's highest road above Granada, the Ragua and the Calar Alto observatory: long climbs in the Andalusian sun, for spring and autumn.",
      inside: "in the Sierra Nevada and Almería",
      label: "Sierra Nevada and Almería",
      outside: "outside the Sierra Nevada and Almería",
    },
    Apennin: {
      hint: "The Blockhaus, Campo Imperatore and the Terminillo: the great Giro climbs along Italy's spine, from Tuscany to the Abruzzo.",
      inside: "in the Apennines",
      label: "Apennines",
      outside: "outside the Apennines",
    },
    Ardennen: {
      hint: "The climbs of Liège–Bastogne–Liège and the Mur de Huy: short, steep and famous, a weekend from Cologne, Aachen and Brussels.",
      inside: "in the Ardennes",
      label: "Ardennes",
      outside: "outside the Ardennes",
    },
    Bayerwald: {
      hint: "The Arber roads above Bodenmais and Bayerisch Eisenstein, the Dreisessel and the Kleť: forest mountains on the Czech border for a weekend.",
      inside: "in the Bavarian and Bohemian Forest",
      label: "Bavarian and Bohemian Forest",
      outside: "outside the Bavarian and Bohemian Forest",
    },
    Erzgebirge: {
      hint: "Fichtelberg, Klínovec and the steep ramps of the Bohemian south side: a weekend from Dresden, Chemnitz or Prague.",
      inside: "in the Ore Mountains",
      label: "Ore Mountains",
      outside: "outside the Ore Mountains",
    },
    Harz: {
      hint: "The Brocken without cars, Torfhaus and the steep ramps above Thale: the northernmost mountains for a weekend.",
      inside: "in the Harz",
      label: "Harz",
      outside: "outside the Harz",
    },
    Jura: {
      hint: "Grand Colombier, Mont du Chat, Faucille, Chasseral: a long season, little traffic, two hours from Basel.",
      inside: "in the Jura",
      label: "Jura",
      outside: "outside the Jura",
    },
    Kanaren: {
      hint: "The Teide from sea level to 2,000 m, Masca, the Roque de los Muchachos: Europe's longest climbs for the winter.",
      inside: "on the Canary Islands",
      label: "Canary Islands",
      outside: "outside the Canary Islands",
    },
    Korsika: {
      hint: "Bavella, Vergio and Vizzavona above granite and maquis: long climbs from the sea into the mountains, for spring and autumn.",
      inside: "on Corsica",
      label: "Corsica",
      outside: "outside Corsica",
    },
    Mallorca: {
      hint: "Sa Calobra, the Puig Major and the Coll de Sóller above the sea: the answer for February, March and November.",
      inside: "on Mallorca",
      label: "Mallorca",
      outside: "outside Mallorca",
    },
    Nordspanien: {
      hint: "The Angliru, the Lagos de Covadonga and the passes of the Cantabrian Mountains: steep Vuelta climbs between the sea and the Picos de Europa.",
      inside: "in Asturias and Cantabria",
      label: "Asturias and Cantabria",
      outside: "outside Asturias and Cantabria",
    },
    Pyrenäen: {
      hint: "Tourmalet, Aubisque, Peyresourde, Ariège and Andorra: the Tour's other mountains, with the long season of the Spanish side.",
      inside: "in the Pyrenees",
      label: "Pyrenees",
      outside: "outside the Pyrenees",
    },
    Riesengebirge: {
      hint: "The mountain huts above Špindlerův Mlýn and Janské Lázně, the Okraj pass into Poland and the Ještěd above Liberec: short, steep climbs, a weekend from Dresden, Prague and Wrocław.",
      inside: "in the Giant Mountains",
      label: "Giant Mountains",
      outside: "outside the Giant Mountains",
    },
    Schwarzwald: {
      hint: "Schauinsland, Kandel, Feldberg and the Black Forest High Road: long climbs straight out of Freiburg, Karlsruhe or Basel.",
      inside: "in the Black Forest",
      label: "Black Forest",
      outside: "outside the Black Forest",
    },
    Sizilien: {
      hint: "Etna from three sides up to almost 2,000 m, the Madonie and the Nebrodi above the north coast, Erice above Trapani: long climbs in southern Italy, from March to November.",
      inside: "on Sicily",
      label: "Sicily",
      outside: "outside Sicily",
    },
    Tatra: {
      hint: "Štrbské Pleso below the High Tatras, Čertovica and Chopok in the Low Tatras, the ramps around Zakopane: mountain roads in Slovakia and Poland, from June to September.",
      inside: "in the Tatras",
      label: "Tatras",
      outside: "outside the Tatras",
    },
    Thüringen: {
      hint: "The Inselsberg and Oberhof on the Rennsteig, the Wasserkuppe and the Kreuzberg in the Rhön: short climbs for a weekend in the middle of Germany.",
      inside: "in the Thuringian Forest and the Rhön",
      label: "Thuringian Forest and Rhön",
      outside: "outside the Thuringian Forest and the Rhön",
    },
    Vogesen: {
      hint: "Grand Ballon, Schlucht, Ballon d'Alsace and the Route des Crêtes: the weekend from Freiburg, Basel or Karlsruhe.",
      inside: "in the Vosges",
      label: "Vosges",
      outside: "outside the Vosges",
    },
    Zentralmassiv: {
      hint: "The volcanoes of the Auvergne with the Puy Mary and the Cévennes with the Aigoual: empty, green, at their best in June and September.",
      inside: "in the Massif Central",
      label: "Massif Central",
      outside: "outside the Massif Central",
    },
  },
  reach: {
    areaLine: "{rideable} of {total} roads good",
    areaNone: "no road in the area",
    count: {
      best: "{n} at their best",
      closed: "{n} often closed",
      good: "{n} good",
      limited: "{n} limited",
    },
    noneRideable:
      "None of the {total} passes within reach is good to ride in this half-month.",
    noneWithin: "No pass within {km} km.",
    ofTotal: "Of {total} passes within reach: {parts}.",
  },
  region: {
    Abruzzen: "Abruzzo",
    Almería: "Almería",
    Ardennen: "Ardennes",
    Asturien: "Asturias",
    Bayerwald: "Bavarian Forest",
    Böhmerwald: "Bohemian Forest",
    Dolomiten: "Dolomites",
    Erzgebirge: "Ore Mountains",
    "Gran Canaria": "Gran Canaria",
    Harz: "Harz",
    "Hohe Tatra": "High Tatras",
    "Jeschken und Isergebirge": "Ještěd and Jizera Mountains",
    Jura: "Jura",
    Kantabrien: "Cantabria",
    Korsika: "Corsica",
    "La Palma": "La Palma",
    Latium: "Lazio",
    Mallorca: "Mallorca",
    Marken: "Marche",
    "Niedere Tatra": "Low Tatras",
    Nordsizilien: "Northern Sicily",
    Ostalpen: "Eastern Alps",
    Podhale: "Podhale",
    Pyrenäen: "Pyrenees",
    Rhön: "Rhön",
    Riesengebirge: "Giant Mountains",
    Schwarzwald: "Black Forest",
    "Sierra Nevada": "Sierra Nevada",
    Teneriffa: "Tenerife",
    Thüringen: "Thuringian Forest",
    Toskana: "Tuscany",
    Vogesen: "Vosges",
    Westalpen: "Western Alps",
    Westsizilien: "Western Sicily",
    Zentralalpen: "Central Alps",
    Zentralmassiv: "Massif Central",
    Ätna: "Etna",
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
    forest: {
      hint: "Almost entirely in the woods: shady in high summer, but without a view.",
      label: "Forest road",
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
    race: {
      hint: "A grand tour or a classic has raced here – Tour, Giro, Vuelta, Deutschland Tour.",
      label: "Race route",
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
    climb: {
      hint: "A climb onto a plateau or a ridge, where the road carries on: the Swabian Jura's escarpment, the Ore Mountains' southern edge.",
      label: "Escarpment climb",
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
  tourType: {
    edition: {
      hint: "An event that changes its course every year: this is one year's course. “Earlier years” brings back the previous ones.",
      label: "Edition",
      plural: "Editions",
    },
    event: {
      hint: "The course of a sportive or gran fondo: one day a year with a number and closed roads, free to ride on every other.",
      label: "Event",
      plural: "Events",
    },
    loop: {
      hint: "A classic loop with no timing, to ride whenever you like.",
      label: "Loop",
      plural: "Loops",
    },
    permanent: {
      hint: "A signposted permanent route with a stamp card or timing, rideable all season, with a medal for finishing.",
      label: "Permanent route",
      plural: "Permanent routes",
    },
    stages: {
      hint: "From A to B over several days, with nights on the way rather than in the same hotel.",
      label: "Multi-day route",
      plural: "Multi-day routes",
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
  /** How a range is travelled to (`RANGE_TRIP`): the two rows of range chips. */
  trip: {
    holiday: "Holiday",
    weekend: "Weekend",
  },
  unit: {
    approx: "approx.",
    climb: "m+",
  },
} as const satisfies Layout<typeof de>;
