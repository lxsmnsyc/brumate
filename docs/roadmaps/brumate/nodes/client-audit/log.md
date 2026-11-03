# Log: client-audit

2026-11-03, worktree .claude/worktrees/client-audit, branch spike/client-audit from origin/next e3f8cfad. Probes in packages/brumate/test/audit/ (commits 2ef4e2fc, 77ed7033, ad0ebb61, pushed, no PR).

- `pnpm install --frozen-lockfile && pnpm --filter brumate build`. Added `@vitest/coverage-v8@5.0.5` (matches vitest 5.0.5) to packages/brumate devDependencies on the spike branch only, for the coverage run.
- Coverage: `npx vitest run --coverage.enabled --coverage.provider=v8 --coverage.include='src/runtime/client/**' --coverage.include='src/runtime/client.ts' --coverage.include='src/runtime/loader.ts' --coverage.reporter=json --coverage.reporter=text --hookTimeout 300000 --testTimeout 60000` in packages/brumate. 77 files, 2771 passed, 1 skipped, 76 s, load average about 4. Per-line list made with a scratchpad script over coverage-final.json (uncovered statements and branch arms by line).
- Export classes: `node test/audit/exports.mjs --list` (test/render, 599 of 601 compile) and `--apps` (packages/ui, website, examples, 612 of 618). Same method as values-spike's browser-only-exports.mjs, plus the resume/update-only and no-caller groups.
- Flags per app: `node --experimental-strip-types test/audit/features.mjs`. todos, rows: no flag on. website: 12 flags on, ui: 8.
- Bytes per module of the todos core: `npx tsdown --sourcemap` in packages/brumate, `npx vite build --outDir <dir> --sourcemap` in benchmarks/brumate, then `node test/audit/attribute.mjs <dir>/assets/client-jFsFMcx5-*.js --functions` (traces through the dist maps). Minified bytes, not gzip.
- Quick size: `sh test/audit/todos-size.sh <dir>`: gzip -9 of every todos chunk but rpc, defer and bundles. Base 14,000 and 13,994 B (two runs; about 6 B of noise). Not the bench figure.
  - Stub S1, `refresh(live, true)` deleted from insertHTML: 13,972 B (-25 B).
  - Stub S2, parseHTML returns an empty fragment, findForeign returns undefined, `fromServer` false (bound for "no HTML string parse at all"): 13,831 B (-169 B).
- No `pnpm bench` run: the quick script answers the deltas, and both are far under the 0.3 kB bench resolution.
- Divergence diffs: `AUDIT=1 npx vitest run test/audit/divergences.test.ts -t ' (<pages>)$' --hookTimeout 300000` treats each DIVERGENCES page as a page that must match, so vitest prints the diff.
- Probes, each reverted with `git checkout src` after:
  - render.ts `componentNames` visits the templates of every body: tryTemplateChild matches.
  - markup.ts client `#try` keeps `$$b.afterInsert.length` and restores it in the catch: tryRollback keeps only the `<title>` difference.
  - insert.ts without `refresh(live, true)`: timing and fnReadUntrack match; 6 tests fail (gatherList, promiseParent, 4 resume tests of async memos that a browser render starts).
  - handlers.ts `handlerProp`: after the scope has slots and with no loaded export, go through `call()`: the 5 ref-setter-relay pages match; fnReadSync, valueFilter, fnReadArrow newly differ (a sync function prop now gives a promise). So the fix must touch setters only.
  - updates.ts `unreadMemo` as a no-op: memoErrorAwaitServer still differs; the report comes from `failOnce` in waits.ts.
- Flags-off tests (feature-flags-off.test.ts) cover 5 flags (tries, fields, windows, dynamic, routes). The off paths of rootWait, clientHTML, loading, lateMarkup, children, templates, bindings run only in e2e and app builds.
