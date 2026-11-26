#!/bin/sh
# Step 1 of the brief: the navigation benchmark with Chrome's Fast 4G and Slow 4G profiles and a 4x
# CPU slowdown, three campaigns of each, on the build in this checkout. The server gzips its
# responses, as a host does.
#   sh throttled.sh OUT_DIR LABEL
set -e
out="$1"
label="$2"
repo="$(cd "$(dirname "$0")/../../../../../.." && pwd)"
mkdir -p "$out"
for round in 1 2 3; do
  for network in fast4g slow4g; do
    echo "== $label round $round $network, load $(sysctl -n vm.loadavg)"
    node "$repo/benchmarks/navigation/run.mjs" --no-build --runs 20 \
      --pairs docs-server,ui-server,docs-static,ui-static \
      --network "$network" --cpu 4 --gzip --label "$label" \
      --json "$out/$label-$network-$round.json"
  done
done
echo "== done, load $(sysctl -n vm.loadavg)"
