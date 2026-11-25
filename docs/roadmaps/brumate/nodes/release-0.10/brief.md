---
id: release-0.10
title: Release brumate 0.10.0
status: todo
priority: must
type: release
story:
early: false
outline: false
milestone: 0.10.0
target: main
ship: auto
land: auto
from: release/0.10
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-25
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: client-scripts
    kind: hard
    why: the must feature of 0.10.0
  - on: clone-remaining-bodies
    kind: hard
    why: a should of the 0.10.0 cut (the maintainer, 2026-11-25)
  - on: no-client-html
    kind: hard
    why: a should of the 0.10.0 cut
  - on: fixed-walks
    kind: hard
    why: a should of the 0.10.0 cut
  - on: part-guides
    kind: hard
    why: a should of the 0.10.0 cut
  - on: state-dedupe-spike
    kind: hard
    why: a should of the 0.10.0 cut; a no-go closes it without code
---

# Release brumate 0.10.0

## Goal

Promote `release/0.10` to `main` and publish brumate 0.10.0 and @brumate/ui, with the other packages at the versions their changesets give.

## Context

- The cut was settled in chat on 2026-11-25, with no debate: one must story (client-scripts) and the should nodes above. i18n was dropped (Paraglide), brumate-node was dropped (Nitro and `srvx/node`), images and markdown-plugin stay in the backlog.
- `release/0.10` was cut from `main` at b3311eb1 when release-0.9 ended.
- Same checks as release-0.9. Todos gzip JS before `load` is recorded against 0.9.0 (14.6 kB), not gated.
- The promotion goes to `main` as a pull request, and the Version Packages pull request follows. The orchestrator merges neither (`gate: true`).

## Acceptance

- [ ] Open should and could nodes of 0.10.0 are moved to the next milestone, and the changesets on `release/0.10` are merged.
- [ ] All checks pass; the results and the todos size are in the outcome.
- [ ] The maintainer merges the promotion and the Version Packages pull requests, and brumate 0.10.0 is on npm.

## Sizing

S: checks, a changeset pass and two pull requests.
