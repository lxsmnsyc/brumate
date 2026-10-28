---
id: memo-errors-at-read
title: A memo that throws holds the error, and a read of it throws
status: done
priority: must
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "memo error"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/memoError*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/src/runtime/client/errors.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/test/resume.test.ts
  - website/docs/effects.md
  - website/docs/async-data.md
  - docs/decisions.md
reserves: []
provides: []
depends_on:
  - on: ordered-updates
    kind: hard
    why: it replaces the error rule of the pass that ordered-updates adds
---

# A memo that throws holds the error, and a read of it throws

## Goal

A memo whose compute throws, or whose promise rejects, holds the error as its value. Each read of the memo throws that error, so it goes to the nearest `#try` around the code that read it: an insert, a binding, another memo, an effect or a handler. Code that does not read the memo runs as usual. When the memo computes again without a throw, it holds the value again. This is how Solid and Compostate treat a memo error, and it matches how a memo already holds a pending promise as its state.

## Context

- The maintainer's rule, 2026-10-27: a memo's error is part of its result, so it should only be thrown where it is read.
- ordered-updates (#282) routes the error to the `#try` around the memo and then stops the rest of the pass. Its reviews (round 5, reviews/memo-errors.md) showed the limits: an effect of the pass reads the memo's old value, and readers before the throw are updated while readers after it are not. With this rule the pass needs no error rule: every update runs, and an update that reads the failed memo throws into its own `#try`. Remove the stop-the-pass code of #282 that this makes unneeded, and measure the size.
- Today a rejected async memo keeps its old value and logs the error (website/docs/async-data.md:122). That changes: it holds the error until it computes again.
- A memo that nothing reads keeps its error silently, as in Solid. Log it in DEV.
- The server render follows the same rule: a memo that throws during the render fails at its read, so a `#try` around the read renders its `#catch` on the server too.
- Write the rule in docs/decisions.md, and update website/docs/effects.md (the error section, about line 289) and async-data.md.

## Acceptance

- [ ] Tests from reviews/memo-errors.md, each failing on main or on #282's head and passing with the fix:
  - an effect that reads `count` and the failed memo throws into its `#try`, and never sees the old value with the new `count`;
  - in one write, an `#if` that reads only `count` updates, while an insert that reads the failed memo shows its `#catch`;
  - a `#try` around the read catches the error, also when the write waited for the code;
  - a handler that writes goes on after the write, and a handler that reads the failed memo throws into the `#try` around the handler;
  - the memo holds the value again after a write that makes it compute without a throw;
  - a rejected async memo throws at its read;
  - the same rule on the server render.
- [ ] The packages/brumate and packages/ui suites pass, and the full check (`pnpm build && pnpm test && node e2e/run.mjs`) passes.
- [ ] docs/decisions.md has the rule; the two website docs describe it.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: the read path of memos on the client and the server, the removal of the pass's error rule, and the docs.

PR: #287
