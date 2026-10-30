---
id: streamed-loading-errors
title: An error inside a streamed #loading body reaches its #catch
status: done
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
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/**
  - website/docs/async-data.md
reserves: []
provides: []
depends_on: []
---

# An error inside a streamed #loading body reaches its #catch

## Goal

Found by promise-prop-memo (#373, 2026-10-30): when a promise rejects inside a `#loading` body that the server streams, the page shows neither the body nor the nearest `#catch`. The fallback stays forever, and the server only logs the error. The wave 14 checkpoint also noted a related case: a server stream that is cut (the connection ends early) leaves `#loading` bodies and effects pending forever (debate pending-handler-reads, O7 and O9).

Make both end: a rejection inside a streamed `#loading` body renders the nearest `#catch` (inside or around the boundary, the same one a server render without streaming would pick), on the server stream and after resume; a cut stream settles the pending boundaries as errors (or reloads, decide and document) instead of hanging.

A bug on main: branch from main, its own PR. Probe first: confirm both on main with the smallest page.

## Acceptance

- [ ] A test: a memo that rejects inside a streamed `#loading` body shows the `#catch` body, with the error's message in dev and the generic one in production. It fails on main.
- [ ] A test: a stream cut before a `#loading` body arrives leaves no boundary pending forever; the chosen behavior is documented in website/docs/async-data.md.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: the streamed error path on the server and the client, the cut stream, tests and docs.
