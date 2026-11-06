# Log: context-read-fallback

- 2026-11-06: start on refactor/context-read-fallback (eecf9882). Install and full package build pass.
- Counts before: `$hasContext` 228 in packages/ui/src (426 in the repo), `$getContext` 133 (407), `$store(` 129 (465).
  Reads in ui: 74 guarded `$getContext`, 66 guarded `$store(C)`, 63 `$store(g?.key)`. 86 ui files hold an old form,
  past the 60-file limit, so this node does the core, tests, docs and a probe on two ui readers; the ui rewrite splits.
- Core: `consume(C, scope, ...[fallback, slot])` on both sides (argument count decides), `has`/`hasContext` deleted,
  `consumeStore` takes the fallback as its last argument for `$store($getContext(C, fb))`; the server records the key
  with a provider and the `z` index of the fallback without one. `findStored` takes the value and throws `TypeError`.
- Guard form: `const s = g ? $store(g.key) : undefined` (also `g ? $store(g) : undefined`, the ui's most common case),
  only for `g = $getContext(C, undefined)`. Compiles to `g ? consumeStore(C, …) : undefined`.
- `$store(Ctx)` is BRM199 only when the file names Ctx in `$getContext`/`$setContext`; an imported context is a
  `TypeError` at render, and a type error under brumate-tsc.
- BRM080 (released) message changed to allow the fallback; BRM192 and BRM197 (unreleased) messages rewritten; pins edited.
- Probe in ui: Toolbar (store fallback for the locale, `$getContext(ToolbarContext, false)`) and Label (guard on the
  value), test/read-fallback.test.ts: 3 pass. Stop here: the ui rewrite passes 60 files.
- 2026-11-06 (orchestrator): the ui rewrite stays in this node, not split: the core makes the old ui forms compile errors,
  so the two can only land together. Script rewrite of 86 ui files: 74 guarded `$getContext` to `$getContext(C, undefined)`,
  27 locale readers to `$store($getContext(LocaleContext, store(DEFAULT_LOCALE)))` (keeping `?? DEFAULT_LOCALE` for a
  provided null), 37 guarded `$store(C)` to the guard on the value (`<name>Given`), 63 `$store(g?.key)` to
  `g ? $store(g.key) : undefined`, 1 standalone `$hasContext(ToolbarContext)` to `$getContext(ToolbarContext, false)`.
- Fix: `$route()`/`$navigation()` compile to `consume(C, scope, undefined, slot)`, which the arity rule read as a fallback;
  the runtime now takes a fallback only with exactly one argument after the scope, on both sides.
- Fix: the locale store fallback broke 14 color tests. On resume the browser makes the fallback store again, a new object
  equal to the server's, and the `Object.is` repair rewrote the locale slot, which reset the sliders. The repair now
  compares arrays and plain objects by content (`sameData` in client/context.ts), with a test that fails on `Object.is`.
  This is part 1 of store-repair-compare, done here.
- check.ts: removed `guardedKeys` (typed the old `$hasContext ? $store(g.key)` form with `!`); the new guard narrows itself.
- Counts after, packages/ui/src: `$hasContext` 228 -> 0, `$getContext` 133 -> 228, `$store(` 129 -> 130.
- examples/ui client JS gzip: 202983 -> 202812 B (-171).
- Checks: oxlint, oxfmt --check, typecheck, all 11 package/example test scripts (brumate 2846, ui 777), e2e ui 55/55.
  ui preview.test.ts failed once under the parallel run, passed twice alone.
