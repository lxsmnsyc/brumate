---
id: template-import-render
title: "The browser render module imports a component used only in a #template"
status: active
priority: must
type: hotfix
outline: false
milestone: 0.5.1
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-03
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/codegen/**
  - packages/brumate/test/render/**
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on: []
---

# The browser render module imports a component used only in a #template

## Goal

A page that uses a component only inside a `#template` in a `#try` renders in the browser. Today its render module (the code that renders it in the browser, `render` of `compile()`) calls `$$b.component(TryKid, …)` with no import of `TryKid`, so a browser render throws `ReferenceError: TryKid is not defined`. The server module imports it.

## Context

- Found by differential-render-test on `next` (2026-11-03, #437, divergence "template-import"), and also on `main`: `compile()` of packages/brumate/test/render/tryTemplateChild.brm on main gives a `render` that mentions `TryKid` once and imports only `brumate/client`; `server` imports it.
- Shipped in 0.5.0. A hotfix from `main`, released as 0.5.1.
- Check the other block bodies that hold markup the same way (`#template` outside `#try`, inside `#loading`, `#for`, `#key`), since the import list may skip any body the render module reaches through a template.
- When `main` syncs into `next`, remove the "template-import" entry of the differential test, which then fails until the entry goes.

## Acceptance

- [ ] A test that fails on `main`: tryTemplateChild.brm renders in the browser (a browser render, not resume) and shows `TryKid`.
- [ ] The render module of each case found in the check above imports what it renders.
- [ ] A patch changeset for brumate.
- [ ] Todos within 0.3 kB.

## Sizing

S: the import list of the render module and a test.
