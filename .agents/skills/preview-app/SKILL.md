---
name: preview-app
description: "Build, run and screenshot this app headlessly (desktop, mobile, dark mode, selected pass or tour via hash) to verify a UI change or to show the user what a state looks like. Use when a change touches components/, app/ or globals.css, when the user asks for screenshots, or before opening a PR with visible changes."
---

The app is a map; a diff does not show whether panels overlap or colours
work in dark mode. Render it.

## 1. Run the production build

```bash
bun run build && (PORT=3000 bun run start > /tmp/alpen-start.log 2>&1 &)
sleep 3 && curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
```

`bun dev` works too but is slower to settle; production is what the user
sees. Stop the server at the end (`pkill -f "[n]ext-server"`; the bracket
keeps `pkill` from matching your own shell).

## 2. Screenshot with Playwright

The script `screenshot.mjs` next to this file takes a base URL and a list of
states and writes PNGs. It needs the `playwright` package and a Chromium:

```bash
npm i --prefix /tmp/pw playwright@latest      # once per machine
PLAYWRIGHT_PKG=/tmp/pw/node_modules/playwright/index.mjs \
EXE=/opt/pw-browsers/chromium \                # only where a Chromium is preinstalled; omit otherwise
node .agents/skills/preview-app/screenshot.mjs http://127.0.0.1:3000 out/
```

States captured by default: overview light, overview dark, `#tour=sellaronda`,
`#pass=col-du-galibier&t=10`, mobile 390×844 peek, mobile with a pass. Add
your own with `--state name=hash[,mobile][,dark]`.

If the sandbox cannot reach tile servers, pass `--offline`: external
requests are aborted so MapLibre reaches `load` and draws the vector layers on
a blank background. Say so in the PR when you post such screenshots.

## 3. Look for

- Panels: sidebar, detail slide-over and the period control must not overlap
  the map controls; on mobile the sheet's peek row must not cover MapLibre's
  attribution and zoom buttons.
- Status colours: three hues plus the hollow circle for "oft gesperrt"; check
  in dark mode that halos and labels stay legible.
- Selected state: the row is highlighted and scrolled into view, the map has
  flown to the entity with the panel padding respected.
- Text: German, `de-DE` number formatting (2.642 m, 24,3 km), no overflow in
  the 352 px detail panel.
- Console: no errors except failed tile requests in offline mode.

## 4. Deliver

Attach the PNGs to the PR or send them to the user, with one line each on
what the screenshot proves. Delete `out/` afterwards; do not commit
screenshots.
