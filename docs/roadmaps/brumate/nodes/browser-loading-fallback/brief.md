---
id: browser-loading-fallback
title: "#loading shows its fallback in markup that the browser renders"
status: todo
priority: must
type: feature
story: browser-async
outline: false
milestone: 0.5.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns:
  - packages/brumate/src/codegen/**
  - packages/brumate/test/resume.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: browser-await
    kind: contract
    via: client-pending-boundary
  - on: memo-prop-browser-child
    kind: hard
    why: it makes a memo of a promise prop load in a browser-rendered child, with empty text while pending
---

# #loading shows its fallback in markup that the browser renders

## Goal

In markup that the browser renders (a branch of an `#if` that changes, a `#for` item added later, a component inside them), `#loading` renders its body at once and never ships its `#else` fallback. A memo that is still pending shows as empty text (since memo-prop-browser-child, #379) instead of the fallback. Make a browser-rendered `#loading` behave as a streamed one does: the fallback while any memo its body reads is pending, then the body; on an update, keep the current content until the new values land.

## Context

- Found by memo-prop-browser-child (#379, 2026-10-30); the maintainer moved it to 0.5.0.
- website/docs/async-data.md already says `await $memo(…)` does not wait in a browser-rendered component yet; this node and browser-await-spike close that.
- Needs a compiler change: a client-side block that follows its memos' pending state, and shipping the fallback markup for blocks the browser can render. Weigh the size cost.
- Relates to promise-in-markup (0.5.0): a promise in text or an attribute makes its boundary pending, which needs the same client-side boundary.

## Decisions (2026-11-01)

- Refined from browser-await-spike: compile `#loading` in client mode to `$$b.loading(body, fallback)` on the `client-pending-boundary` contract, with `#reveal` order (one promise chain per `#reveal`) and `#try` around it. Ship the `#else` markup only for `#loading` blocks the browser can render; weigh the size.

## Acceptance

- [ ] In an `#if` branch and a `#for` row the browser renders, `#loading` shows `#else` while a memo its body reads is pending, then the body; on an update it keeps its content.
- [ ] `#reveal` shows the boundaries in order.
- [ ] Todos gzip: 0 B change.

## Sizing

M: one codegen path on the frozen boundary, and tests.
