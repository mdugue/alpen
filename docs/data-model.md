# Datenmodell

Alle Typen stehen in [`lib/types.ts`](../lib/types.ts). Quelldaten werden von
Hand gepflegt, abgeleitete Daten kommen aus `scripts/build-data.ts`.

## Quelldaten (von Hand)

### `data/passes.json`

```jsonc
{
  "slug": "col-du-galibier",       // stabil, aus dem Namen erzeugt; Umlaute → ae/oe/ue
  "name": "Col du Galibier",
  "country": "FR",                  // "CH/IT" für Grenzpässe
  "region": "Westalpen",            // Westalpen | Zentralalpen | Ostalpen | Dolomiten
  "lat": 45.064, "lon": 6.408,
  "elevation": 2642,
  "classicAscent": "18 km, 6,9 % ab Valloire (34 km via Télégraphe)",
  "beauty": 5, "fame": 5, "difficulty": 5, "traffic": 2,   // 1–5, siehe scales.md
  "season": { "opens": 6, "closes": 10.5 },  // Halbmonate; null = ganzjährig geräumt
  "note": "…",                       // ein bis zwei Sätze redaktioneller Hinweis
  "ascents": [{ "from": { "lat": 45.165, "lon": 6.430 }, "label": "Valloire (Nord)" }]
}
```

`season.maintained: true` markiert bewirtschaftete Mautstraßen (Großglockner,
Timmelsjoch, Nockalm …). Sie werden geräumt und bekommen deshalb keinen
Höhenabschlag in der Statusheuristik.

**Zeitrechnung:** Ein `Period` ist ein Halbmonat. `10` = Anfang Oktober,
`10.5` = Ende Oktober. `PERIODS` in `lib/status.ts` listet alle 24.

### `data/tours.json`

`passes` enthält Pass-**Slugs**; daraus wird der Tourstatus als schlechtester
Status der beteiligten Pässe berechnet. `waypoints` sind grobe Stützpunkte, die
das Routing zu einer Linie verbindet.

### `data/towns.json`

Orte mit Rennrad-Infrastruktur (Werkstätten, Verleih, Rad-Hotels). `why` ist ein
Satz, der Passumfeld und Infrastruktur nennt.

## Abgeleitete Daten (`bun run data:build`)

| Datei | Schlüssel | Inhalt |
| --- | --- | --- |
| `routes.json` | `<pass-slug>:<index>`, `tour:<tour-slug>` | Straßenverlauf als `[lat, lon][]` |
| `profiles.json` | `<pass-slug>:<index>` | km, hm, Ø-Steigung, Stützpunkte |
| `climate.json` | `<pass-slug>` | 24 Halbmonate mit Ø-Temperaturen und Frost-/Schnee-/Regenanteil |

Die Dateien gehören ins Repo. Sie ändern sich nur, wenn Pässe oder Auffahrten
dazukommen – das Skript überspringt alles, was schon vorhanden ist.

## Einen Pass hinzufügen

1. Eintrag in `data/passes.json` ergänzen (Slug nach demselben Muster).
2. `bun run data:build` – holt nur die neuen Routen, Profile und die Klimareihe.
3. `bun run data:check` – prüft Referenzen, Wertebereiche und Vollständigkeit.
