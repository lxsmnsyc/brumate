---
id: loading-on
title: "`#loading (memo)` shows its fallback again when the memo loads again in the browser"
status: todo
priority: must
type: feature
story: browser-async
outline: true
milestone: 0.5.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-29
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: loading-header-error
    kind: hard
    why: replaces the compile error with the meaning of the header
  - on: streamed-memo-reads
    kind: hard
    why: both read pending() of a streamed slot, so the first-settle rule should match
  - on: browser-loading-fallback
    kind: hard
    why: it shows the fallback again through the same browser boundary
---

# `#loading (memo)` shows its fallback again when the memo loads again in the browser

## Goal

Today a `#loading` body keeps its stale content while a memo loads again in the browser, and the fallback exists only in the server stream. `#loading (memo) { … } #else { … }` opts in: while a named memo loads again, the boundary hides its body, kept alive as `#offscreen` does, and shows `#else`; when the value lands, the same body comes back. Without a header nothing changes. The fallback shows at once, with no delay.

## Context

- Settled by the debate in [docs/debates/loading-on-update/debate.md](../../../../debates/loading-on-update/debate.md), not approved yet; refine this outline once it is. Prior art: Solid 2's `<Loading on>`.
- Shape from the debate: markers only for header blocks, carrying scope ID, anchor and a first-settle bit; the boundary subscribes to `pending()` (a reload never throws); it arms only after the server's value has landed; it calls `hiding` directly, with no synthetic `#offscreen`, so scope IDs match the server; `#else` ships only for header blocks, behind a `features.ts` flag. About 0.7 kB gzip plus the `#else` body, only in apps that use it.
- Open risk to test first: that `hiding` finds a `#loading` body that streamed in (debate O10).
- Out of scope: effects and handlers that read a pending memo, which [streamed-memo-reads](../streamed-memo-reads/brief.md) covers.

## Acceptance

- [ ] Refined after the debate is approved.

## Sizing

M: a runtime boundary, markers in codegen, docs and tests.
