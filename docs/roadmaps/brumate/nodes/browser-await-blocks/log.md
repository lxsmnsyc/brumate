# Log: browser-await-blocks

- 2026-11-02: worktree at origin/feat/browser-async 01017a8e.
- Probe (`probeBlock.brm`, an `#if` body and a `#for` row with `await $memo` in their scripts): both compiled to the bare promise. The markup wrote empty text and filled it later (held writes and updates), and a statement after the `await` that reads `user.name` would throw. Gap confirmed.
- Split: `Emitter.splitBody` sets the scope whose script splits for one render function (client.ts `emitRender`, markup.ts `bodyFunction`) and closes its rests after the return line. Probe passes: nothing shows until the load settles, the statement after the `await` runs once.
- Rows: the range `<!--l<id>:w-->` hid the row from the list (it finds rows by `i` comments or `b-b`). `wait` now uses `<!--i<id>-->`/`<!--/i-->` for a row scope (`'i' in scope`, `setItem` moved before the split) outside its own earlier range. Reversing the list during the wait kept the rows and loaded nothing again. No change to lists.ts, so todos stays the same.
- Starts: `earlyLoads` runs in the browser with the server's rule (`blockingDeclarations(statement, true)` with the server's inline set). The loads of a run of adjacent awaits start before the first one, since the browser has no `waitAll`. `started` and `after` in waits.ts. Probe: loads `[2, 1]` together, `c` after `a`, `d` after `b`.
- A load that reads an awaited memo through a function or a plain memo: `after` passes values as parameters, which a function does not see, so it starts after that memo's `await`.
- Prop change during the first wait (WaitDestr): the rest's second `wait` overwrote the newer load an update had put in the slot with the started one. `wait` now prefers a value in `scope.s[slot]`.
- Found on the base: a text update of a later awaited memo runs during the first wait with a hole in its slot and throws `TypeError` (`brumate:error`). Not fixed here; see outcome.
- Markup `await`: `awaitMarkup` splits at the start of the markup for the memos that the scope's markup sites read with `await`. A memo of the scope is assigned (its statement is `let`), one of an outer scope is a constant pattern in the rest (`const [, x] = $$v`, a pattern so the clone check does not see two declarations of the name).
- A nested render function in the rest threw "This value is still loading" for an outer memo: the rest ran outside `updating`. `settle` now runs it inside `updating`.
- A body with no ID (a constant `#if` in a component) got no split; such a body now creates its scope when it waits.
- Bench (todos): 13,837 B gzip before, 13,829 B after. Click checks FAIL on the base too (known from topological-awaits-server).
- Review round 1: `#key` and `#try` bodies render inline, so their scripts did not split (a `#try` body never filled). They now render through a body function with `branchNodes` when they wait. Tests for them and for a row with a sync first await.
- Merged browser-root-boundary (80a2d66e). `holdRow` threw for a row that waits in its own script (no held scope with the list as parent); fixed by reading the `i` range of the row's output. Adapted four tests to the root boundary's holds.
