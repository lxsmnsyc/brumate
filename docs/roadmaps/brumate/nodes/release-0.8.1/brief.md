---
id: release-0.8.1
title: Release brumate 0.8.1
status: todo
priority: must
type: release
story:
early: false
outline: false
milestone: 0.8.1
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
  - on: ref-element-writes
    kind: hard
    why: a fix of the 0.8.1 milestone
  - on: template-context
    kind: hard
    why: a fix of the 0.8.1 milestone
  - on: pending-read
    kind: hard
    why: a fix of the 0.8.1 milestone
  - on: children-rerender
    kind: hard
    why: a fix of the 0.8.1 milestone
  - on: resume-test-races
    kind: hard
    why: a fix of the 0.8.1 milestone
---

# Release brumate 0.8.1

## Goal

Publish brumate 0.8.1 with the patch fixes of the 0.8.1 milestone, then merge `main` into `release/0.9`.

## Context

- Bugs found on `main` while 0.9.0 is built join this milestone, so it stays open until the maintainer asks for the release.

## Acceptance

- [ ] The maintainer merges the Version Packages pull request, and brumate 0.8.1 is on npm.
- [ ] `release/0.9` holds `main` (merge pushed directly, after the checks).

## Sizing

S: checks and one hand-off.
