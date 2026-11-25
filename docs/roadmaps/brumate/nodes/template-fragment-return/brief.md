---
id: template-fragment-return
title: "#template functions and children return cloned nodes"
status: done
priority: should
type: refactor
story:
early: false
outline: false
milestone: 0.10.0
target:
ship: auto
land: auto
from:
size: M
risk: medium
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/clone-bodies.test.ts test/resume.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-25
spent: 334268
owns:
  - docs/roadmaps/brumate/nodes/template-fragment-return/**
shared:
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/codegen/template.ts
  - packages/brumate/src/runtime/client/inserts.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/clone-bodies.test.ts
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on:
  - on: clone-remaining-bodies
    kind: hard
    why: split from it on 2026-11-25; builds on its cloned #try, #offscreen and windowed #for
---

# #template functions and children return cloned nodes

## Goal

Split from clone-remaining-bodies (2026-11-25), which cloned every block body but left this half. `emitTemplate` in `packages/brumate/src/codegen/markup.ts` still returns `$$b.raw($$html)`, so `#template` functions and children closures still render from an HTML string, and no-client-html cannot remove the HTML-string machinery. Make them return cloned nodes.

## Context

- Read `nodes/clone-remaining-bodies/outcome.md` first: it describes an attempt that was built and reverted (clone, return `$$b.rawNodes`, `insert` holds its place, `clientHTML` on, `sharedTemplate` for the `withTemplates` constants).
- That attempt failed 8 resume tests: the in-place template updates in `tplInPlaceHost` ended with 15 scopes instead of 11, and `gapTemplate`, `tryTemplateProp` and `tryTemplateNested` failed. The likely cause: `renderedTemplate`, `inRange` and `destroyNodes` in `runtime/client/inserts.ts` read `b-b` attributes that `keep` writes only on top-level or `b-on` elements, so scopes of cloned template output are not found and destroyed. Start there, with the scope count test.
- Until values-build lands, keep pending and fallback state in scope slots, not new hold-back helpers (docs/decisions.md, the client restructure entry).

## Acceptance

- [ ] No `#template` function or children closure returns `$$b.raw`; `test/clone-bodies.test.ts` checks it.
- [ ] `tplInPlaceHost` ends with the same scope count as on the base, and `gapTemplate`, `tryTemplateProp`, `tryTemplateNested` pass, with resume, render, template and differential tests, and the `@brumate/ui` unit tests.
- [ ] Todos within 0.3 kB (`pnpm bench --only brumate --scenario todos`).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: the template return in codegen, and scope tracking for cloned template output in `inserts.ts`.
