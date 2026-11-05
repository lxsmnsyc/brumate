# Log: store-any-source

## 2026-11-05

- Base e87e290e (feat/context-stores). Sizes before, gzip -9 summed over dist/client JS:
  todos (benchmarks/brumate) 80,085 B raw, 28,423 B gzip; ui example 677,928 B raw, 203,374 B gzip.
- Plan: two kinds of source. A context or a key of a `$getContext` value keeps the key read
  (`[key, slot, path?, 1?]`). Anything else is an expression: the update part exports
  `z = [($$s) => <source>, ...]`, and the page state names its index. Imports become
  expressions too, so the key form needs no `z` import now that contexts have no defaults.
- Built: `resolveStores` keeps the key form for a `$getContext` value (`g.key`, `g?.key`, `g`);
  every other source gets `store.link`, its index in `model.storeSources` (the sites of the
  arguments). `plan.ts` adds those sites to `clientSites`, so their reads get slots. The update
  part exports `z = [($$s) => (<rewritten source>), …]` and exists whenever `z` is not empty.
- The key form no longer puts the context's import in `z` (contexts have no default now).
- `findStored` returns `undefined` for `undefined`/`null` (throws under `let`); the server
  records nothing for it, the browser render subscribes nothing.
- Resume: the reads of a scope with a numeric source run in one pass after `loadModule`, so two
  repaired slots of one scope update a binding once (first try ran a pass per read: the test of
  `ran('module', …)` saw four runs instead of two).
- `$store(g?.state)` with a guarded `g` takes the guard of `g` (same codegen as the explicit
  guard). Under `let`, or without `?.`, it stays BRM197.
- BRM194 now: a source that awaits or calls a server function.
- Found, not fixed: the render module (`codegen/render.ts`, `clientModuleScript`) copies
  `<script module>` instead of importing the shared part, so a component that the browser renders
  has its own module state, apart from resumed instances. A store of `<script module>` is then two
  stores in the browser. A core bug of main, not of stores; the test notes it.
- The pin test refuses a changed message for a code, and every compiler message needs a catalog
  entry. BRM194 is retired (still pinned); the await/server check is BRM198, not reserved by the
  brief. BRM192 keeps its message.
- Sizes after: todos 80,086 B raw, 28,415 B gzip; ui example 677,604 B raw, 203,043 B gzip.
- Checks: brumate 2840 tests, tsc 3, ui 774 (+1 expected fail), e2e ui, todos, tracker, nitro, kit
  pass. browser-async e2e not run: its example has no node_modules here.
