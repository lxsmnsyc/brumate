---
id: popover-group-alert
title: PopoverGroup and Alert
status: todo
priority: could
type: feature
target:
from:
size: S
spike: false
verify: pnpm --filter @brumate/ui exec vitest run test/popover-group.test.ts
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - packages/ui/src/PopoverGroup.brm
  - packages/ui/src/Alert.brm
  - packages/ui/test/popover-group.test.ts
  - website/ui/alert.md
shared:
  - packages/ui/src/overlay.ts
  - website/src/ui.ts
  - examples/ui/src/**
  - e2e/suites/ui/**
reserves: []
provides: []
depends_on:
  - on: split-ui-examples
    kind: hard
    why: it adds examples and e2e steps
---

# PopoverGroup and Alert

## Goal

Add `PopoverGroup`, so focus moves between sibling popovers without closing them, and `Alert`, a stateless `role="alert"` part.

## Context

- A non-modal popover closes when focus leaves it, in the focus-leave check of overlay.ts.
- Source: [PopoverGroup, for popovers that share focus](../../../../proposals.md#6-popovergroup-for-popovers-that-share-focus)
- Source: [Alert](../../../../proposals.md#9-alert)

## Acceptance

- [ ] Tab from one popover of a group to the next keeps both open.
- [ ] Alert renders `role="alert"`.
- [ ] `pnpm --filter @brumate/ui exec vitest run` passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one context and one check, and a part with no state.
