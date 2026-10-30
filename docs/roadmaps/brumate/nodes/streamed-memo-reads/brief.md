---
id: streamed-memo-reads
title: Effects and handlers never read the promise of a memo that is still streaming
status: active
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-29
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/src/runtime/client/resume.ts
  - packages/brumate/test/**
  - website/docs/effects.md
  - website/docs/async-data.md
reserves: []
provides: []
depends_on: []
---

# Effects and handlers never read the promise of a memo that is still streaming

## Goal

A memo that no markup reads, such as one that only an `$effect` reads, is never awaited: not by the page, and not by a `#loading` boundary, which waits only for the memos its markup reads. The server saves it in the page state as a promise (`stateValue`, server.ts:1272), and the browser keeps that promise in the slot until a later state record settles it (resume.ts:224-233). `get()` treats a promise as not ready only inside a memo's compute (`computing > 0`, updates.ts:47). Everywhere else it returns the raw promise. So an effect, a handler or a `$client` callback that reads the memo before the record arrives gets a `Promise` instead of the value.

Fix: outside a memo compute, a slot that holds a streaming promise reads as pending, never as the promise. An effect that reads it skips that run and runs once the value lands. A handler reads the last settled value, or `undefined` when there is none yet. Decide and document which, and make `$isPending` true in that window (it is already: updates.ts:408).

## Context

- Found on main on 2026-10-29. Example: `const data = $memo(fetchData(id)); $effect(() => console.log(data)); $client(() => { id = getID(); }, 'idle');` inside `#loading { <Example /> }`. When idle comes before the record, `startLoading` runs the effect (updates.ts:214) and it logs the server's promise.
- `test/resume.test.ts:308-337` already asserts that `get()` returns a `Promise` for a streamed slot; that assertion changes or moves inside a compute.
- Also check a memo created in the browser before its first value: what its slot holds when `startLoading` runs the readers (`undefined` or the render's promise via `renderedLoads`).
- A main bug: branch from main, its own PR. Start with `it.fails` tests for the effect and the handler cases.

## Acceptance

- [ ] A test where an effect reads a memo whose server value is still streaming: the effect never receives a `Promise`, and runs with the value once it lands.
- [ ] A test for a handler in the same window, with the documented result.
- [ ] A test for a memo created in the browser whose first load is pending.
- [ ] effects.md and async-data.md state what effects and handlers read while a memo is pending.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: a read rule in the client runtime, three tests, two docs paragraphs.
