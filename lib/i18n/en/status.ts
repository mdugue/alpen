import type { status as de } from "../de/status";
import type { Layout } from "../fill";

/** The English words of the heuristic, held to the German file's shape. */
export const status = {
  best: "best time {from} – {to}",
  cell: {
    closedBarrier:
      "The road is usually closed in this period, as a rule by the winter closure.",
    closedCover:
      "The unpaved road usually lies under snow in this period – nobody clears it.",
    goodShort:
      "Nothing speaks against the ride. It is only a shorter stretch than the best time.",
    goodSnowy:
      "Nothing speaks against the ride. It does snow now and then, though.",
    limited: "Rideable, but with a catch: {phrase}.",
  },
  climate:
    "{period} at {elevation}; precipitation on {wetPct} % of days. {valley} Day {hours} h, sun {sunrise}–{sunset}.",
  grade: {
    best: "best time",
    closed: "often closed",
    good: "good",
    limited: "limited",
  },
  gradeHint: {
    best: "The most reliable weeks of the year for this pass: nothing speaks against the ride, and snow is rare.",
    closed:
      "The road is usually closed in this period – by the winter closure, or on an unpaved road by the snow cover.",
    good: "Nothing speaks against the ride. It is only either a shorter stretch than the best time, or it snows now and then.",
    limited: "Rideable, but with a catch: {reasons}.",
  },
  hours: "hours",
  label: {
    closed: "often closed",
    open: "good",
    risky: "limited",
  },
  ladder:
    'Every signal can only lower a cell, never lift it: {signals} turn a "good" into a "limited" – and the first signal in this order is the word next to it. "Best time" is the longest stretch without a caveat and with {bestSignal}. "Often closed" comes from the opening window – and on an unpaved road from a snow cover on {coverClosed} % of days or more: a closed or snowed-in road and a hot valley are not the same kind of statement.',
  lapse: "{rate} °C per 100 m",
  reason: {
    altitude:
      "{period} at {elevation} m is borderline: snow and ice are possible even when the road is open.",
    coldDescent:
      "At the summit no more than {tmax} °C on an average day (ERA5-Land 2015–2024) – with the wind chill the descent is one around freezing.",
    frost:
      "Frost on {pct} % of nights (≈ {days} of 15, ERA5-Land 2015–2024) – wet roads can ice over, and the descent gets cold.",
    heat: "Around {tmax} °C in the valley in the afternoon (derived from the summit value, ± {error} °C) – from late morning on only the top is pleasant.",
    outsideSeason: "Outside the typical season.",
    outsideWindow: "Outside the typical opening window ({window}).",
    shortDay:
      "Only {hours} hours of daylight, sunset around {sunset} – tight for a long loop.",
    snow: "Snowfall on {pct} % of days (≈ {days} of 15, ERA5-Land 2015–2024) – the road usually stays rideable, but the period cannot be planned on.",
    snowCover:
      "Snow cover on {pct} % of days (≈ {days} of 15, ERA5-Land 2015–2024) – nobody clears an unpaved road, it is open once the snow is gone.",
    wet: "Rain on {pct} % of days (≈ {days} of 15, ERA5-Land 2015–2024) – a wet corner; a dry window is a matter of luck.",
    windowEdge:
      "At the edge of the opening window ({window}) – opening and closing shift by weeks from one winter to the next.",
  },
  reasonPhrase: {
    altitude: "the altitude, snow and ice are possible",
    "cold-descent": "a cold descent",
    frost: "frost at night",
    heat: "heat in the valley",
    "outside-window": "the winter closure",
    "short-day": "short days",
    snow: "snowfall",
    "snow-cover": "old snow on the unpaved road",
    wet: "a lot of rain",
    "window-edge":
      "the edge of the opening window, opening and closing shift from one winter to the next",
  },
  reasonShort: {
    altitude: "the altitude",
    "cold-descent": "a cold descent",
    frost: "frost",
    heat: "heat in the valley",
    "outside-window": "the winter closure",
    "short-day": "short days",
    snow: "snow",
    "snow-cover": "old snow",
    wet: "a lot of rain",
    "window-edge": "the edge of the opening window",
  },
  reasonWord: {
    altitude: "altitude",
    "cold-descent": "cold descent",
    frost: "frost",
    heat: "heat",
    "outside-window": "closed",
    "short-day": "short days",
    snow: "snow",
    "snow-cover": "snowed in",
    wet: "wet",
    "window-edge": "edge of season",
  },
  season: {
    allYear:
      "Rideable all year (cleared in winter); snow and cold depending on altitude.",
    likePasses: "as its passes",
    maintained: " (serviced toll road, cleared)",
    tourOwn: "Typically {window}.",
    tourPasses: "Rideable as long as the loop's passes are open.",
    typical: "Typically open {window}{maintained}.",
  },
  signal: {
    best: "fewer than {value} snowfall days",
    "cold-descent": "a summit daily maximum below {value}",
    frost: "frost on {value} of nights",
    heat: "heat in the valley from {value}",
    "short-day": "days with under {value} of light",
    snow: "snowfall on {value} of days or more",
    "snow-cover": "snow cover on {value} of days on an unpaved road",
    wet: "rain on {value} of days",
  },
  summary: {
    allYear: "all year",
    closedAllYear: "Season: often closed all year.",
    limitedOnly: "Season: limited {span}, otherwise often closed.",
    parts: "Season: {parts}.",
  },
  tour: {
    closedBy: "{word}: {names}.",
    limitedBy: "{word} by {names}.",
    outsideWindow: "{word}: outside the typical window {window}.",
    windowEdge: "{word}: at the edge of the typical window {window}.",
  },
  valley: {
    derived:
      "In the valley ({valley}) around {tmax} °C, derived (± {error} °C).",
    none: "No valley value derivable, no ascent profile.",
  },
  window: "{from} to {to}",
} as const satisfies Layout<typeof de>;
