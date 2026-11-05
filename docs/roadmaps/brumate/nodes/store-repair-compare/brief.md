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
    why: it set the LocaleContext workaround this node removes
  - on: static-contexts-final
    kind: hard
    why: both edit runtime/client/context.ts; static-contexts-final goes first so the story is not held
---

# A store whose value only looks new does not rewrite its readers on resume

## Goal

On resume, `subscribeSlot` (packages/brumate/src/runtime/client/context.ts, about line 166) repairs a reader when `found.get()` differs from the slot the server sent, with `Object.is`. A context default `store({ ... })` builds a new object in the browser, so every reader of an object default rewrites its slot at resume with the same content. The ui-stores-rest review reproduced it on 1739a254: an `$effect` reader runs once at resume for `store({ name: 'x' })`, zero times for `store('x')`, `store(null)` or a provider's `$toStore(memo)`.

Compare plain data structurally for the repair (the `savedTheme` test, where the browser value really differs, must still repair). Then restore `LocaleContext`'s default to a store of the en-US locale and drop the `$memo(localeStore ?? DEFAULT_LOCALE)` in its 28 readers (ui-stores-rest's workaround; the review estimates 1.5 to 1.9 kB gzip saved on the ui example).

Second, unexplained: with the object default, the ui e2e skip link (`<VisuallyHidden as="a" class="skip" focusable>`) lost its `visually-hidden focusable` classes at load in a real browser; no vitest probe reproduced it. With the compare fixed and the object default back, run the e2e; if the classes still drop, trace `attr(class)` in the VisuallyHidden update and fix or report it as its own node.

Third, from static-contexts-final: its worker saw a browser-rendered object memo feeding `$toStore` re-send its store after its code loaded, and a template's item scopes created twice, in the `spikeTemplate` differential; it changed the fixture to two stores of primitives. The review could not reproduce it. Read static-contexts-final's outcome (Gotchas) for the original fixture, and add a test that counts reader writes and item scopes for an object memo feeding `$toStore`, rendered by the server and by the browser.

## Acceptance

- [ ] A test: a context whose default is a store of an object does not rewrite its readers on resume; a browser value that really differs still repairs.
- [ ] A test counts reader writes and item scopes for an object memo feeding `$toStore` (server and browser render): one write each, no doubled scopes.
- [ ] LocaleContext defaults to a store of the en-US locale; readers use `$store(LocaleContext)` only; ui tests and `node e2e/run.mjs --only ui` pass.
- [ ] The ui example's client JS (gzip -9 summed over examples/ui dist JS) before and after.
- [ ] The changeset of ui-stores-rest's `DEFAULT_LOCALE` note is updated or a new one says the null default is gone.

## Sizing

M.
