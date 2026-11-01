# Log: browser-await

## 2026-11-01

- Checked: no `wait` in `src/runtime/client/` and `generateRender` still compiles `await $memo(x)` to `(x)`. The work does not exist yet.
- Baseline on `16a2d249` (feat/browser-async): `pnpm bench --only brumate --scenario todos --metrics browser`, JS before `load` raw 35,467 B, gzip 14,822 B.
- Plan: the compiler opens `return $$b.wait($$s1, [prefix slots, the load], slot, ([names]) => {` at the awaited declaration and closes it after the return. The rest takes the slots back as parameters, so props that change during the wait reach it.
- Range comments: `<!--l<scope id>:w-->` and `<!--/w-->`. They match `MARKER`. Client scope IDs are negative, so `/^l\d/` of the server `SWAP` script, `/^l[\d.-]+$/` of devtools and `/^l([\d.]+)$/` of navigate do not match them. `destroyRange` reads the scope ID before the `:`.
- Built `wait(id, slots, slot, rest)`, `bound` and `give` in `waits.ts`, and the split in `Emitter.splitAtAwait`. 8 tests in resume.test.ts pass; the whole package passes (1314).
- `memo` keeps a settled value for a key in `renderedLoads`. Without it, 3 of the 8 tests load twice.
- Size: `resolve` for the second wait pulled +200 B gzip. A waiter in `waiters` does the same: `wait` is +388 B gzip on the spike's esbuild entry.
- The bench lock was held by the other worker for a while after the build; waited for it with one monitor.
- After bench: raw 35,467 B, gzip 14,820 B (before 35,467 / 14,822).

## 2026-11-02, review of #413

- Turned the four probes into tests and added three contract tests; all seven fail on 161b1fdc (the open, close, open probe passes on both and stays as a regression test).
- Reworked `wait` around a check in `waiters` set at the start, so the latest load wins and a removed scope counts down. Added `Boundary.f`, `join` (also through held scopes), `leave`, `fault`, `fillRange`. `wait` runs `setSlots` on the slots before the `await`.
- Codegen: the awaited name is a `let` before the split; variable declarations before the last `await` become `let`, and the rest assigns them from `$$v`.
- The rejected static async memo (no slot) is unhandled without `await` too: a bug of main, reported, not fixed here.
- Todos raw 35,467 B, gzip 14,823 B. `wait` is +520 B gzip on the spike's entry.

## 2026-11-02, re-review of #413

- Promise props: `wait` keeps `scope.props` across its `setSlots`.
- Updates in a held, detached body: `give` replays all updates of the body's scopes when the write count changed during the hold. Dropped the `held` map and `join(scope)`.
- Nested `bound` splices from the lengths at entry.
- `until` holds the check that ends a wait when its scope goes.
- Found while turning the destructuring probe into a test: with two awaits, the first slot's `renderedLoads` key stayed, since the nested wait took the scope out of the insert, so a later prop change did not load the first memo again. Settled slots now wait for the insert that shows the scope.
- TDZ: documented, not matched (a sentinel costs a read check).

## 2026-11-02, third review of #413

- `setSlots` keeps the `renderedLoads` key when a render's promise settles first (the delete came with bdc5c20a, streamed-memo-reads; its tests pass without it). Fixes the second load of a side memo.
- `Boundary.o`: `give` moves a nested body's work into a held outer body.
- Todos raw 35,452 B, gzip 14,821 B. `wait` +555 B gzip. 1329 tests pass.
