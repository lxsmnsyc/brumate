---
id: promise-prop-memo
title: A promise prop is read through $memo in the child
status: todo
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
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
reserves: [BRM186]
provides: []
depends_on:
  - on: streamed-memo-reads
    kind: hard
    why: it adds BRM182 and the async-value rules for promise props, and edits analyze.ts, error-catalog.ts and async-data.md
---

# A promise prop is read through $memo in the child

## Goal

A prop typed `Promise<T>` is loaded as an async value at runtime: props.ts:57-60 turns a promise prop into an async memo, and resume.ts replaces a streamed promise slot with its value. Its type stays `Promise<T>`, so `user.name` does not type-check and `user.then(...)` breaks once the value lands. The maintainer chose (debate pending-handler-reads, Q6) to keep the `Promise<T>` type and require the child to read the prop through `$memo(prop)` before any other read.

## Context

- Debate: docs/debates/pending-handler-reads/debate.md, part 6 of the settled structure, claims O4, O12, P12 and fact J16.
- docs/decisions.md:26 and website/docs/async-data.md ("Promises as props") already show `$memo(user)` in the child.

## Acceptance

- [ ] A read of a prop typed as a promise anywhere except as the argument of `$memo(...)` (or passing it on as a prop) is a compile error with BRM186 (BRM185 goes to parser-closed-nesting), whose message names the prop and the fix.
- [ ] The docs samples, @brumate/ui, the examples and the website compile.
- [ ] Tests for the error and for `$memo(prop)` in markup, a handler and an effect.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one analyzer rule, its code, docs and tests.
