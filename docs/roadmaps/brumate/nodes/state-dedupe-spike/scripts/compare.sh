#!/bin/sh
# Step 3 of the brief: the throttled navigation of step 1 on the base build and the prototype,
# the two taking turns, through perf-pass's bench.py, which reports the noise. The swap median of
# each run of 10 navigations is one sample.
#   sh compare.sh BENCH_PY
set -e
bench="$1"
repo="$(cd "$(dirname "$0")/../../../../../.." && pwd)"
script="$repo/docs/roadmaps/brumate/nodes/state-dedupe-spike/scripts/nav-side.sh"
metric='\| full +\|(?:[^|]*\|){4} *([\d.]+)'
for combo in slow4g:docs-server slow4g:ui-server fast4g:docs-server fast4g:ui-server slow4g:docs-static slow4g:ui-static; do
  network="${combo%%:*}"
  pair="${combo#*:}"
  echo "== $pair $network, load $(sysctl -n vm.loadavg)"
  NETWORK="$network" PAIR="$pair" python3 "$bench" \
    --dir "base=$repo/.scratch/bench-base" --dir "proto=$repo/.scratch/bench-proto" \
    --runs 5 --warmup 1 --timeout 900 --metric "$metric" -- sh "$script"
done
echo "== done, load $(sysctl -n vm.loadavg)"
