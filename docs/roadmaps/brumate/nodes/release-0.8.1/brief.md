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
depends_on: []
---

# Release brumate 0.8.1

## Goal

Publish brumate 0.8.1 with the patch fixes of the 0.8.1 milestone, then merge `main` into `release/0.9`. If no fix joins the milestone by the time release-0.9 starts, close this node without a release.

## Context

- Bugs found on `main` while 0.9.0 is built join this milestone, so it stays open until the maintainer asks for the release.
- 2026-11-13: the five fixes first planned here (ref-element-writes, template-context, pending-read, children-rerender, resume-test-races) moved to 0.8.0 as should nodes on `release/0.8`, since 0.8.0 was not released yet. Any of them still open when release-0.8 starts comes back here.

## Acceptance

- [ ] The maintainer merges the Version Packages pull request, and brumate 0.8.1 is on npm.
- [ ] `release/0.9` holds `main` (merge pushed directly, after the checks).

## Sizing

S: checks and one hand-off.
