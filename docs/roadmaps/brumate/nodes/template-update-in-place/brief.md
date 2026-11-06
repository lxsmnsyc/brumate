---
id: template-update-in-place
title: A template of the file updates its markup in place, so focus and input state stay
status: done
priority: must
type: fix
outline: false
milestone: 0.6.1
target: main
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-06
owns: []
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: template-scope-leak
    kind: hard
    why: the replace path it fixed is the one this node replaces for templates of the file
---

# A template of the file updates its markup in place, so focus and input state stay

## Goal

A same-file `#template` called in markup is a plain function that returns `raw(html, scope)`, so each update renders new nodes and replaces the old ones (`write()` in runtime/client/inserts.ts). An `<input>` inside such a template, for example in a `#for` row, loses focus, caret and typed state at each update. A `TemplateCall` (a template passed as a prop) already updates in place through the slot path (inserts.ts, about lines 137-150). Found by the template-scope-leak review, 2026-11-06; on main too.

Make same-file template calls update in place: the compiler emits the slot export for them as for `TemplateCall`, and `write()` takes the in-place path when the same template renders again.

## Acceptance

- [ ] A test: an input inside a same-file template row keeps focus and its value across an update of another field of the row (fails on main).
- [ ] Scope counts stay flat (template-scope-leak's test still passes).
- [ ] Client size of todos and ui measured.
