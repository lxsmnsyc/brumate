---
id: spread-children-live
title: A spread onto a component does not render its children again
status: done
priority: must
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "spread onto a component"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/spreadChildren*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/project.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/resume.test.ts
  - packages/ui/test/as-controls.test.ts
reserves: []
provides: []
depends_on:
  - on: split-client-runtime
    kind: hard
    why: the fix is likely in the client runtime, which the split moves into modules
---

# A spread onto a component does not render its children again

## Goal

A component that receives `{...rest}` keeps the DOM of its children when an unrelated prop or state changes. Today a spread makes all props of the target live, `children` included, and after resume the update of a template body sends the children again, so the child renders them fresh: the nodes and the focus are replaced.

## Context

- What is known, and a reproduction in packages/ui: [reviews/core-gaps-2.md](../../reviews/core-gaps-2.md), section 4. First reduce it to a packages/brumate test, and see it fail.
- Two places can fix it: the runtime can skip a children update whose content is the same template with the same arguments, or the analysis can keep `children` static when no parent passes live children. Find why the template arguments differ after resume (object identity from the page state is a suspect). Pick the fix that keeps the size, and say why in the outcome.
- Users wrap parts with `{...rest}` often, so this replaces their DOM. The ui parts work around it today by passing attributes through a context (`TreeItemAttributesContext`).
- The as-controls `it.fails` test of a ToastRegion with `as=AsTarget`, where a closed toast stays, may have this cause. Check it, and turn it into `it` if it passes.

## Acceptance

- [ ] A packages/brumate test fails on main and passes with the fix: a component given `{...rest}` keeps the same child element (and its focus) across an update.
- [ ] The old `AsTreeItem.brm` with `{...rest}` no longer breaks packages/ui/test/tree.test.ts (try it locally; do not commit it).
- [ ] The packages/brumate and packages/ui suites pass. The gzip size of the eager core grows by at most 0.1 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: the cause is not known yet, and it crosses the analysis and the runtime.
