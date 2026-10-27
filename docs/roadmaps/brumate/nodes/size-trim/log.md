# Log: size-trim

- Worktree node-size-trim. Baseline rebuilt at f45a5c74: 14,227 B gzip before load (todos). Main at 7608e6df: 14,836 B (+609). benchmarks needed node_modules copied for benchmarks/brumate and benchmarks/harness.
- handler-merge-trim was todo, so folded in. Merge code costs about 45 B gzip; no trim worth the risk, noted in the outcome.
- Cut 1: updateReady as a recursive Promise.all, no closure: -20 B.
- Cut 2: dirty as Set<Scope>, settle scans the buckets by key: -32 B.
- Cut 3: regex in addEntryHandlers, `custom` in readFields: -3 B.
- Ablations (remove one feature, measure): readFields 254 B, settle 51 B, mergeHandlers about 45 B.
- Rebased on main with #295 and #296: main 14,823, head 14,768 (-55).
- Rows probe, base vs head: no write slower.
