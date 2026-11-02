---
id: loading-on
title: "`#loading (memo)` shows its fallback again while a named memo loads"
status: active
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
added: 2026-10-29
spent:
owns: []
shared:
  - .changeset/*.md
  - docs/grammar.md
  - docs/decisions.md
  - packages/brumate/src/parser.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/check.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/src/features.ts
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
  - website/docs/async-data.md
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

# `#loading (memo)` shows its fallback again while a named memo loads

## Goal

An author makes a memo's update show the fallback by naming it: `#loading (posts) { … } #else { … }`. Once the body has shown, the boundary shows `#else` while a named memo, or a memo upstream of it, is pending, for any cause. The body is hidden under the `#offscreen` rules and comes back with the same nodes. Without a header nothing changes.

## Context

- Settled by [docs/debates/loading-reload/debate.md](../../../../debates/loading-reload/debate.md) (approved 2026-11-02), which supersedes loading-on-update. Read its settled structure; this brief lists what to build.
- Header: each name is a memo of the component or of a block script around the block, and markup in the body reads it; anything else is a compile error (reserve a BRMnnn). The held set for a name `m` is `[m, ...upstreamMemos(m)]` (model.ts:234), the set `$isPending(m)` reads, so `#loading (baz)` holds while `bar` loads when `baz = $memo(bar)`. The header compiles to one more reader of the slots' pending state (`startLoading` triggers readers), with no new subscription.
- Hold: call the existing `hiding` on the body scope and render `#else` (debate O5); updates keep reaching the hidden body. Release when no held memo is pending. No nested join: a branch that loads under the hidden body uses its own `#loading` (O9, O13). The client-pending-boundary contract does not change.
- Server and resume: a header block renders as a block without a header, plus a marker that carries the scope ID and anchor (O7). Only header blocks ship markers and `#else`, behind a features.ts flag.
- Warnings and docs: a compile warning for a named memo that is or reads `$debounced` or `$throttled`. The docs say to name the last memo of a chain, to keep the control that writes a named memo's input outside the body, that a child component's own memo is not held, and show the `#key (id)` idiom for a new record with fresh state.
- Builds on browser-loading-fallback's browser `#loading`. Replaces the `loading-header-error` compile error.

## Acceptance

- [ ] First test: `hiding` finds a `#loading` body that the server streamed in, and the header re-shows `#else` over it (debate open risk).
- [ ] Tests in packages/brumate/test/resume.test.ts: a write to a named memo's input shows `#else` and then the same DOM nodes and input state; an action's `refresh()` does the same; a chained memo (`#loading (baz)` with `bar` upstream); an unnamed memo keeps stale content; effects and listeners in the hidden body pause; the compile error for a name the body does not read; the `$debounced` warning.
- [ ] Size: todos 0 B (`pnpm bench --only brumate --scenario todos`); the measured gzip cost of an app with one header block, with and without `#offscreen`, in outcome.md for the maintainer (the estimate is up to about 1.3 kB without `#offscreen`).
- [ ] website/docs/async-data.md, docs/grammar.md and docs/decisions.md describe the header; a minor changeset.

## Sizing

M: parser and analyzer for the header, client codegen and the hold on `hiding`, the server marker, tests and docs. About 450k tokens (debate P19).
