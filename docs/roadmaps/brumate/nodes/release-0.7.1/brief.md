---
id: release-0.7.1
title: Release brumate 0.7.1
status: todo
priority: must
type: release
outline: false
milestone: 0.7.1
target: main
from: main
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
  - on: attribute-value-case
    kind: hard
    why: valid enumerated attribute values fail the type check on 0.7.0
  - on: rest-ref-test-wait
    kind: hard
    why: a resume test fails under load on 0.7.0
  - on: live-style-scope-id
    kind: hard
    why: live style variables miss elements the browser renders outside the component's render function (added 2026-11-11)
---

# Release brumate 0.7.1

## Goal

Publish brumate 0.7.1 with the patch fixes of the 0.7.1 milestone, then merge `main` into `release/0.8`.

## Acceptance

- [ ] The maintainer merges the Version Packages pull request, and brumate 0.7.1 is on npm.
- [ ] `release/0.8` holds `main` (merge pushed directly, after the checks).

## Sizing

S: checks and one hand-off.
