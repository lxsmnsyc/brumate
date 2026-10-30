---
id: promise-prop-memo
title: A promise prop is a plain promise in the child
status: active
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/test/**
  - packages/brumate/skills/brumate/references/errors.md
  - website/docs/errors.md
  - website/docs/async-data.md
reserves: []
provides: []
depends_on:
  - on: streamed-memo-reads
    kind: hard
    why: it adds BRM182 and the async-value rules for promise props, and edits analyze.ts, error-catalog.ts and async-data.md
---

# A promise prop is a plain promise in the child

## Goal

Reworked on 2026-10-30 (the maintainer, on PR #373): a prop is a value like any other, and a promise prop is no exception. Today the browser unwraps it: packages/brumate/src/runtime/client/props.ts (about lines 57-60) turns a thenable prop into an async memo, and resume.ts replaces a streamed promise prop with its value. The child's type says `Promise<T>` while the value becomes `T`, so `user.then(...)` and `await user` break once it lands. #373 first answered this with compile error BRM186 (every read through `$memo`); the maintainer dropped that.

Instead: stop the unwrap. In the browser a promise prop stays a promise. On resume, a promise prop that the server streamed becomes a promise again, settled with the streamed value (or rejected with the streamed error), not the bare value. `await user`, `user.then(...)` and passing it on work everywhere. `$memo(user)` stays the way to get a pending-aware value with `#loading`. The server render must agree with the browser (check how the server treats a promise prop today and keep both sides the same).

This supersedes Q6 of docs/debates/pending-handler-reads/debate.md: record the change in docs/decisions.md and update website/docs/async-data.md ("Promises as props").

## Acceptance

- [ ] A child that does `await user` or `user.then(...)` in a handler, an effect and a `$client` callback gets the value both before and after the promise settles, after a client render and after resume of a streamed prop. Tests fail on main.
- [ ] `$memo(user)` still gives the async value, pending until it settles, with `#loading`.
- [ ] No BRM186: the code, catalog entry, docs and tests from the first version of #373 are gone; BRM186 is free again.
- [ ] The docs samples, @brumate/ui, the examples and the website compile and render (`pnpm --filter website check:samples && pnpm --filter website build`); any code that relied on the unwrap is moved to `$memo(prop)`.
- [ ] The todos size is reported (within 0.3 kB gzip of main).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: the prop write and resume in the runtime, the server side if it differs, tests, docs and a decision record.
