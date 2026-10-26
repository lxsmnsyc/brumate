---
id: component-tag-live-props
title: A dynamic tag that names a component updates its live props
status: todo
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "updates its live props"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - packages/brumate/test/render/componentTagLiveProps.brm
shared:
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/src/codegen/client.ts
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on:
  - on: component-prop-render
    kind: hard
    why: both change how the client renders a dynamic tag that names a component
---

# A dynamic tag that names a component updates its live props

## Goal

A live prop of a dynamic tag whose tag is a component, such as `<{as} class=(cls)>` with `as` set to a component, never reaches the component when `cls` changes, so its element keeps the old value. Pass the new props to the component, as a component written by name gets them.

## Context

- Found in the review of #255 (dynamic-spread-anchor). It fails the same on main and on #255.
- Repro: `let as = $signal<any>(SomeComponent); let cls = $signal('a');`, then `<{as} class=(cls) />` and a button that sets `cls = 'b'`. After the click, the component's element still has `class="a"`.
- Check it with the tag rendered by the server, and with it rendered in a block that the browser opens.

## Acceptance

- [ ] The repro is a test, and it fails on main.
- [ ] With the fix, the component's element gets the new value, in both cases.
- [ ] The gzip size of the eager core grows by at most 0.05 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: the prop update of a component already exists for components written by name.
