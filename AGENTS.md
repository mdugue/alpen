# Hinweise für Coding-Agenten

Diese Datei ist der Einstiegspunkt für Claude Code und andere Agenten.
`CLAUDE.md` ist ein Symlink hierauf.

## Womit du es zu tun hast

Eine Karten-App für Rennradfahrer: Alpenpässe, ihre Auffahrten, Rundtouren und
Rad-Orte, bewertet nach Befahrbarkeit in einem gewählten Halbmonat. Zielnutzung
ist die grobe Routenplanung, nicht die Navigation.

## Grundsätze

1. **Statisch bleiben.** Inhaltsdaten kommen aus `data/*.json` und
   `data/generated/*.json` und werden zur Build-Zeit importiert. Neue Daten
   werden im Zweifel *vorberechnet* (`scripts/build-data.ts`) statt zur Laufzeit
   geholt. Laufzeit-Fetches brauchen einen guten Grund und gehören hinter eine
   Route mit `"use cache"` + `cacheLife`.
2. **Deutsch in der Oberfläche**, deutsche Kommentare, englische Bezeichner im
   Code. Zahlen mit `toLocaleString("de-DE")`.
3. **Ehrlich bleiben.** Die 1–5-Skalen sind redaktionelle Einschätzungen, die
   Statusangabe ist eine Heuristik. Beides ist im Skalen-Dialog so benannt und
   darf nicht als Messwert dargestellt werden.
4. **Keine stillen Datenänderungen.** Wer `data/*.json` anfasst, lässt
   `bun run data:check` laufen.

## Wo was liegt

| Thema | Datei |
| --- | --- |
| Befahrbarkeits-Heuristik | `lib/status.ts` (`passStatus`, `tourStatus`) |
| Datentypen | `lib/types.ts` |
| Datenzugriff (gecacht) | `lib/data.ts` |
| Filter-, Auswahl- und URL-Zustand | `lib/app-state.ts`, `components/explorer.tsx` |
| Karte, Ebenen, 3D, Marker, Beschriftung | `components/map/pass-map.tsx` |
| Detailpanel inkl. Profil/Wetter/Klima | `components/panel/` |
| Tabelle über alle drei Objektarten | `components/entity-table.tsx` |
| Vorberechnung | `scripts/build-data.ts` |

## Konventionen

- **shadcn/ui, Style „mira".** Die Komponenten in `components/ui/` sind
  handgeschriebene Platzhalter mit derselben API. Sobald du Netzzugang hast,
  ersetze sie durch die echten:
  `bunx shadcn@latest init --preset b1D2ui9g` und danach
  `bunx shadcn@latest add button badge card checkbox dialog input native-select slider table toggle-group tooltip`.
  Das überschreibt `app/globals.css` mit den offiziellen Tokens des Presets –
  die zusätzlichen Domänen-Tokens (`--status-open`, `--status-risky`,
  `--status-closed`, `--tour`, `--town`) müssen danach wieder ergänzt werden.
- **Farben nur über Tokens.** MapLibre kann keine CSS-Variablen; `pass-map.tsx`
  liest sie einmal per `getComputedStyle` aus (`readColors`). Neue Kartenfarben
  dort ergänzen, nicht hart kodieren.
- **React Compiler ist aktiv.** Kein manuelles `useMemo`/`useCallback` zur
  Optimierung nötig; die ESLint-Regeln `react-hooks/*` sind Fehler, keine
  Warnungen. `setState` im Effekt wird nur an einer dokumentierten Stelle
  gebraucht (Hash-Initialisierung in `explorer.tsx`).
- **Cache Components.** `"use cache"` steht auf den Datenfunktionen und auf
  `app/page.tsx`. Wer `cookies()`, `headers()` oder `searchParams` einführt,
  bricht das Prerendering – dann lieber eine eigene, dynamische Teilkomponente
  in `<Suspense>`.

## Bevor du einen PR aufmachst

```bash
bun run typecheck && bun run lint && bun run build && bun run data:check
```

## Nächste Aufgaben

Siehe `docs/roadmap.md`. Die größte offene Sache ist der amtliche
Live-Sperrstatus; die Heuristik in `lib/status.ts` ist dafür als
austauschbare Schicht angelegt.
