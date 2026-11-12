---
id: drop-marker-index
title: Remove the marker index and the HTML string path
status: dropped
priority: later
type: refactor
outline: false
milestone: backlog
target:
from:
size: L
spike: false
verify: pnpm --filter brumate exec vitest run
exclusive: [bench]
fulfilled_by: 
gate: false
added: 
owns:
  - packages/brumate/src/runtime/client/blocks.ts
  - packages/brumate/src/runtime/boot.ts
  - packages/brumate/src/codegen/markup.ts
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/src/runtime/client/insert.ts
  - packages/brumate/src/runtime/client/children.ts
  - packages/brumate/src/runtime/client/templates.ts
reserves: []
provides: []
depends_on:
  - on: size-baseline
    kind: hard
    why: the step reports its size against the baseline
  - on: split-client-runtime
    kind: hard
    why: it rewrites client/blocks.ts, which the split creates
  - on: visible-forwarded-ref
    kind: hard
    why: both rewrite the b-near code of markup.ts and boot.ts
---

> Dropped on 2026-11-12 (the maintainer, docs/debates/0.9.0-cut/debate.md): its rule that no browser-rendered body falls back to an HTML string lives in no-html-string-fallback (done), clone-remaining-bodies and no-client-html. What is left, removing the MutationObserver, saves almost nothing, and streaming and `#defer` rely on its markers.

# Remove the marker index and the HTML string path

## Goal

Finish step 3: every body that the browser renders is a cloned template, so the MutationObserver index of markers, the `clientHTML` path and their scans go.

## Context

- Parked on 2026-11-02 by the client-restructure debate (docs/debates/client-restructure/debate.md, O7, Q4): it saves almost nothing on todos. Its rule that no browser-rendered body falls back to an HTML string moved to no-html-string-fallback.

- Clones are in (#149-#166). `markerObserver` still runs when `HAS_LATE_MARKUP`, in client.ts and boot.ts. Streaming and `#defer` rely on the markers.
- Size, audit of 2026-11-01: this node removes almost nothing from todos. Feature flags already prune the string path and the MutationObserver there (`CLIENT_HTML` adds 535 B min / 181 B gzip, `LATE_MARKUP` about 190 B min). Pages that use the HTML path gain about 0.5-0.8 kB min (0.2-0.3 kB gzip). `parseHTML` and `insertHTML` stay for `raw()` values, arrays and spreads; `indexMarkers` and `findComment` stay for server markup. The value is a simpler runtime, not a smaller todos.
- Source: [A smaller and faster client, step 3](../../../../proposals.md#steps)

## Acceptance

- [ ] No MutationObserver in the client runtime.
- [ ] The tests of streaming, `#offscreen` and `#defer` pass.
- [ ] The gzip size of todos is smaller than the baseline.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

L: blast radius high (core rendering), size medium.
