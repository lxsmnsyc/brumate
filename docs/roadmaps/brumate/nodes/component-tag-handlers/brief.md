---
id: component-tag-handlers
title: A component in a dynamic tag keeps the handlers of its caller in the browser
status: done
priority: must
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "keeps the handlers of its caller"
exclusive: []
fulfilled_by: "#262"
gate: false
added: 2026-10-26
owns:
  - packages/brumate/test/render/ScopeWrap.brm
  - packages/brumate/test/render/componentTagHandlers.brm
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/test/__snapshots__/render/**
  - packages/brumate/src/codegen/client.ts
  - packages/brumate/test/render/dynamicKeysLive.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on:
  - on: dynamic-spread-handlers
    kind: hard
    why: both change dynamic and dynamicNodes of the client runtime
---

# A component in a dynamic tag keeps the handlers of its caller in the browser

## Goal

When the browser renders a dynamic tag whose tag is a component, and that component puts its own handler on the element it spreads its props onto, the caller's handler is lost. The client `spread` does not keep a `b-on` that arrives in the attributes, and the component's `setOn` overwrites it. The client `dynamic` also leaves out the `@scope` that the server `dynamic` adds. Keep both entries, with their scopes, as the server does.

## Context

- Found in the review of #256 (dynamic-spread-handlers). It is on main, and #256 does not cause it.
- Cause, from the review:
  - The client `setSpread` and `spread` (client.ts, near 772 and 4206) do not put an incoming `b-on` first, as the server `spread` does (server.ts, near 3755).
  - The component's compiled `setOn(el, on, own)` then sets `b-on` from its own entries only.
  - The server `dynamic` (server.ts, near 1478-1486) adds `@scope` to the entries for a component tag, and the client does not.
- Repro:
  - The parts: `AsButton.brm` renders `<{as ?? 'button'} onClick=(() => own++) {...rest}>`. `ScopeWrap.brm` renders `<section class="wrap" onClick=(() => inner++) {...rest}>{children}</section>`.
  - The page: `#if (open) { <AsButton as=ScopeWrap>x</AsButton> }`. Open the block in the browser, and click `.wrap`.
  - On main and on #256, only `click=ScopeWrap#h1` is written, so AsButton's handler never runs.
  - The same page rendered by the server writes `click=ScopeWrap#h1 click=AsButton#h4@0.1`.
- Without a handler of its own on the target, the unscoped entry only works because `closest('[b-b]')` finds the right scope.

## Acceptance

- [x] The repro is a test, and it fails on main.
- [x] With the fix, both handlers run, each in its own scope, when the browser renders the block.
- [x] The gzip size of the eager core grows by at most 0.05 kB. The client chunk is close to its budget after #256.
- [x] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: two small changes in the client runtime, as the server already does them.

## Log

- 2026-10-27: the review of #262 found a cheaper design in the compiler, within budget: the codegen writes the scoped b-on entries of a dynamic tag, and the server drops its own scope code. So markup.ts, server.ts and the render snapshots are part of the node.
- 2026-10-27: the compiler design puts a scope on own entries, so updateSpreadEntries needed ownEvents in codegen/client.ts, with a regression test in dynamicKeysLive.brm.
