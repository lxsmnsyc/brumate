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
