# Log: state-printed-html

- 2026-11-27: worktree on `feat/state-printed-html` from origin/release/0.10 (6fa90cdc). Not fulfilled before: release/0.10 has no `$b.d`.
- Cherry-picked ff2e8618 and d76ef9ef of `experiment/state-dedupe-spike`. One conflict in `codegen/markup.ts` (the new `emitWindowNodes` and `emitTryNodes` above `printable`), kept both. e01a1fc0 (case B measurement) left out: no product code.
- Fix 1: `printable()` became `place()`, which gives code for the place: `1`, `0`, `$$place && 1` (in an element of the component), or `$$place` (at its top level). Components take `$$place` as a third argument, children bodies as a third argument of their render, and `#head`, portal and template bodies get `0`. `render()` starts at 2 (the top of the page). Route views pass the place of the layout's insert (`route-render.ts`, a deviation). Children whose HTML the state holds (no browser export) render with 0, so that HTML carries no markers.
- Fix 2: navigation reads the ranges of the fetched page (`readPrinted(next.body)`) before `replaceRoutes`, with a fresh `$bP`. Checked: the test throws `The page has no printed HTML h4w3.0` without it.
- Fix 3: `balanced()` refuses `<pre>`, `<textarea>`, `<listing>` with a first newline, and `shadowrootmode`.
- Fix 4: after the page record, `render()` strips the markers of tokens that the record did not write. `READ_PRINTED` goes only in a record with `$b.d(`.
- Fix 5: `features.printed` (set by the emit in `plan.printed`, a deviation in `plan.ts`) prunes `stateValues.d`, `printedHTML` and the navigation reader. The fallback walk of `html.ts` is gone. The todos app has no marked insert.
- Fix 6: the token prefix is an FNV-1a of the route and the base. In dev the record writes `$b.d(token, component)` and the browser names the component. Readers stop at the next start marker, so a start without an end cannot swallow the next range.
- First run of `test/state-dedupe.test.ts`: 13 pass.
- Full brumate suite under load: 32 timeouts. Failed files rerun alone pass. Render snapshots updated (5).
- Bytes, base 6fa90cdc vs branch: `/docs/context/` gzip -20.3%, `/ui/dialog/` -17.2%, `/` 0 markers.
- todos: first branch run +6 B gzip from `d: unused` in `stateValues`. Moved `d` to a conditional assignment. Second run: raw equal (36 222 B), gzip +2 B from chunk hashes.
- `navigation/run.mjs --check`: 4 ok. `e2e/run.mjs`: exit 0.
