---
id: store-contract
title: The store contract and $store
status: done
priority: must
type: feature
story: context-stores
outline: false
milestone: 0.7.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
spent: 618577
owns: []
shared:
  - packages/brumate/src/**
  - packages/brumate/test/**
  - .changeset/*.md
  - website/docs/context.md
  - website/docs/state.md
  - docs/decisions.md

reserves: [code BRM191, code BRM192, code BRM193, code BRM194, code BRM195]
provides: []
depends_on:
  - on: context-stores-spike
    kind: hard
    why: the spike fixes the API, the compile shape and the resume plugin
---

# The store contract and $store

## Goal

Step 2 of the approved context-stores debate (docs/debates/context-stores/debate.md): ship `brumate/store` (`Store` with `get`, `subscribe`, `set`, and a `store()` helper), `$store(ctx)` to read a store held in a context, `$toStore(memoOrSignal)` to build a provider's store, and the seroval plugin, with the API and compile shape from context-stores-spike's outcome. One store per provider. A foreign store inside a context is refused on the server with an error that names the context. The live-context path still works; nothing in packages/ui changes yet.

## Decisions after the spike

The maintainer approved the spike on 2026-11-05 (PR #463, outcome in nodes/context-stores-spike/outcome.md, read it from `feat/context-stores`):

- Go. Size is not a gate for this story: the store way costs about 590 B gzip of core against the debate's estimate of about 170 B, and that is accepted.
- `$store` bridges any external source, not only `brumate/store`: it takes any value with the store contract (`subscribe`, `get`), from a context, a key of a context value, or a module-level import (`import { theme } from './theme'; const value = $store(theme);`). Neither a `createContext` nor a `brumate/store` store is required. The spike built only the context-default form (`createContext(key, store(v))`); compile the direct import to a resume export of the reader that names the import, the way the `z` export names an imported context, and repair a value changed since the server render the same way. The debate's one limit stays: a foreign store put inside a context value is refused on the server, since only `brumate/store` stores cross in page state.
- `$store` follows silmaril's `$store` ([website/docs/stores.md](https://github.com/lxsmnsyc/silmaril/blob/main/website/docs/stores.md)), except where brumate's ordered pass and resume need more:
  - The source is any expression that gives a store (`get`, `subscribe` returning a cleanup, optional `set`). It runs once and is not tracked. The subscription ends with the scope.
  - `const x = $store(s)` is one-way: the store writes the variable. `let x = $store(s)` is two-way: a write to the variable (`x = next`, `x++`) calls `s.set(next)`. The spike allows only `const` (analyze.ts reports "Read a store with const ...").
  - `let` on a store without `set` throws a `TypeError` when the binding registers, not at the first write. A store from `$toStore(memo)` has no `set` for this check.
  - The variable must be an identifier; a pattern is a compile error.
  - The `Store` class of `brumate/store` notifies only when the value changes (`Object.is`). The spike notifies on every `set`.
  - Brumate keeps its own: store sends go through the ordered pass, and a `brumate/store` value crosses in page state. Read silmaril's write-back rule (it runs at registration and after each change, also one from the store) and keep it only if it holds with resume: the write-back at registration must not call `set` again on resume.
- Give the 4 spike messages, and any message the direct form needs, codes from BRM191 to BRM195, and remove the `pending` sets the spike added to `test/skill.test.ts`.
- Fix the gap the spike left: the scope id inside a store is not moved when client navigation shifts scope ids (Gotchas of the spike outcome).

Gaps from the fresh review of #463 (review 5780262575), to fix here:

- A context value that holds a store emits no update for the whole value (codegen/client.ts:1151), so a live field beside the store, as in `{ state: $toStore(s), label }`, stops updating with no diagnostic. Keep the outer update for the fields that are not stores until static-contexts-final; the ui waves move one field at a time.
- The key form `$store(field.state)` never imports the context module (client.ts:567), so a store in a context default never links when no provider exists. Test the key form against a context default.
- `$store(box.inner)` compiles when `box` is not a context (codegen/markup.ts:1557) and fails at run time. With any source allowed, it must read `box.inner` as a store expression, or report an error.
- The foreign-store refusal (runtime/store.ts:72, server.ts:727) throws on any object with a `subscribe` function, so a context of handlers `{ subscribe, publish }` breaks. Treat a value as a store only when it has both `subscribe` and `get` functions.
- A reader that leaves the page stays subscribed until the store's next send (runtime/client/context.ts:157). Unsubscribe when the scope is cleaned up.
- context.ts:212 drops a store silently when its origin scope is missing; report it in dev.
- Nits: the theme test should check that the server rendered `light`.

## Acceptance

- [ ] The spike's resume and ordered-update cases pass as tests.
- [ ] `let value = $store(source)` writes through `set` from a handler (and throws `TypeError` at registration for a store without `set`), for a store from a context, from `$toStore(signal)` and from an import, and the readers update in one ordered pass.
- [ ] `$store(importedStore)` renders, resumes (a module store changed since the server render is repaired) and updates, for a `brumate/store` store and for a foreign store with only `subscribe` and `get`.
- [ ] Docs: website/docs/context.md (static values, stores for live ones), the API reference, and a docs/decisions.md entry replacing the "no `$store` yet" note.
- [ ] The compiler warns when a local `$signal`, `$memo` or `let` is read in a `$setContext` argument; `$untrack` silences it.
- [ ] Todos within 0.3 kB (todos reads no context).
- [ ] A minor changeset.

## Sizing

M.
