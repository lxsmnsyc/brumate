---
id: memo-error-resume
title: A memo that failed on the server holds its error in the browser
status: done
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "holds the server error after resume"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/memoErrorResume*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/serial.ts
  - packages/brumate/src/runtime/shared.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on:
  - on: memo-errors-server
    kind: hard
    why: it makes the server hold a memo's error, which this node writes into the page
  - on: batching
    kind: hard
    why: both change updates.ts
---

# A memo that failed on the server holds its error in the browser

## Goal

When a memo fails on the server, the page state sends `undefined` for its slot. After resume, browser code that reads the memo without it computing again, such as a handler, an effect or a binding outside the `#try`, gets `undefined` instead of the error. Write the held error into the page state so the browser holds it as a `MemoError`, and each read throws, as it would had the memo failed in the browser.

## Context

- Found in the fix round of memo-errors-server (#291). Read its outcome. Sending the error as a rejected promise failed the whole response stream, because the `onError` path calls `pending().fail(...)`.
- Likely shape: a serial plugin in runtime/serial.ts and a class in shared.ts for a held error, which the client turns into `MemoError` on resume. Decide what of the error is sent: in production, send no message or stack the app did not choose to show; follow how other errors reach the browser.
- This adds browser bytes; keep them in the code that loads only when a page has such a memo, if the codegen can tell.

## Acceptance

- [ ] Test: a memo that fails on the server, read after resume by a handler, throws the error to the nearest `#try`, and does not read `undefined`.
- [ ] The response stream does not fail; the page renders its `#catch` as before.
- [ ] Production pages do not leak the error's stack.
- [ ] Todos gzip within 0.1 kB of main.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: a serial format for a held error and its resume.
