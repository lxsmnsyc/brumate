---
id: release-0.8
title: Release brumate 0.8.0
status: todo
priority: must
type: release
outline: false
milestone: 0.8.0
target: main
from: release/0.8
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-09
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: render-memo-reads
    kind: hard
    why: a must of 0.8.0 (added 2026-11-10)
  - on: seroval-1-8
    kind: hard
    why: a must of 0.8.0 (added 2026-11-10)
  - on: skill-tasks
    kind: hard
    why: a must of 0.8.0 (added 2026-11-10)
  - on: dev-dock-redesign
    kind: hard
    why: a must feature of the 0.8.0 cut
  - on: devtools-copy
    kind: hard
    why: a must feature of the 0.8.0 cut
  - on: color-scheme
    kind: hard
    why: a must feature of the 0.8.0 cut
  - on: context-menu
    kind: hard
    why: a must feature of the 0.8.0 cut
  - on: popover-group-alert
    kind: hard
    why: a must feature of the 0.8.0 cut
  - on: derived-stores
    kind: hard
    why: a must feature of the 0.8.0 cut
  - on: head-rerun-scripts
    kind: hard
    why: a must feature of the 0.8.0 cut
  - on: block-styles
    kind: hard
    why: a must feature of the 0.8.0 cut
  - on: dev-setup-in-plugin
    kind: hard
    why: a must feature of the 0.8.0 cut
---

# Release brumate 0.8.0

## Goal

Promote `release/0.8` to `main` and publish brumate 0.8.0 and @brumate/ui, with the other packages at the versions their changesets give.

## Context

- The cut is docs/debates/0.8.0-cut/debate.md: 10 must features. Open should and could nodes move to the next minor when this node starts.
- Same checks as release-0.7: `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `node e2e/run.mjs`, `pnpm --filter website check:samples`, `pnpm --filter website build`, `pnpm bench --only brumate --scenario todos` against 0.7.0 (13.8 kB gzip JS before `load`), and `npm pack --dry-run` with no test fixtures.
- After the promotion merges, check and hand the Version Packages pull request to the maintainer. The orchestrator merges neither (`gate: true`). Then cut `release/0.9` from `main` and close `release/0.8`.

## Acceptance

- [ ] Open should and could nodes of 0.8.0 are moved to the next milestone, and the changesets on `release/0.8` are merged.
- [ ] All checks pass; the results are in the outcome.
- [ ] Todos gzip JS before `load` is no larger than 0.7.0 (13.8 kB), or the outcome names the node that grew it and by how much.
- [ ] The maintainer merges the promotion and the Version Packages pull requests, and brumate 0.8.0 is on npm.

## Sizing

S: checks, a changeset pass and two pull requests.
