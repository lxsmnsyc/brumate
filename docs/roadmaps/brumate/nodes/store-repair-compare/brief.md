---
id: store-repair-compare
title: A store whose value only looks new does not rewrite its readers on resume
status: todo
priority: must
type: fix
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
added: 2026-11-05
spent:
owns: []
shared:
  - packages/brumate/src/runtime/**
  - packages/brumate/test/**
  - packages/ui/src/**
  - packages/ui/test/**
  - packages/ui/e2e/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: ui-stores-rest
    kind: hard
    why: it set the LocaleContext workaround (now replaced by ui-no-defaults-4)
  - on: static-contexts-final
    kind: hard
    why: both edit runtime/client/context.ts; static-contexts-final goes first so the story is not held
  - on: ui-no-defaults-4
    kind: hard
    why: contexts lose their defaults first (docs/debates/context-no-defaults/debate.md), which removes the object default that caused the rewrite
---

# A store whose value only looks new does not rewrite its readers on resume

## Goal

On resume, `subscribeSlot` (packages/brumate/src/runtime/client/context.ts, about line 166) repairs a reader when `found.get()` differs from the slot the server sent, with `Object.is`. A context default `store({ ... })` builds a new object in the browser, so every reader of an object default rewrites its slot at resume with the same content. The ui-stores-rest review reproduced it on 1739a254: an `$effect` reader runs once at resume for `store({ name: 'x' })`, zero times for `store('x')`, `store(null)` or a provider's `$toStore(memo)`.

Changed 2026-11-05 by the approved debate docs/debates/context-no-defaults/debate.md: contexts have no defaults after ui-no-defaults-4, so the object default that caused this is gone, and LocaleContext is not given a default store again (its readers fall back to en-US per reader, in ui-no-defaults-2). Check whether a provider's store of an object (a `$toStore` of an object memo, or a provided `store({ ... })`) still rewrites its readers at resume; if it does, compare plain data structurally for the repair (the `savedTheme` test, where the browser value really differs, must still repair). If nothing rewrites, record that in the outcome and skip the compare.

Second, unexplained: with the object default (now gone), the ui e2e skip link (`<VisuallyHidden as="a" class="skip" focusable>`) lost its `visually-hidden focusable` classes at load in a real browser; no vitest probe reproduced it. After ui-no-defaults-4, run the e2e; if the classes still drop, trace `attr(class)` in the VisuallyHidden update and fix or report it as its own node.

Third, from static-contexts-final: its worker saw a browser-rendered object memo feeding `$toStore` re-send its store after its code loaded, and a template's item scopes created twice, in the `spikeTemplate` differential; it changed the fixture to two stores of primitives. The review could not reproduce it. Read static-contexts-final's outcome (Gotchas) for the original fixture, and add a test that counts reader writes and item scopes for an object memo feeding `$toStore`, rendered by the server and by the browser.

## Acceptance

- [ ] A test: a provided store of an object does not rewrite its readers on resume; a browser value that really differs still repairs.
- [ ] A test counts reader writes and item scopes for an object memo feeding `$toStore` (server and browser render): one write each, no doubled scopes.
- [ ] The skip link keeps its classes in `node e2e/run.mjs --only ui`, or a node is filed for it.

## Sizing

M.
