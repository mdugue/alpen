#!/usr/bin/env bash
# SessionStart hook for Claude Code on the web.
#
# Two things have to be true before an agent can run this repo's checks, and
# neither is true in a fresh container:
#
#   1. Bun matches `engines.bun` in package.json. The image ships whatever Bun
#      was current when it was built, and that has been behind. On 1.3.11,
#      measured in a web session: `bun run build` dies in Next's TypeScript
#      step ("Could not parse output from TypeScript's --showConfig"), the e2e
#      harness (`test/browser.ts`) and the `preview-app` skill cannot start at
#      all because they drive Chrome through `Bun.WebView`, which exists from
#      1.4, and the first `bun install` silently rewrites `bun.lock` to the
#      older lockfile format. On 1.4.2 all three are fine.
#   2. node_modules exists. Bun can auto-install into its global cache, so
#      `bun run data:check` works without it and `tsc` does not, which reads as
#      "TypeScript is broken" rather than "nothing is installed".
#
# Idempotent and quiet: on a container that is already right it does nothing.
set -euo pipefail

# Local machines manage their own toolchain; this is about the web container.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# The floor is whatever package.json already promises – one source of truth.
want=$(sed -n 's/.*"bun"[[:space:]]*:[[:space:]]*">=\([0-9.]*\)".*/\1/p' package.json | head -1)
have=$(bun --version 2>/dev/null || echo 0)

# sort -V puts the lower version first; `have` is new enough when `want` leads.
if [ -n "$want" ] && [ "$(printf '%s\n%s\n' "$want" "$have" | sort -V | head -1)" != "$want" ]; then
  echo "Bun $have is older than the required $want – installing the current release."
  # The official installer writes to $BUN_INSTALL/bin (default ~/.bun/bin),
  # which is where the image's Bun already sits, so PATH stays as it is.
  curl -fsSL https://bun.sh/install | bash
  hash -r
  echo "Bun is now $(bun --version)."
fi

# --frozen-lockfile so a session start can never rewrite a committed lockfile;
# if it is genuinely out of sync, say so and install anyway rather than leaving
# the session without dependencies.
bun install --frozen-lockfile ||
  { echo "bun.lock is out of sync with package.json – installing without it."; bun install; }
