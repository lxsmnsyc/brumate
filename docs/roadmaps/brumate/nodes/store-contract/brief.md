---
id: store-contract
title: The store contract and $store
status: todo
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
spent:
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
- `$store` also reads an imported module-level store directly, without a context: `import { theme } from './theme'; const value = $store(theme);`. The spike built only the context-default form (`createContext(key, store(v))`). Compile the direct form to a resume export of the reader that names the import, the way the `z` export names an imported context. Keep the context-default form too.
- Give the 4 spike messages, and any message the direct form needs, codes from BRM191 to BRM195, and remove the `pending` sets the spike added to `test/skill.test.ts`.
- Fix the gap the spike left: the scope id inside a store is not moved when client navigation shifts scope ids (Gotchas of the spike outcome).

## Acceptance

- [ ] The spike's resume and ordered-update cases pass as tests.
- [ ] `$store(importedStore)` renders, resumes (a module store changed since the server render is repaired) and updates, beside the context-default form.
- [ ] Docs: website/docs/context.md (static values, stores for live ones), the API reference, and a docs/decisions.md entry replacing the "no `$store` yet" note.
- [ ] The compiler warns when a local `$signal`, `$memo` or `let` is read in a `$setContext` argument; `$untrack` silences it.
- [ ] Todos within 0.3 kB (todos reads no context).
- [ ] A minor changeset.

## Sizing

M.
