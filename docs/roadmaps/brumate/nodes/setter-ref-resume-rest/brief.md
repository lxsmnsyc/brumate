---
id: setter-ref-resume-rest
title: A setter ref in the rest props runs on resume
status: todo
priority: should
type: fix
outline: false
milestone: 0.4.1
target: main
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "a ref bound with a setter"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/runtime/state.ts
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
reserves: []
provides: []
depends_on:
  - on: setter-ref-forward
    kind: hard
    why: it calls the setter for a named ref prop on resume, and this node extends it to the rest props
---

# A setter ref in the rest props runs on resume

## Goal

`ref=$bind(x, fn)` that reaches an element through a component's rest props calls `fn` with the element once on resume, for markup the server rendered, as setter-ref-forward does for a named ref prop.

## Context

- The maintainer chose on 2026-10-28 (review of #322) to call the setter on resume, with the named-prop case in #322 and this case as a follow-up.
- The server's `restRef` (server.ts, about line 856) has no slot to write to, so the page state needs a new record that names the element and the binding, and the client reads it at load. Keep the record small: size comes first (within 0.3 kB on todos, likely far less since todos has no such ref).
- Reuse `send` and the `given` dedupe from setter-ref-forward, so a later spread update does not call `fn` again.

## Acceptance

- [ ] A test: a server-rendered component that spreads its rest with a setter ref calls `fn` once on resume with the element, and not again on a spread update.
- [ ] The todos size is reported.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one page-state record, its write on the server and its read at load.
