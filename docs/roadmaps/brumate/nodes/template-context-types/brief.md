---
id: template-context-types
title: An untyped template parameter takes its type from the prop it is passed to
status: todo
priority: should
type: fix
outline: false
milestone: types
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/check/templateContext*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/check.ts
  - packages/brumate/test/check.test.ts
  - packages/ui/test/**
  - website/docs/**
reserves: []
provides: []
depends_on:
  - on: ui-generics
    kind: hard
    why: its typed-template test becomes the untyped one this node makes pass
---

# An untyped template parameter takes its type from the prop it is passed to

## Goal

`<ListBox items=(animals) item=row>` with `#template row(a) { ... }` should type `a` from `items`, so `a.nope` is an error. Today `toTypeScript` in check.ts writes each template as a hoisted `async function row(a)` and passes `item: (row)`. A function declaration gets no contextual type, so `a` is an implicit `any`: an error about the annotation under `noImplicitAny`, silent otherwise. An inline `item=(a => ...)` and an annotated `#template row(a: Animal)` already work.

## Context

- Template bodies are type-checked: the review of element-checks (#307) confirmed that a wrong field on a typed parameter, and a bad attribute inside a `#template` body, are errors on main. An earlier note here said bodies were unchecked; that was wrong. Only an untyped parameter lacks a type from the prop it is passed to.

- Found in the review of ui-generics (#300). The code is in check.ts, `templates()` (about lines 302-316) and `props()` (about line 434).
- A likely shape: when a prop value is a bare identifier that names a template with an unannotated parameter, emit that template inline at the use site as `async (a) => { ... }`. Annotated templates keep the hoisted form.
- Hard parts: source mappings for the body at the use site, a template used in several places (emitted once per use), and names of an enclosing `#for` or `#if` that could shadow what the template reads.
- language-core and brumate-tsc only call `toTypeScript`, so the fix is in brumate.

## Acceptance

- [ ] An untyped template passed to a generic part's prop types its parameter from the other props: a wrong field is an error, in a .brm test checked by the type checker.
- [ ] Errors in a template body point at the right line and column in the .brm file.
- [ ] A template used twice, and one used inside `#for`, check correctly.
- [ ] The note that template parameters need a type is removed from the ui docs and the ui-generics outcome is linked as fixed.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one emitter change with source maps, and its tests.
