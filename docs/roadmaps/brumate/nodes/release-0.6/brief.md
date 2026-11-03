---
id: release-0.6
title: Release brumate 0.6.0
status: todo
priority: must
type: release
story:
early: false
outline: false
milestone: 0.6.0
target: main
ship: auto
from: next
size: S
spike: false
hypothesis:
verify:
exclusive: [bench]
fulfilled_by:
gate: true
added: 2026-11-03
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: search-params
    kind: hard
    why: `$searchParam`, state in the URL
  - on: style-global
    kind: hard
    why: `<style global>` for unscoped rules
  - on: aria-types
    kind: hard
    why: typed ARIA attributes and roles
  - on: single-child-blocks
    kind: hard
    why: a block body without braces
  - on: static-contexts
    kind: hard
    why: a server-only context ships no live browser code
  - on: drop-colon-modifiers
    kind: hard
    why: the breaking cleanup of event modifiers in attribute names
  - on: a11y-in-tests
    kind: hard
    why: `checkAccessibility()` in brumate/testing
  - on: llms-txt
    kind: hard
    why: llms.txt and Markdown pages on the website
  - on: drop-unread-memos
    kind: hard
    why: client restructure step 1
  - on: no-html-string-fallback
    kind: hard
    why: client restructure step 2
  - on: differential-render-test
    kind: hard
    why: client restructure step 3
  - on: server-on-error
    kind: hard
    why: onError in src/middleware.ts for errors of the server
  - on: values-spike
    kind: hard
    why: client restructure step 4; its go or no-go is the maintainer's
---

# Release brumate 0.6.0

## Goal

Promote `next` to `main` and publish brumate 0.6.0, with the other packages at the versions their changesets give.

## Context

- The orchestrator picked the 0.6.0 cut on 2026-11-03, at the maintainer's request: eight features and phase 1 of the client restructure as must nodes (GOAL.md, Milestones). Should nodes of 0.6.0 that have merged into `next` by then ship too. The ones still open move to 0.7.0 when this node starts.
- values-spike ends in a go or no-go that the maintainer decides. This release waits for the decision, not for values-build.
- Changesets: merge the pending ones on `next` as release-0.5 did (one commit on the promotion branch, none dropped without a reason).
- Before the promotion pull request (`next` -> `main`): `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` and `node e2e/run.mjs` pass on `next` on a quiet machine, `pnpm --filter website check:samples` and `pnpm --filter website build` pass, `pnpm bench --only brumate --scenario todos` is recorded against 0.5.0 (13.6 kB gzip JS before `load`), and `pnpm pack --dry-run` shows no test fixtures.
- After the promotion merges, check and hand the Version Packages pull request to the maintainer. The orchestrator merges neither (`gate: true`).

## Acceptance

- [ ] The open should nodes of 0.6.0 are moved to 0.7.0, and the changesets on `next` are merged.
- [ ] Build, lint, format, typecheck, tests, e2e, website, bench and pack checks pass on `next`; the results are in the outcome.
- [ ] Todos gzip JS before `load` is no larger than 0.5.0 (13.6 kB), or the outcome names the node that grew it and by how much.
- [ ] The maintainer merges the promotion and the Version Packages pull requests, and brumate 0.6.0 is on npm.

## Sizing

S: checks, a changeset pass and two pull requests.
