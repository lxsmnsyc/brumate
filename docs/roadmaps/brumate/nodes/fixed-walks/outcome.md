# Outcome: fixed-walks

## Built

Not reproduced. A fixed walk for cloned templates is not faster than the encoded walk by more than the noise. No code outside the node folder changed, and the prototype was reverted. `docs/proposals.md` has the new numbers.

## Proof

- base: 9c2b67f4 (batch plus the brief), encoded walk (`walkOf`/`clone`). `profile-rows.mjs brumate create` and `replace`, interleaved with `bench.py`:
  - create, 40 rounds, 12 runs: median 9.0 ms, min 5.4, mad 2.7; load 13.
  - replace, 40 rounds, 12 runs: median 15.3 ms, min 10.8, mad 4.25; load 13.
- branch: same commands with the fixed walk of the prototype for every template that passed its nesting check:
  - create: median 9.15 ms, min 5.2, mad 3.35: +1.7%, within noise (the limit is 3 times the larger mad, about 10 ms).
  - replace: median 16.0 ms, min 11.3, mad 4.4: +4.6%, within noise.
  - A quieter first run of create (load 4 to 5, 20 rounds, 8 runs): 5.5 against 5.5 ms, mad 0 and 0.1.
- no-client-html size (todos, gzip JS before `load`): base 19643132 35.3 kB raw / 14.6 kB gzip; branch 9c2b67f4 35.4 kB / 14.6 kB. Load average 21 to 22 at both runs; sizes do not depend on load. Dist emitted: 88.1 kB / 31.1 kB on both.

## Deviations

- The rows bench (`pnpm bench --scenario rows`) was not run, only the profile with `bench.py`, because the machine was loaded by other nodes. A rerun on a quiet machine could show a gain of the 0.2 ms size of the minimum; that is 4% of the script of create and about 1% of the click to paint.

## Stubs left

None.

## Gotchas

- Step 1 needed a path finder over the template HTML: the parser changes markup (a `<p>` closed by a `<div>`, a table that adds a `<tbody>`, `<template>`, text next to a table, content in `<svg>`). A fixed walk must refuse those and keep the encoded walk, and must treat the top of a template by its first tag (a `<tr>` at the top sets the table insertion mode of the rest). This is the cost that a later attempt must pay.
- The prototype breaks the `$$e[n]` checks of clone-bodies, codegen and render snapshots.

## Proposed learnings

None.

## Verification

- Prototype only. No checks run on a go path; the node ends on a miss. `git status` clean for `packages/` after the revert.

## Size

- Estimated M, actual S (a no-go after step 1).
- Risk estimated medium, measured low: no code left.
