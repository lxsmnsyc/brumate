#!/bin/sh
# client-audit: quick todos size. Builds brumate and the todos bench client, then prints the gzip
# bytes of every JS chunk but rpc, defer and bundles (the chunks that load before `load`, as
# values-spike's quick script counted them). Not the bench figure; compare deltas only.
# Usage: sh test/audit/todos-size.sh <out-dir>
set -e
here=$(cd "$(dirname "$0")/../.." && pwd)
out=${1:?out dir}
(cd "$here" && npx tsdown >/dev/null 2>&1)
(cd "$here/../../benchmarks/brumate" && rm -rf "$out" && npx vite build --outDir "$out" >/dev/null 2>&1)
total=0
for file in "$out"/assets/*.js; do
  case "$(basename "$file")" in rpc-*|defer-*|bundles-*) continue ;; esac
  size=$(gzip -9 -c "$file" | wc -c | tr -d ' ')
  total=$((total + size))
done
echo "$total"
