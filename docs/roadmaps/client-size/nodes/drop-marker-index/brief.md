---
id: drop-marker-index
title: Remove the marker index and the HTML string path
status: todo
priority: should
type: refactor
target:
from:
size: L
spike: false
verify: pnpm --filter brumate exec vitest run
exclusive: [bench]
fulfilled_by: 
gate: true
added:
owns:
  - packages/brumate/src/runtime/client/blocks.ts
  - packages/brumate/src/runtime/boot.ts
  - packages/brumate/src/codegen/markup.ts
shared:
  - packages/brumate/src/runtime/client.ts
reserves: []
provides: []
depends_on:
  - on: size-baseline
    kind: hard
    why: the step reports its size against the baseline
---

# Remove the marker index and the HTML string path

## Goal

Finish step 3: every body that the browser renders is a cloned template, so the MutationObserver index of markers, the `clientHTML` path and their scans go.

## Context

- Clones are in (#149-#166). `markerObserver` still runs when `HAS_LATE_MARKUP`, in client.ts and boot.ts. Streaming and `#defer` rely on the markers.
- Source: [A smaller and faster client, step 3](../../../../proposals.md#steps)

## Acceptance

- [ ] No MutationObserver in the client runtime.
- [ ] The tests of streaming, `#offscreen` and `#defer` pass.
- [ ] The gzip size of todos is smaller than the baseline.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

L: blast radius high (core rendering), size medium.

## Notes for the worker

- Start only after core-next/split-client-runtime and core-next/visible-forwarded-ref are done or dropped: both edit the same runtime code and markup.ts. plan.py cannot see edges across roadmaps, so this node is gated.
