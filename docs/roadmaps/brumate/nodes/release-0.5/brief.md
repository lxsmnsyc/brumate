---
id: release-0.5
title: Release brumate 0.5.0
status: todo
priority: must
type: release
story:
early: false
outline: false
milestone: 0.5.0
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
added: 2026-11-01
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: release-0.4.2
    kind: hard
    why: the 0.4.2 hotfixes reach next through its sync before the promotion
  - on: usage-pruning-flags
    kind: hard
    why: the five flags take todos below the 0.4.1 figure (the maintainer said go on 2026-11-01)
  - on: bundle-urls-from-server
    kind: hard
    why: the client entry drops its bundle tables, a size goal of 0.5.0
  - on: drop-marker-index
    kind: hard
    why: the marker index and the HTML string path go, a size goal of 0.5.0
  - on: browser-async
    kind: hard
    why: await, #loading and promises wait in markup that the browser renders
---

# Release brumate 0.5.0

## Goal

Promote `next` to `main` and publish brumate 0.5.0, with @brumate/ui and the other packages at the versions their changesets give.

## Context

- The maintainer set the must line on 2026-11-01: the smaller client (usage-pruning-spike, bundle-urls-from-server, drop-marker-index) and the browser-async story. Should nodes of 0.5.0 that have merged into `next` by then ship too. The ones still open move to 0.6.0 when this node starts.
- Changesets: trim and merge the pending ones on `next` first, as changeset-review did for 0.4.0. Breaking changes are minor bumps in 0.x.
- Before the promotion pull request (`next` -> `main`): `pnpm build && pnpm test && node e2e/run.mjs` pass on `next`, `pnpm --filter website check:samples && pnpm --filter website build` pass, `pnpm bench` todos gzip JS before `load` is below the 0.4.1 figure (14.8 kB) and recorded, and `pnpm pack --dry-run` shows no test fixtures.
- After the promotion merges, check and hand the Version Packages pull request to the maintainer. The orchestrator merges neither (`gate: true`).

## Acceptance

- [ ] The open should nodes of 0.5.0 are moved to 0.6.0, and the changesets on `next` are trimmed.
- [ ] Build, tests, e2e, website, bench and pack checks pass on `next`; the results are in the outcome.
- [ ] Todos gzip JS before `load` is below the 0.4.1 figure (14.8 kB).
- [ ] The maintainer merges the promotion and the Version Packages pull requests, and brumate 0.5.0 is on npm.

## Sizing

S: checks, a changeset pass and two pull requests.
