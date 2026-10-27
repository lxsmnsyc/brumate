---
id: component-tag-spread
title: A live spread on a dynamic tag that names a component reaches the component
status: done
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "spread on a component tag"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/tagSpread*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/project.ts
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/resume.test.ts
  - packages/ui/test/as-controls.test.ts
reserves: []
provides: []
depends_on:
  - on: as-passed-on
    kind: hard
    why: it extends the analysis that as-passed-on changes
  - on: spread-children-live
    kind: hard
    why: both change the client write path of spreads and inserts
  - on: ordered-updates
    kind: hard
    why: it rewrites the update code that a live spread runs through
---

# A live spread on a dynamic tag that names a component reaches the component

## Goal

`<{as} {...rest}>`, `<{as} onClick=(handler)>` and `<{as} [name]=(x)>` with `as` set to a component update the component when the value changes. Today only value props go through `prop`; a spread, a live handler or a computed attribute goes through `attrs` and stays static.

## Context

- Gap 2 of the component-tag-live-props outcome. Found again by as-passed-on (#285): ToggleButton passes `aria-pressed` and `data-selected` to Button, Button spreads its rest onto `<{as}>`, and with a component in `as` they never update. The ToggleButton test in packages/ui/test/as-controls.test.ts stays `it.fails` for this; turn it into `it`.
- as-passed-on tried counting a live spread in `dynamicTags` and routing `attrs` of a component anchor to `spreadProps`, and three as-controls tests failed (Toolbar focus, Disclosure, ToggleButton). Read its outcome and log first.
- First write a packages/brumate test for each of the three forms, and see them fail on main.

## Acceptance

- [ ] Tests for a live spread, a live handler and a computed attribute on a dynamic tag with a component fail on main and pass with the fix.
- [ ] The packages/brumate and packages/ui suites pass. The ToggleButton test is `it`.
- [ ] The gzip size of the eager core grows by at most 0.1 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: three forms through the analysis and the client spread path.

PR: #288
