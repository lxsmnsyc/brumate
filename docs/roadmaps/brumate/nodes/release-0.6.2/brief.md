---
id: release-0.6.2
title: Release brumate 0.6.2
status: done
priority: must
type: release
outline: false
milestone: 0.6.2
target: main
from: main
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-07
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: imported-function-prop
    kind: hard
    why: an imported function as a component prop fails the build on 0.6.1
  - on: devtools-defer-failed
    kind: hard
    why: a #defer block that gets no body shows as loading forever in the devtools on 0.6.1
---

# Release brumate 0.6.2

## Goal

Publish brumate 0.6.2 with the patch fixes of the 0.6.2 milestone, then sync `next` with `main`.

## Context

- Fixes of 0.6.1 behavior found during 0.7.0 work, from `main`: #490 and #492.
- The Version Packages pull request #491 bumps brumate to 0.6.2 and the language packages to their next patch.

## Acceptance

- [x] brumate 0.6.2 is on npm (`latest`), from #491 (9606c0da).
- [x] `next` holds `main` (a77b4934, pushed directly).

## Sizing

S: checks and one hand-off.
