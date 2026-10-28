---
id: try-sample-console
title: The #try sample of /docs/control-flow passes the website e2e suite
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
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - website/docs/control-flow.md
  - e2e/suites/website.mjs
  - packages/brumate/src/runtime/**
reserves: []
provides: []
depends_on: []
---

# The #try sample of /docs/control-flow passes the website e2e suite

## Goal

The website e2e flow "/docs/control-flow: 10 live samples render" passes. Today it fails on main with a console error, `Error: Not connected`, from the `#try` sample (website/docs/control-flow.md, about line 213), whose `status()` throws on purpose for `#catch` to render.

## Context

- Found on 2026-10-28 while running e2e for ui-landing (#316); it fails the same way on main (09e06b30). CI does not run e2e.
- Find who logs the caught error: the REPL runner of live samples, the browser runtime of `#try` (#305 logs a server error once), or the e2e `watch` that collects console errors. Then decide: a caught error that `#catch` renders should not count as a console error, or the e2e flow should allow this one sample's expected error. Prefer the fix in the code that logs it, if the log is not useful to an app.
- Run e2e in a worktree with `node e2e/run.mjs --only website --no-build` after building the packages and the website by hand. A plain run calls `pnpm build`, which rewrites the root shims to point into the worktree.

## Acceptance

- [ ] The website e2e suite passes this flow, and the sample still shows `#catch` and recovers on "Connect and try again".
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one log or one test expectation.
