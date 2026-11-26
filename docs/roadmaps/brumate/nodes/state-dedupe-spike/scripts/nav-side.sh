#!/bin/sh
# One run of the navigation benchmark on one build of the website, for perf-pass's bench.py:
# the builds take turns in website/dist, and the one not in use waits in .scratch/dist-<side>.
# Each build has a `.side` file. Run from .scratch/bench-<side>, with PAIR and NETWORK set.
#   sh nav-side.sh [SIDE]   (the side defaults to the name of the folder, bench-<side>)
set -e
side="${1:-$(basename "$PWD" | sed 's/^bench-//')}"
repo="$(cd "$(dirname "$0")/../../../../../.." && pwd)"
current="$(cat "$repo/website/dist/.side")"
if [ "$current" != "$side" ]; then
  mv "$repo/website/dist" "$repo/.scratch/dist-$current"
  mv "$repo/.scratch/dist-$side" "$repo/website/dist"
fi
echo "load $(sysctl -n vm.loadavg)"
node "$repo/benchmarks/navigation/run.mjs" --no-build --runs 10 --pairs "$PAIR" \
  --network "${NETWORK:-slow4g}" --cpu 4 --gzip
