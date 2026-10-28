---
id: rest-prop-handlers
title: A live rest prop keeps the scope of handlers in a component tag
status: done
priority: must
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "a component in a prop"
exclusive: []
fulfilled_by: "#264"
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/restLiveProp.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/src/project.ts
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on:
  - on: component-tag-live-props
    kind: hard
    why: it changes which props of a component are live, and how a dynamic tag passes its anchor
---

# A live rest prop keeps the scope of handlers in a component tag

## Goal

Once any page passes a component a live prop, such as `<AsLink title=(String(flag)) />`, the component's rest slot becomes live. Then a handler on that component, rendered by the browser through a dynamic tag, reads an undefined scope, and all six tests of "a component in a prop" in resume.test.ts fail. Make a live rest keep the scope of the handlers that it passes on.

## Context

- Found by the worker of component-tag-live-props (#264). It happens on main, with or without that PR. Its fixtures use a copy of AsLink, RestLink.brm, to avoid it.
- The repro is in the Gotchas of docs/roadmaps/brumate/nodes/component-tag-live-props/outcome.md, once #264 merges.
- Repro: add `<AsLink title=(String(flag)) />` with a toggle of `flag` to any page of the test project. Then the tests of "a component in a prop" fail with an undefined scope in a handler of a browser-rendered tag.

## Acceptance

- [x] A test that passes AsLink a live prop on one page, and renders AsLink through a dynamic tag on another, fails on main and passes with the fix.
- [x] The six tests of "a component in a prop" pass with that page in the project.
- [x] The gzip size of the eager core grows by at most 0.05 kB.
- [x] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one path, with a known repro.

## Log

- 2026-10-27: fulfilled by #264, whose fixture restLiveProp.brm gives AsLink a live prop. The six tests of "a component in a prop" pass.
