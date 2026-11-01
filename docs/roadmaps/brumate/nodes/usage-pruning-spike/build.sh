#!/bin/sh
# Builds packages/brumate and the client of the three benchmark apps and the website, then prints
# their sizes. Hidden source maps add no bytes to the JS; smoke.mjs reads them. Usage: sh build.sh <label>. Run from anywhere.
set -e
root="$(cd "$(dirname "$0")/../../../../.." && pwd)"
(cd "$root/packages/brumate" && npx tsdown >/dev/null 2>&1)
cd "$root/benchmarks/brumate"
npx vite build --outDir dist/client --sourcemap hidden >/dev/null 2>&1
npx vite build --ssr src/server.ts --outDir dist/server >/dev/null 2>&1
node ../harness/dashboard.mjs brumate >/dev/null 2>&1
npx vite build dashboard --outDir dist/client >/dev/null 2>&1
npx vite build rows --outDir dist/client --sourcemap hidden >/dev/null 2>&1
npx vite build rows --ssr src/server.ts --outDir dist/server >/dev/null 2>&1
# The website builds with `features: 'all'`; SKIP_WEBSITE=1 keeps its last build.
if [ -z "$SKIP_WEBSITE" ]; then
  (cd "$root/website" && npx vite build --outDir dist/client >/dev/null 2>&1)
fi
node "$root/docs/roadmaps/brumate/nodes/usage-pruning-spike/size.mjs" "${1:-run}"
