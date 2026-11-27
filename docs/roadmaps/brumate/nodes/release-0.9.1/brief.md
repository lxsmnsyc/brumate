---
id: release-0.9.1
title: Release brumate 0.9.1
status: todo
priority: should
type: release
story:
early: false
outline: false
milestone: 0.9.1
target: main
ship: auto
land: auto
from: main
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-26
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: memo-template-resume
    kind: hard
    why: the patch fix of 0.9.1
  - on: svg-ambiguous-clone
    kind: hard
    why: a patch fix of 0.9.1
  - on: kept-page-nonce
    kind: hard
    why: a patch fix of 0.9.1
  - on: stop-ends-loads
    kind: hard
    why: a patch fix of 0.9.1 (the module memo flake)
---

# Release brumate 0.9.1

## Goal

Publish brumate 0.9.1 with the hotfixes of the 0.9.1 milestone, then merge `main` into `release/0.10`.

## Context

- The 0.10.0 nodes go first (patch-after-minor); new bugs found on `main` meanwhile join this milestone.
- The maintainer merges the Version Packages pull request (`gate: true`).

## Acceptance

- [ ] brumate 0.9.1 is on npm.
- [ ] `release/0.10` holds `main` (merge pushed directly, after the checks).

## Sizing

S: a Version Packages pull request and a merge.
