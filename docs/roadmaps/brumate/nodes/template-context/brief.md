---
id: template-context
title: "A #template that a child calls reads the context of its caller in the browser"
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
spent: 160000
owns: []
shared:
  - packages/brumate/src/runtime/client/handlers.ts
  - packages/brumate/src/runtime/client/children.ts
  - packages/brumate/src/runtime/client/inserts.ts
  - packages/brumate/test/differential/data.ts
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: release-0.8
    kind: hard
    why: it branches from `main` after the 0.8.0 promotion
---

# A #template that a child calls reads the context of its caller in the browser

## Goal

A `#template` passed as a prop to a child, and called by the child, reads contexts where the child inserts it on the server and on a resumed page, but where the template is defined in a browser render. Make the browser render read them at the insert, and remove the `template-context` cause from `packages/brumate/test/differential/data.ts`.

Repro (fixtures on main): `test/render/tplContextListPage.brm` passes `#template row` as `item` to `TplContextList.brm`, which provides `LevelStore` (7) and renders `{item(label)}` in a `#for`. `TplReader` in the row reads `$getContext(LevelStore)`.

- Server, and resumed page after "Add": `.reader` shows `7` (resume.test.ts, "reads the contexts of the component that renders the template", passes).
- Browser render (the differential test's `viaBrowser`): the reader finds no provider above the page scope, so it throws (no default) or reads a wrong value. `tplContextListPage` is listed as a known divergence, and the divergence test asserts it still differs, so CI on main proves it is still there.

## Context

Code path on origin/main (d64fb2eb):

- Server: `Context.fn` (`runtime/server.ts`, about line 1186) wraps a `#t` reference in `new Children(scope, (ctx, at) => insert(await render(...rest), ctx, at))`: "A `#template` renders where the component that gets it inserts it, so it reads the contexts there, as children do."
- Browser, other component's template: `templateReference` (`runtime/client/children.ts`) also renders at the insert.
- Browser, render module: the page compiles `row` to `function row(...$$a) { return $$b.templateCall(ref, $$s1, row$, $$a); }` and passes `$$b.handlerProp(row, "…#t1", $$s1)`. `handlerProp` (`runtime/client/handlers.ts`, about line 300) returns a template as it is (`isTemplate(ref)`). `templateCall` builds a `TemplateCall` with `lexical = true`, so `Children.from` is `undefined` and the `insertedChildren` entry never matches. `createScope(2, $$s1)` then gets no `t`, and `findProvider` (`runtime/client/context.ts`) walks `p` to the page scope, past `TplContextList`.
- `lexical` came from template-update-in-place (4dc4d6d0, 2026-11-06): it kept "contexts where the template is written, as the output of a template did". That was keeping old behavior, not a decision; docs/decisions.md line 125 says children read the contexts where they are inserted, through `t`, on the server and in the browser.

Fix direction: in `handlerProp`, a template prop renders as children of its owner at the insert, as `Context.fn` and `templateReference` do (a `TemplateCall` that is not lexical, or one that pushes `{ from: owner, at }`). Keep in-place updates of template calls working: `renderedTemplate` and `write()` in `runtime/client/inserts.ts` find the scope by `scope.l` and `T<id>a`/`T<id>k`.

Also probe an in-file call inside a provider's children, `<Provider>{row(x)}</Provider>`: the server reads Provider's context there too. If the browser render differs, fix it in the same change (same `lexical` flag), with a fixture; if it does not, note it in the outcome.

## Acceptance

- [ ] Prove it first on main: a resume test that renders `tplContextListPage` in the browser (the toggle path the differential uses, or a `#if` page that shows it) and expects `.reader.zero` to be `7`. It fails on main.
- [ ] The fix: the browser render reads the context of the child that inserts the template. The test passes; the existing template tests in resume.test.ts (template-update-in-place, "contexts of templates that a component renders") still pass, and focus and nodes of an in-place template update stay.
- [ ] `template-context` and its `diverge(...)` line leave `test/differential/data.ts`; `tplContextListPage` passes as a same page.
- [ ] A patch changeset for brumate.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`; `pnpm --filter brumate test` passes.

## Sizing

M: a small runtime change, but it changes which context a template sees, and the in-place update path of templates must keep working.

## Notes for the worker

- Do not change the server; it is the reference.
- Match the lifecycle rules of Svelte/Solid: a template's scope is destroyed with its insert, whoever rendered it.
