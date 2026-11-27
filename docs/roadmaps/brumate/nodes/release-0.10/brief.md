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
  - on: release-0.9.1
    kind: hard
    why: the 0.10.0 docs say kept pages get the request's nonce from 0.9.1 (kept-page-nonce)
  - on: docs-audit
    kind: hard
    why: the docs match the code before the release (the maintainer, 2026-11-27)
---

# Release brumate 0.10.0

## Goal

Promote `release/0.10` to `main` and publish brumate 0.10.0 and @brumate/ui, with the other packages at the versions their changesets give.

## Context

- The cut was settled in chat on 2026-11-25, with no debate: one must story (client-scripts), and should nodes clone-remaining-bodies, no-client-html, fixed-walks, part-guides and state-dedupe-spike. A should node still open when this node starts moves to the next milestone. i18n was dropped (Paraglide), brumate-node was dropped (Nitro and `srvx/node`), images and markdown-plugin stay in the backlog.
- `release/0.10` was cut from `main` at b3311eb1 when release-0.9 ended.
- Same checks as release-0.9. Todos gzip JS before `load` is recorded against 0.9.0 (14.6 kB), not gated.
- The promotion goes to `main` as a pull request, and the Version Packages pull request follows. The orchestrator merges neither (`gate: true`).

## Acceptance

- [ ] Open should and could nodes of 0.10.0 are moved to the next milestone, and the changesets on `release/0.10` are merged.
- [ ] All checks pass; the results and the todos size are in the outcome.
- [ ] The maintainer merges the promotion and the Version Packages pull requests, and brumate 0.10.0 is on npm.

## Sizing

S: checks, a changeset pass and two pull requests.
