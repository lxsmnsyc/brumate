---
id: batching
title: Batching and flush()
status: todo
priority: should
type: feature
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t batching
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - packages/brumate/src/runtime/signals.ts
  - packages/brumate/src/runtime/client/handlers.ts
  - docs/roadmaps/core-next/contracts/update-pass.md
shared:
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/index.ts
  - packages/ui/src/*.brm
reserves: []
provides: []
depends_on:
  - on: ordered-updates
    kind: hard
    why: a pass uses the binding queue that ordered updates adds
---

# Batching and flush()

## Goal

Freeze the update-pass contract first, with the signatures of `flush`, and of a hook for work at the end of a pass. A pass is the outermost unit of code that runs at once: a handler up to its first await, a `$client` callback, a run of effects, or a value that settles. Bindings wait until the pass ends. `flush()` from brumate/signals runs them at once, for a handler that must focus or measure what it rendered.

## Context

- The parts of @brumate/ui focus and measure right after they open things. Each such handler needs `flush()`, or does the work in a `$client` callback already.
- Source: [Batching](../../../../proposals.md#batching)

## Acceptance

- [ ] Tests: one DOM write for two writes in a handler, one run of an effect that reads both, no throw from a state between writes, and `flush()`.
- [ ] The ui suite passes, with `flush()` where a part reads the DOM after a write.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: the queue exists after ordered updates. The audit of the ui handlers is the larger part.
