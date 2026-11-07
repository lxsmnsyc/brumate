---
id: release-0.7
title: Release brumate 0.7.0
status: active
priority: must
type: release
outline: false
milestone: 0.7.0
target: main
from: next
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-07
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: context-stores
    kind: hard
    why: a must node of the 0.7.0 cut
  - on: memo-guard
    kind: hard
    why: a must node of the 0.7.0 cut
  - on: conditional-rest-spread
    kind: hard
    why: a must node of the 0.7.0 cut
  - on: control-target
    kind: hard
    why: a must node of the 0.7.0 cut
  - on: mathml-elements
    kind: hard
    why: a must node of the 0.7.0 cut
  - on: missing-attributes
    kind: hard
    why: a must node of the 0.7.0 cut
  - on: graph-node-locations
    kind: hard
    why: a must node of the 0.7.0 cut
  - on: skill-command-packages
    kind: hard
    why: a must node of the 0.7.0 cut
  - on: popover-sizing
    kind: hard
    why: a must node of the 0.7.0 cut
  - on: fieldset
    kind: hard
    why: a must node of the 0.7.0 cut
  - on: is-pending-many
    kind: hard
    why: a must node of the 0.7.0 cut
  - on: split-ui-examples
    kind: hard
    why: a must node of the 0.7.0 cut
---

# Release brumate 0.7.0

## Goal

Promote `next` to `main` and publish brumate 0.7.0 and @brumate/ui, with the other packages at the versions their changesets give.

## Context

- The cut is docs/debates/0.7.0-cut/debate.md: 11 must features (GOAL.md, Milestones). The open should and could nodes moved to 0.8.0 when this node started.
- Changesets: merge the pending ones on `next` on the promotion branch (one commit, none dropped without a reason).
- Before the promotion pull request (`next` -> `main`): `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` and `node e2e/run.mjs` pass on a quiet machine, `pnpm --filter website check:samples` and `pnpm --filter website build` pass, `pnpm bench --only brumate --scenario todos` is recorded against 0.6.0 (13.6 kB gzip JS before `load`), and `pnpm pack --dry-run` shows no test fixtures.
- After the promotion merges, check and hand the Version Packages pull request to the maintainer. The orchestrator merges neither (`gate: true`).

## Acceptance

- [ ] The open should nodes of 0.7.0 are moved to 0.8.0, and the changesets on `next` are merged.
- [ ] Build, lint, format, typecheck, tests, e2e, website, bench and pack checks pass; the results are in the outcome.
- [ ] Todos gzip JS before `load` is no larger than 0.6.0 (13.6 kB), or the outcome names the node that grew it and by how much.
- [ ] The maintainer merges the promotion and the Version Packages pull requests, and brumate 0.7.0 is on npm.

## Sizing

S: checks, a changeset pass and two pull requests.
