# Log: inline-memo-errors

- Base 64f67bc0 (batch/brumate-main). Test: `pnpm --filter brumate exec vitest run test/resume.test.ts -t "cannot hold a value"` (fixtures test/render/bigMemoTry.brm, BigMemoKid.brm).
- Browser render on the base: fails (timeout, the `#catch` shows "Cannot mix BigInt and other types" and the child never renders). With the fix to codegen/patch.ts only, the browser test passes.
- Server on the base: the server test fails too. `plainValues` (codegen/scopes.ts) inlines `$memo(big + 1)` as a plain value, so the server throws at the declaration. Fixed with the same `cannotThrow` rule.
- Fix: `cannotThrow` copied from bfd1e98a (release/0.8) into codegen/primitive.ts. patch.ts holds a memo through `renderMemo` unless `isPlainMemo` (no await, never a promise, `cannotThrow` with names that read a memo counted as throwing). scopes.ts `plainValues` also requires `cannotThrow`.
- Cost: memos like `count * 2` are no longer plain. The browser render wraps them in `renderMemo`/`readMemo`, and the server computes them as lazy memos. On 0.8, render-memo-reads gives `memoNow` back where the render always reads the memo.
- Client gzip, `pnpm bench --only brumate --scenario todos`, brumate dist rebuilt each time: base 64f67bc0 "Client JS emitted in dist" 78.6 kB / 27.7 kB, "Total JS after counter, toggle, add" 33.0 kB / 13.8 kB. Fix: the same, 78.6 kB / 27.7 kB and 33.0 kB / 13.8 kB. The todos example has no memo with a conversion. SSR renders/s are within noise (3 todos 84,392 base, 88,527 fix).
- Snapshots updated: render/counter, memos, uses-counter. Codegen tests that used `id * 2`, `count * 3`, `count + 1` as an example of a plain memo now use `===`.
