---
id: pending-read
title: A browser render holds at a read of a property of a pending memo
status: active
priority: must
type: fix
story:
early: false
outline: false
milestone: 0.8.1
target: main
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/differential-1.test.ts test/differential-2.test.ts test/differential-3.test.ts test/differential-4.test.ts test/differential.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent:
owns: []
shared:
  - packages/brumate/src/runtime/client/components.ts
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/src/runtime/client/waits.ts
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/codegen/patch.ts
  - packages/brumate/test/differential/data.ts
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
  - packages/brumate/test/__snapshots__/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: release-0.8
    kind: hard
    why: it branches from `main` after the 0.8.0 promotion
---

# A browser render holds at a read of a property of a pending memo

## Goal

In a browser render, a memo or a function that reads a property of a memo whose value is still a promise reads the property of the promise (`undefined`) and throws. The server awaits the memo before the markup, and an update on a resumed page makes the reader pending. Make the browser render do the same: the reader is pending until the source settles, and the markup holds as it does for any pending memo. Remove the `pending-read` cause and its three pages (`fnReadAsync`, `loadingChain`, `loadingOnChain`) from `packages/brumate/test/differential/data.ts`.

Repro, `test/render/loadingChain.brm`: `user = $memo(fetchUser())`, `label = $memo(user.name.toUpperCase())`, `{label}` in a `#loading`. The render module on origin/main (d64fb2eb) compiles to:

```js
const user = $$b.renderMemo(() => (fetchUser()));
const label = $$b.renderMemo(() => ($$b.readMemo(user).name.toUpperCase()));
```

`user` is a promise, `readMemo(user).name` is `undefined`, and `label` holds a `MemoError(TypeError)` that the `#loading` body throws at its read. `fnReadAsync.brm` does the same through a function prop: `nameOf() { return $$b.readMemo(user).name }`, and `FnReadChild`'s `$memo(label().toUpperCase())` throws. The differential test lists the three pages as divergences and asserts they still differ, so CI on main proves the bug.

## Context

- `renderMemo`, `readMemo`, `memoNow` and `setSlots` are in `runtime/client/components.ts` (about lines 170-260). `readMemo` only rethrows a `MemoError`; it returns a promise as it is.
- The update path already has the rule: `get` (`runtime/client/updates.ts`) throws `NotReady` when a memo that is computing (`computing > 0`) reads a promise slot, and `memo` catches it and calls `startLoading`, so the memo keeps no value and is pending until the source arrives and it computes again. The browser render should give the same result.
- docs/decisions.md, line 136: a read never gives a promise or `undefined` typed as the value; a memo that reads a loading value is pending; code that updates the page reads the promise. Line 141: a component the browser renders follows the server exactly, and fixes on this path keep pending state in scope slots, not new hold-back helpers.
- Render locals go stale after the render (client-audit, section 3): computing the reader again from the render closure would read the old promise. Let the slot be pending in the render, and let the update part's memo export compute it once the source slot gets its value.
- Where the codegen does not wrap a read: bfd1e98a (render-memo-reads) drops `readMemo` for memos that cannot throw (`memoNow`). A memo that can be a promise, read through a member, must still reach the check; adjust `codegen/patch.ts`/`markup.ts` if a fixture shows a miss.
- A direct markup read, `<p class="live">{label()}</p>` in `FnReadChild`, gets `undefined` today (no throw). The server shows `user1`. That insert must hold too or update once the source settles; `fillValue` (`runtime/client/waits.ts`) counts a promise in the boundary.

Suggested shape: `readMemo` of a loading promise (one that `renderMemo`/`memoNow` marked, or that is in `loadingValues`) throws `NotReady` inside a `renderMemo`; `renderMemo` marks the slot pending with the source promise, and `setSlots` starts the load of that slot after the source, as it does for an async memo. A worker who finds a simpler shape that meets the decisions may use it.

## Acceptance

- [ ] Prove it first on main: a resume test that renders `loadingChain` in the browser (through a toggle) shows the `#loading` fallback, then the upper-case name after `release(...)`; it fails on main with the TypeError. A second test for `fnReadAsync` shows `USER1` and `user1`.
- [ ] The fix: both tests pass, no error reaches `onError`, and `loadingOnChain` shows the new label after "Next".
- [ ] `pending-read` and its `diverge(...)` line leave `test/differential/data.ts`; the three pages pass as same pages.
- [ ] Existing async memo tests in resume.test.ts and the render snapshots pass (update snapshots only for the new reads, and say why).
- [ ] A patch changeset for brumate.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`; `pnpm --filter brumate test` passes.

## Sizing

M: runtime and possibly codegen of the browser render, on the hold and waits path that browser-async built (risk high, per client-audit item 8).

## Notes for the worker

- Do not add an implicit wait to handlers: a handler read of a pending memo stays BRM182 or a throw into `#try` (decisions line 136).
- Measure the todos client size before and after (`pnpm bench --only brumate --scenario todos`); size is not a gate, but record it.
