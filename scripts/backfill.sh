#!/usr/bin/env bash
#
# Drains the whole precomputation backlog in hourly batches.
#
#   ORS_KEY=… scripts/backfill.sh                  # fill every gap
#   ORS_KEY=… scripts/backfill.sh --upgrade-osrm   # additionally re-route the
#                                                  # car-profile routes
#
# Why batches: Open-Meteo bills one elevation profile as ~100 calls against
# 5 000 calls/hour, so a run can place about 45 profiles before the pacer stops
# it (OPEN_METEO_BUDGET, default 4500). build-data.ts is resumable and saves
# after every step, so the backlog simply continues in the next batch. Routing
# is not the constraint – 2 000 ORS requests a day is far more than this needs.
#
# The loop stops by itself once nothing is missing. Ctrl-C is safe at any point;
# everything fetched so far is already on disk.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${ORS_KEY:?ORS_KEY ist nicht gesetzt – ohne Schlüssel routet der Lauf über das OSRM-Autoprofil und der Gate weist die Ergebnisse reihenweise ab}"

BUDGET="${OPEN_METEO_BUDGET:-4500}"
GAP="${BACKFILL_GAP:-3900}"        # 65 min, safely past Open-Meteo's hourly window
MAX="${BACKFILL_MAX_RUNS:-8}"
EXTRA=("$@")

pending() { bun run scripts/build-data.ts --pending; }

echo "Backfill: Budget ${BUDGET} Calls pro Lauf, ${GAP}s Pause, höchstens ${MAX} Läufe"
bun run scripts/build-data.ts --status "${EXTRA[@]}"

for ((run = 1; run <= MAX; run++)); do
  if [ "$(pending)" -eq 0 ]; then
    echo "Nichts mehr offen."
    break
  fi

  echo
  echo "───── Lauf ${run}/${MAX} · $(date +%H:%M) ─────────────────────────────"
  OPEN_METEO_BUDGET="$BUDGET" bun run scripts/build-data.ts "${EXTRA[@]}"

  if [ "$(pending)" -eq 0 ]; then
    echo "Nichts mehr offen."
    break
  fi
  if [ "$run" -eq "$MAX" ]; then
    echo "Grenze von ${MAX} Läufen erreicht, es ist noch etwas offen."
    break
  fi

  echo "Warte ${GAP}s bis $(date -d "+${GAP} seconds" +%H:%M 2>/dev/null || date -v "+${GAP}S" +%H:%M) – Open-Meteo-Stundenfenster"
  sleep "$GAP"
done

echo
echo "───── Prüfung ────────────────────────────────────────────"
bun run scripts/check-data.ts || {
  cat <<'EOF'

Der Gate hat etwas abgewiesen. Die drei Wege daraus:
  1. Koordinaten in data/passes.json korrigieren (Passpunkt oder ascent.from)
     und danach: bun run scripts/build-data.ts --retry-rejected
  2. Wenn die Auffahrt wirklich so ist (Straße endet unterhalb des Gipfels):
     ascent.check mit maxTopDelta/maxKm … und einer note setzen.
  3. Wenn die Grenze selbst falsch ist: LIMITS in scripts/lib/validate.ts
     ändern und mit `bun run data:check --explain` prüfen, was das für alle
     anderen Routen bedeutet – das kostet keine API-Calls.
EOF
  exit 1
}
