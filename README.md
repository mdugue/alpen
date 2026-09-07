# Alpenpässe – Rennradkarte

Grobe Orientierung für Rennradrouten in den Alpen: 92 Pässe mit Auffahrten und
Höhenprofilen, 9 Rundtouren, 26 Rad-Orte – jeweils mit einer Einschätzung der
Befahrbarkeit für einen frei wählbaren Halbmonat, Wettervorhersage und
Klimareihe auf Passhöhe, in 2D und 3D.

## Schnellstart

```bash
bun install
bun run data:build        # einmalig: Routen, Höhenprofile, Klima vorberechnen
bun dev
```

Ohne `data:build` startet die App, es fehlen dann nur die eingezeichneten
Straßen, die Profile und die Klimareihen.

## Kommandos

| Befehl | Zweck |
| --- | --- |
| `bun dev` | Entwicklungsserver |
| `bun run build` / `bun start` | Produktionsbuild und -server |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint (inkl. React-Compiler-Regeln) |
| `bun run data:build` | Routen, Höhenprofile, Klima holen → `data/generated/` |
| `bun run data:check` | Referenzen und Vollständigkeit der Daten prüfen |

## Architektur in drei Sätzen

Alle inhaltlichen Daten liegen als JSON im Repo (`data/`), werden zur Build-Zeit
importiert und über `"use cache"` in `lib/data.ts` als gecachte Segmente
geführt – die Startseite ist damit vollständig vorgerendert. Die einzige
dynamische Quelle ist die Wettervorhersage; sie läuft über
`app/api/weather/[slug]/route.ts` mit eigener Cache-Lebensdauer, damit
Open-Meteo einmal pro Pass und halber Stunde abgefragt wird statt einmal pro
Besucher. Der gesamte Interaktionszustand steckt in einer Client-Komponente
(`components/explorer.tsx`) und spiegelt sich in den URL-Hash, sodass jede
Ansicht teilbar ist.

```
app/            Layout, Startseite, Wetter-Route
components/     explorer (Zustand) · map (MapLibre) · panel (Detail) · ui (shadcn)
data/           passes.json, tours.json, towns.json  ← Quelldaten, von Hand pflegbar
data/generated/ routes.json, profiles.json, climate.json  ← aus data:build, im Repo
lib/            Typen, Datenzugriff, Statusheuristik, Zustands-Hooks
scripts/        build-data.ts (Vorberechnung), check-data.ts (Validierung)
docs/           Skalen, Datenmodell, Roadmap
```

Mehr dazu in [`AGENTS.md`](./AGENTS.md) und [`docs/`](./docs).

## Umgebungsvariablen

Siehe `.env.example`. Keine davon ist zum Starten nötig.

- `ORS_KEY` – nur für `data:build`. Ohne den Key routet das Skript über den
  öffentlichen OSRM-Demoserver mit **Autoprofil**; mit Key über das
  OpenRouteService-**Rennradprofil**, das Tremola-Pflaster, Schotter am
  Finestre und autofreie Straßen richtig behandelt. Kostenlos, 2 000
  Routen/Tag: <https://openrouteservice.org/dev>
- `NEXT_PUBLIC_THUNDERFOREST_KEY`, `NEXT_PUBLIC_MAPTILER_KEY` – optionale
  Outdoor-Grundkarten. Ohne Key stehen OSM, OpenTopoMap, CyclOSM, Esri Topo und
  Satellit zur Verfügung.

## Deployment (Vercel)

Repo auf GitHub, in Vercel importieren, fertig – kein `vercel.json` nötig. Die
Startseite wird beim Build vorgerendert und liegt danach am CDN-Rand; nur die
Wetter-Route läuft als Function.

## Herkunft

Entstanden aus einem einzelnen HTML-Prototypen; die Daten und die
Statusheuristik sind daraus übernommen. Der Prototyp liegt zur Referenz unter
`docs/prototype.html`.
