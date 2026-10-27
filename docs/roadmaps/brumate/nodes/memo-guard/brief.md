---
id: memo-guard
title: A memo with a guard on its new value
status: todo
priority: could
type: feature
outline: false
milestone: features
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "guard"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/guard*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/signals.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/macros.ts
  - packages/brumate/src/check.ts
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/test/resume.test.ts
  - docs/decisions.md
  - website/docs/**
reserves: []
provides: []
depends_on:
  - on: batching
    kind: hard
    why: both change how a memo's slot is written in updates.ts
---

# A memo with a guard on its new value

## Goal

A new compile-time function, `$filter(value, (prev, next) => boolean)` (name to be confirmed by the maintainer before the PR, see Name), is a memo whose new value is taken only when the guard returns true. Otherwise it keeps its previous value and its readers do not run. One function covers a gate and a custom equality:

```ts
const query = $filter(input, (_, next) => next.length >= 2);
const items = $filter(list.filter(done), (prev, next) => !sameItems(prev, next));
```

`$memo` keeps one argument; there is no options object.

## Rules (the maintainer, 2026-10-27)

1. The guard returns true to let the new value through. A plain `$memo` is `$filter(x, (a, b) => !Object.is(a, b))`.
2. The first value always passes and skips the guard. The guard runs only on changes, with the previous value. On the server, with no history, the value is the source's value; the browser guards from it after resume.
3. The first argument is any expression, tracked like `$memo`'s.
4. Async is not supported: a promise or async iterable as the value is a compile error with a catalog entry. Loading belongs to `$memo`.
5. A guard that throws makes the value hold the error, like a memo whose compute throws; each read rethrows (see the memo-errors-at-read outcome).
6. Cost: plain memos pay nothing. The update code calls the guard in place of `Object.is` only for these slots.

## Name

The orchestrator suggested `$gate` over `$filter`: `filter` reads as filtering the items of an array (`list.filter`), and `$guard` reads as a TypeScript type guard. The maintainer decides; use the chosen name everywhere.

## Acceptance

- [ ] Tests: a gate that holds its value while the guard fails and its readers do not run; a custom equality on a new array with the same items does not run its readers; the first value passes on the server and after resume; a throwing guard reaches the nearest `#try`; an async value is a compile error.
- [ ] docs/decisions.md lists the new compile-time function; website/docs documents it next to `$memo`.
- [ ] The gzip size of the eager core grows by at most 0.1 kB; todos does not change.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: a compile-time function through the analyzer, both codegens and the update code, with docs.
