import type { panel as de } from "../de/panel";

export const panel = {
  ascents: {
    average: (pct: string) => `avg ${pct} %`,
    info: "Routed road, 100 elevation samples from a terrain model – good for comparing, not accurate to the metre.",
    infoTraverse:
      "Routed road, 100 elevation samples from a terrain model – good for comparing, not accurate to the metre. Climbing and steepest kilometre are left out here: on a nearly flat road through a gorge the model measures more up and down than the road has.",
    noProfile: "No elevation profile available.",
    none: "No ascent recorded",
    spur: "Dead-end road: the road ends at the top, and the way down is the same ascent.",
    steepestKm: (pct: string) => `steepest km ${pct} %`,
    title: "Ascents",
    titleTraverse: "Road",
  },
  bar: {
    backToList: "Back to the list",
    close: "Close details",
    linkCopied: "Link copied",
    list: "List",
    save: (name: string) => `Save ${name}`,
    share: (name: string) => `Share ${name}`,
    unsave: (name: string) => `Remove ${name} from favourites`,
  },
  base: {
    bandCount: (n: string, noun: string, maxKm: string) =>
      `${n} ${noun} · up to ${maxKm}`,
    basesInfo: (km: number) =>
      `Towns this road can be ridden from – sorted by nearness, then by how many other passes the town offers in the chosen half-month. The list ends beyond ${km} km.`,
    basesNone: (km: number) => `No cycling town within ${km} km.`,
    basesTitle: "Towns to stay in",
    derived: (total: string) =>
      `Derived from the ${total} passes within reach – the town itself has no climate series of its own. The strip shows the course of the year relative to this town's best time`,
    derivedPeak: (peak: string) => ` (${peak} passes are good to ride then)`,
    passes: "passes",
    passesInfo: (km: number) =>
      `Sorted by condition in the chosen half-month, beauty and nearness. Nearness counts smoothly: a pass does not become worthless at a round number of kilometres, it loses weight with distance. The list ends beyond ${km} km.`,
    passesTitle: "Passes from here",
    townLine: (rideable: string, total: string) =>
      `${rideable} of ${total} passes good`,
    townNone: "no pass within reach",
    towns: "towns",
  },
  chart: {
    frost: "Frost",
    loading: "Loading climate chart",
    snow: "Snowfall",
    tmax: "avg day",
    tmin: "avg night",
  },
  climate: {
    dayNight: "avg day / night",
    frost: (days: string) => `Frost · ${days} of 15 days`,
    info: "ERA5-Land 2015–2024, a 10 km grid – rather too mild at pass height.",
    noneText: "No climate data for this pass yet.",
    noneTitle: "No climate series",
    snow: (days: string) => `Snow · ${days} of 15 days`,
    title: "Climate over the year",
  },
  destination: {
    baseMark: "base",
    derived: (total: string) =>
      `Derived from the ${total} roads in the area – a destination has no climate series of its own. The strip shows the course of the year relative to this area's best time`,
    derivedPeak: (peak: string) => ` (${peak} roads are good to ride then)`,
    lodging: "Find accommodation",
    lodgingQuery: (town: string) => `Hotels ${town}`,
    roadsInfo: (km: string) =>
      `Every road within ${km} km of the area's centre, plus the ones added editorially, minus the ones excluded. Sorted by condition in the chosen half-month, then beauty.`,
    roadsNone: "No road in the area.",
    roadsTitle: "Roads in the area",
    toursNone: "No loop starts in this area.",
    toursTitle: "Loops",
    townsInfo:
      "The towns recommended as a base first, then the others in the area. “Find accommodation” opens a map search for hotels in the town – no booking site, no commission; “Workshops” the OSM search for bike workshops.",
    townsNone: "No cycling town in the area.",
    townsTitle: "Towns to stay in",
    travelTitle: "Multi-day and getting there",
  },
  external: {
    newTab: " (opens in a new tab)",
  },
  kicker: {
    destination: (country: string) => `Destination · ${country}`,
    tour: "Loop",
    town: (country: string) => `Cycling town · ${country}`,
  },
  nearby: {
    passes: "Passes",
    title: (km: number) => `Within ${km} km`,
    tours: "Loops",
    towns: "Towns",
  },
  photos: {
    label: "Photos",
    loading: "Loading photos",
    next: "Next photo",
    notLoaded: "No photos loaded – the image file did not arrive.",
    previous: "Previous photo",
    unknownArtist: "unknown",
    viewOnCommons: (title: string) => `${title} – view on Wikimedia Commons`,
  },
  profile: {
    keyHint: (summary: string) =>
      `${summary}. Use the arrow keys to move along the profile.`,
    loading: "Loading elevation profile",
    readout: (km: string, elevation: string, gradient: string) =>
      `km ${km} · ${elevation} m · ${gradient} %`,
    summary: (km: string, start: string, top: string, average: string) =>
      `Elevation profile: ${km} km from ${start} to ${top} m, ${average} % on average`,
  },
  rating: {
    beauty: "Beauty",
    difficulty: "Difficulty",
    fame: "Fame",
    info: "Editorial judgement on a scale of 1 to 5, not measured values.",
    title: "Rating",
    traffic: "Traffic",
    trafficLevel: [
      "",
      "almost car-free",
      "quiet",
      "normal",
      "busy",
      "through road",
    ],
  },
  section: {
    sourceHint: (title: string) => `${title}: note on the source`,
  },
  tour: {
    passCount: (n: string) => `${n} passes`,
    passesTitle: "Passes of the loop",
  },
  town: {
    bikeShops: "Bike shops (Google)",
    bikeShopsQuery: (town: string) => `bike shop ${town}`,
    destinationLead: "Destination:",
    workshops: "Workshops (OSM)",
    workshopsQuery: (town: string) => `bicycle repair ${town}`,
  },
  weather: {
    allDays: "All 7 days",
    code: {
      drizzle: "drizzle",
      fog: "fog",
      overcast: "overcast",
      partlyCloudy: "partly cloudy",
      rain: "rain",
      showers: "rain showers",
      snow: "snowfall",
      snowShowers: "snow showers",
      sunny: "sunny",
      thunderstorm: "thunderstorm",
    },
    columns: {
      day: "Day",
      rain: "Rain",
      snow: "Snow",
      tmax: "Tmax",
      tmin: "Tmin",
      weather: "Weather",
      wind: "Wind",
    },
    info: "Open-Meteo forecast for the pass height, seven days.",
    loading: "Loading weather",
    snow: "snow",
    title: "Current weather",
    today: "today",
    tomorrow: "tomorrow",
    unavailableText: "Open-Meteo is not responding right now.",
    unavailableTitle: "Weather unavailable",
  },
} satisfies typeof de;
