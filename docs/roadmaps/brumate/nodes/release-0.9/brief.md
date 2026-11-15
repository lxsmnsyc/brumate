---
id: release-0.9
title: Release brumate 0.9.0
status: todo
priority: must
type: release
story:
early: false
outline: false
milestone: 0.9.0
target: main
ship: auto
land: auto
from: release/0.9
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-12
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: partial-route-responses
    kind: hard
    why: a must feature of the 0.9.0 cut
  - on: external-scripts
    kind: hard
    why: a must feature of the 0.9.0 cut
  - on: async-effects
    kind: hard
    why: a must feature of the 0.9.0 cut
  - on: produce-map-set
    kind: hard
    why: a must feature of the 0.9.0 cut
  - on: effect-copy-warning
    kind: hard
    why: a must feature of the 0.9.0 cut
  - on: style-scope-where
    kind: hard
    why: a must feature of the 0.9.0 cut
  - on: mcp-server
    kind: hard
    why: a must feature of the 0.9.0 cut
  - on: observability
    kind: hard
    why: a must feature of the 0.9.0 cut
  - on: skill-0-9-apis
    kind: hard
    why: the skill must teach the 0.9 APIs before the release
  - on: release-0.8.1
    kind: hard
    why: 0.9.0 carries the patch fixes
---

# Release brumate 0.9.0

## Goal

Promote `release/0.9` to `main` and publish brumate 0.9.0 and @brumate/ui, with the other packages at the versions their changesets give.

## Context

- The cut is docs/debates/0.9.0-cut/debate.md: 8 must features. Open should and could nodes move to the next minor when this node starts.
- `release/0.9` is cut from `main` when release-0.8 ends. Until then no 0.9.0 node starts.
- Same checks as release-0.8. Todos gzip JS before `load` is recorded against 0.8.0, not gated (GOAL.md, Constraints).
- After the promotion merges, check and hand the Version Packages pull request to the maintainer. The orchestrator merges neither (`gate: true`).

## Acceptance

- [ ] Open should and could nodes of 0.9.0 are moved to the next milestone, and the changesets on `release/0.9` are merged.
- [ ] All checks pass; the results and the todos size are in the outcome.
- [ ] The maintainer merges the promotion and the Version Packages pull requests, and brumate 0.9.0 is on npm.

## Sizing

S: checks, a changeset pass and two pull requests.
