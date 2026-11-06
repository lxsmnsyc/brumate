---
id: template-component-import
title: A template of the file that renders a component works in the browser's update code
status: done
priority: must
type: fix
outline: false
milestone: 0.6.1
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-06
owns: []
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: template-scope-leak
    kind: soft
    why: its fixtures (scopeLeak.brm, ScopeLeakList.brm) are the base of the cleanup test here
---

# A template of the file that renders a component works in the browser's update code

## Goal

A `#template` of a file that renders a component (`#template row(name) { <li><Item name=(name) /></li> }`), called in markup that updates in the browser, throws `ReferenceError: Item is not defined` on the first update. The compiler copies the template function into the client `update` part (`?brumate-client&part=update`), but that part does not import the components the template uses. The `render` module does import them (`./Item.brm?brumate-render`). Found while adding a cleanup test to template-scope-leak (#472), 2026-11-06.

Fix the part's imports so every component (and other import) that a copied template uses is imported, as the render module does.

## Acceptance

- [ ] A test: a browser-rendered list that calls a same-file template rendering a component updates without error (fails on main).
- [ ] The cleanup test from template-scope-leak's log: an `$effect` cleanup in the component inside the template runs once for each replaced row.
- [ ] Client size of todos and ui measured.
