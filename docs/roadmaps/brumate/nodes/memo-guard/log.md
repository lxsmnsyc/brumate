# Log: memo-guard

- The work did not exist (no `$gate` in the source or tests on origin/next, e312727d).
- The brief is from 2026-10-27. Since then: render-memos (0.6.1) makes a browser-rendered component run each `$memo` once, through `renderMemo`, and a throwing memo holds its error until read; context-stores added `$store`. The node memo-errors-at-read has no folder; rule 5 follows the decision in docs/decisions.md ("A memo whose compute throws ... holds the error as its value, and each read of it throws"), which the code does in `hold()` (`MemoError`).
- Design: the memo site stays the value (argument 1), so `$memo` paths (graph, server, render, unread-memo drop) apply unchanged. The guard is a second site of kind `function` on `declaration.gate`, which has no graph node. The guard is therefore not tracked, which matches rule 2 (it runs only on changes). Server and render output drop the guard, since both take the first value and never guard.
- The update code is `$$b.gate($$s, slot, guard, () => value)`. `gate` calls `memo` with a compute that gives back the old value when the guard says no, so the existing `Object.is` check skips the write and the readers. That keeps `memo` unchanged and plain memos pay nothing.
- "First value": the compute passes without the guard when the slot has no value (`!(slot in scope.s)`, which is the case of a memo the server did not compute) or holds a `MemoError` (a memo that threw then recovers with the new value).
- Rule 4: BRM203 when the value awaits or calls a server function, found where the analyzer already turns a memo into an `async-memo`. `await $gate(…)` was already an error ("await works with $memo"). A local `async` function call is not detected, as for any memo that is not a server call.
- BRM202 for any form other than a value and a function.
- Probe: a guard that calls a local function and reads a signal in a component rendered by the browser works (test `gateReads`).
