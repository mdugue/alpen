# Übergabe: vom HTML-Prototyp zur App

## Was übernommen wurde

| Prototyp | Jetzt |
| --- | --- |
| Ein 1,2-MB-HTML mit inline MapLibre | Next.js 16 (App Router, Turbopack), React 19, Tailwind 4 |
| Datenobjekte im `<script>`-Block | `data/*.json`, typisiert über `lib/types.ts`, validierbar |
| Routen/Profile/Klima zur Laufzeit im localStorage | vorberechnet in `data/generated/`, im Repo |
| Wetter direkt vom Client zu Open-Meteo | eigene Route mit serverseitigem Cache |
| Handgeschriebenes CSS | shadcn/ui-Tokens (Style „mira"), Dark Mode über `next-themes` |
| Zustand in globalen Variablen | `components/explorer.tsx` + `lib/app-state.ts`, Hash-Sync |
| Keys im localStorage | `ORS_KEY` als Build-Secret, Kartenschlüssel als `NEXT_PUBLIC_*` |

Funktional gleich geblieben: Filter, Zeitraumwahl, Status-Heuristik, 3D,
Höhenprofile, Klimadiagramm, Merkungen, Umkreissuche (60 km), teilbare URLs.

## Was noch offen ist

1. **shadcn-Komponenten sind Platzhalter.** `components/ui/*` sind schlanke
   Nachbauten mit derselben API, weil die Sandbox keinen Zugriff auf
   `ui.shadcn.com` hatte. Erster Schritt im Projekt:

   ```bash
   bunx shadcn@latest init --preset b1D2ui9g
   bunx shadcn@latest add button badge card checkbox dialog input native-select slider table toggle-group tooltip
   ```

   `init` überschreibt `app/globals.css` mit den offiziellen Mira-Tokens. Danach
   die Domänen-Tokens wieder anhängen (`--status-open`, `--status-risky`,
   `--status-closed`, `--tour`, `--town` samt `@theme inline`-Zeilen) – sie sind
   im aktuellen `globals.css` markiert.

2. **`data/generated/` ist leer.** Einmal `bun run data:build` laufen lassen,
   idealerweise mit `ORS_KEY`, und das Ergebnis committen.

3. **Design.** Kopfzeile, Werkzeugleiste, Tabelle und Panel sind bewusst
   zurückhaltend gehalten, damit die Mira-Komponenten sie prägen können. Wenn
   das Ergebnis nach dem `init` noch nicht sitzt, ist der schnellste Hebel:
   `--radius`, die Kopfzeilenfarbe (`bg-primary`) und die Dichte der Tabelle.

## Empfehlung zum ORS-Key

Build-Zeit, als Secret. In der App gibt es kein Eingabefeld mehr: das Routing
passiert im Skript, nicht im Browser. Lokal in `.env.local`, in GitHub Actions
als `secrets.ORS_KEY` (siehe `refresh-data.yml`), auf Vercel gar nicht nötig,
solange die vorberechneten Dateien im Repo liegen. Den Key nicht in einen Chat
oder ins Repo schreiben.

## Was GitHub + Vercel zusätzlich bringen

- **Preview-Deployments je PR.** Jede Datenänderung ist vor dem Merge als
  fertige Karte anschaubar – bei einer Datenapp der größte Einzelgewinn.
- **Vollständiges Prerendering am Edge.** Die Startseite wird beim Build
  erzeugt (`○ (Static)` im Buildlog) und weltweit ausgeliefert; die 1,2-MB-Datei
  von früher entfällt, MapLibre kommt als eigener Chunk.
- **Serverseitiger Wetter-Cache.** Eine Abfrage pro Pass und halber Stunde statt
  einer pro Besucher.
- **Cron-Jobs.** `refresh-data.yml` zieht neue Daten monatlich nach; für den
  Live-Sperrstatus (Roadmap 1) ist eine Vercel-Cron-Function plus
  `revalidateTag` der richtige Ort.
- **Bilder, Fonts, Analytics** kommen mit: `next/font` liefert Inter und Oxanium
  selbst gehostet aus, `@vercel/analytics` und Speed Insights sind ein
  Einzeiler.
- **Rollback per Klick** und unveränderliche Deployments je Commit.
