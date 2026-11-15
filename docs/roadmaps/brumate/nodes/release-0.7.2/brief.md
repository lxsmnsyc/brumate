---
id: release-0.7.2
title: Release brumate 0.7.2
status: released
priority: must
type: release
outline: false
milestone: 0.7.2
target: main
from: main
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-15
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

# Release brumate 0.7.2

## Goal

Publish brumate 0.7.2 with the Trusted Types fix, then merge `main` into `release/0.8`.

## Context

- Added after the fact (2026-11-15). The fix (77fbd11b: navigation and devtools markup pass through the Trusted Types policy) went from `release/0.7.2` to `main` in #517, outside the roadmap.

## Acceptance

- [x] The maintainer merges the Version Packages pull request, and brumate 0.7.2 is on npm.
- [ ] `release/0.8` holds `main` (merge pushed directly, after the checks).

## Sizing

S: one fix and one hand-off.
