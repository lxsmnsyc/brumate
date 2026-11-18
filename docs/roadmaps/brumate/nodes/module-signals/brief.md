---
id: module-signals
title: $signal and $memo at the top level of a module
status: todo
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/module-signals.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent:
owns:
  - packages/brumate/src/module-signals.ts
  - packages/brumate/test/module-signals.test.ts
  - packages/brumate/test/module-signals/
shared:
  - packages/brumate/src/modules.ts
  - packages/brumate/src/shared-module.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/compile.ts
  - packages/brumate/src/vite.ts
  - packages/brumate/src/check-command.ts
  - packages/brumate/src/codegen/client.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/test/error-codes.json
  - website/docs/reactive-modules.md
  - website/docs/state.md
  - docs/decisions.md
  - .changeset/*.md
reserves: [code BRM207, code BRM208]
provides: []
depends_on:
  - on: derived-stores
    kind: hard
    why: a module memo compiles to derived() of brumate/store
---

> 2026-11-18: made a must of 0.9.0 by the maintainer, after mcp-server was deferred (docs/debates/0.9.0-cut/debate.md, amendment 2026-11-18).

# $signal and $memo at the top level of a module

## Goal

`$signal` and `$memo` work at the top level of a `.brm.ts` module and of `<script module>`. They give one shared value per module, which components read like their own signals:

```ts
// cart.brm.ts
import { $memo, $signal } from 'brumate/signals';

export let items = $signal<number[]>([]);
export const total = $memo(items.reduce((sum, price) => sum + price, 0));

export function add(price: number) {
  items = [...items, price];
}
```

```brm
<script>
  import { add, items, total } from './cart.brm.ts';
</script>

<button onClick={() => add(5)}>Add</button>
<p>{items.length} items, {total}</p>
```

Today both forms fail. In `<script module>`, `$signal(0)` stays a call of the runtime stub, which throws `compileTimeOnly('$signal')`, and a write from the component script is `Cannot assign to module "count" [BRM117]`. In a `.brm.ts` module, only exported functions are compiled (copied into each caller, `src/modules.ts:1-15`), so a top-level `$signal` runs as plain code and throws.

## Context

- Asked by the maintainer on 2026-11-18. The design is sugar over the stores of `brumate/store`, so it adds no runtime: `let x = $signal(v)` compiles to `const x = store(v)`, `const y = $memo(expr)` to `derived([sources], ([sources]) => expr)`, and a read in a component compiles like `$store(x)` of an imported store, which already renders, resumes and repairs a changed value once (store-contract, store-any-source, derived-stores outcomes).
- Leak across requests: a module signal is one value for the whole server process, as `export const cart = store([])` already is. The maintainer ruled (2026-11-18) that this is the author's choice and not a blocker, unlike a context default, which the framework holds for the author (decisions.md, context-no-defaults). No per-request scope and no `AsyncLocalStorage` (decisions.md, the `getEvent()` entry). The docs page says this in one line, next to the same line for stores.
- Prior art, read before you change the forms:
  - Svelte 5 allows `$state` at the top level of `.svelte.js`/`.svelte.ts` but refuses to export it when it is reassigned (`state_invalid_export`: "Cannot export state from a module if it is reassigned. Either export a function returning the state value or only mutate the state value's properties") and refuses to export `$derived` (`derived_invalid_export`), because an importer cannot know a name is state. Source: https://github.com/sveltejs/svelte/blob/main/packages/svelte/src/compiler/errors.js (pin the SHA in your log). Brumate's compiler does resolve `.brm.ts` imports (`ResolveModule` in `src/modules.ts`, used by `compile.ts`), so the importer can know, and exporting both is allowed here. Write that difference in decisions.md.
  - Solid's `createSignal` at module level returns a getter and a setter; there is no compiler and no write through an import.
- Writes stay in the module. ESM import bindings are read-only, and TypeScript reports `count++` on an import. So a component writes a module signal only through a function the module exports (`add` above). BRM117 stays for a write through an import, with a message that names the fix (export a function that writes it). In a `.brm` file, the component script may write a signal of its own `<script module>`, since that is one file and one binding for TypeScript; check this in the virtual file of the language server.
- A plain function of the module (`add`) is not copied into callers. It runs as module code, so the transform rewrites its reads to `x.get()` and its writes to `x.set(...)`. `$produce` on a module signal works the same way. The functions that module-functions copy into components (`counter()` in reactive-modules.md) keep that behavior; when one reads a module signal, the copy reads it like an imported store.
- Where the transform runs: the Vite plugin transforms `.brm.ts` files today only under `?brumate-shared` (`src/vite.ts`, near the `nameBridges` step). The plain module now goes through a transform too, which also feeds `brumate check`. `<script module>` already lives in the shared part of the client entry (module-script-shared outcome), so the browser has one instance per page.
- Resume: as for any store from an import, the browser runs its module and starts from the first value. The slot keeps the value the server rendered and is repaired once if the browser value differs. Nothing new crosses the page state.
- Memos: the derived store is lazy without subscribers (`get()` computes from the sources), which matches the server's lazy memos; in the browser it updates once subscribed. A diamond of module memos must compute once per change (derived-stores already tests this for `derived`).
- A plain `.ts` file that imports a module signal gets the store object, while TypeScript says `number`. Make `brumate check` report that import (BRM208). Do not change the types.

## Steps

- [ ] Probe on the 0.x target branch: a `<script module>` with `export const count = store(0)` read with `$store(count)` in two components on one page; one button calls an exported `increment`; both update. This is the runtime the sugar compiles to.
- [ ] Transform for the top level of `.brm.ts` and `<script module>` in `src/module-signals.ts`: `$signal` to `store`, `$memo` to `derived` with the module signals it reads as sources, reads and writes in module code to `get` and `set`.
- [ ] Importer side: the analyzer marks a name imported from a `.brm.ts` module (or declared in `<script module>`) that is a module signal or memo, and compiles reads like `$store` of it (one-way).
- [ ] Errors: BRM207 for `$signal`/`$memo` forms the top level cannot take (`$memo(await …)`, `$effect`, `$client` and the other compile-time functions at the top level of a module), each message naming the fix. BRM208 for a module signal imported into a plain `.ts` file. BRM117's message for a write through an import names the exported-function fix.
- [ ] Docs, decisions.md entry, changeset.

## Acceptance

- [ ] `test/module-signals.test.ts`, with pages in `test/module-signals/`, covers:
  - a `.brm.ts` signal and memo read by two components on one page render on the server, resume, and both update after one exported function writes the signal;
  - the same for `<script module>`, with a write from the component script of that file;
  - a memo over two module signals computes once per change;
  - `$produce` on a module signal;
  - a module function copied into a component reads a module signal and stays live.
- [ ] Resume: a module signal whose browser value differs from the server's shows the browser value after resume, repaired once.
- [ ] Two server renders that each call the write function see the shared value. The test names this as the documented behavior, not a bug.
- [ ] Errors: a write through an import is BRM117 with the new message; BRM207 and BRM208 cases each have a test, an entry in the error catalog and in `test/error-codes.json`; `brumate check` reports BRM208.
- [ ] A page that uses no module signal ships the same client JS (todos, `pnpm bench --only brumate --scenario todos`).
- [ ] Docs: a "Shared state at module level" section in website/docs/reactive-modules.md, with the line on the server leak, and a pointer from website/docs/state.md; samples pass `pnpm --filter website check:samples`. decisions.md has one entry with the difference from Svelte's export rules.
- [ ] A minor changeset for `brumate`.
- [ ] `pnpm --filter brumate exec vitest run test/module-signals.test.ts test/stores`, then `pnpm lint`, `pnpm format:check`, `pnpm typecheck`.

## Sizing

M. The runtime exists. The work is one transform, the importer side in the analyzer, the Vite and check wiring, and the errors. Uncertainty medium: the write rules in the language server's virtual file, and copied module functions that read module signals.

## Notes for the worker

- No per-request scope, no `AsyncLocalStorage`, no new runtime export. If the stores cannot express a case, stop and write it in the log.
- Do not add writes through imports, and do not turn `$effect` at the top level of a module into a feature. Both are out of scope.
