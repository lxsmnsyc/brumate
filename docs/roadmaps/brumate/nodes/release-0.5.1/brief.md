---
id: release-0.5.1
title: Release brumate 0.5.1
status: active
priority: must
type: release
outline: false
milestone: 0.5.1
target: main
from: main
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-03
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: template-import-render
    kind: hard
    why: a page that uses a component only in a #template throws in a browser render on 0.5.0
---

# Release brumate 0.5.1

## Goal

Publish brumate 0.5.1 with the hotfixes of the 0.5.1 milestone, then sync `next` with `main`.

## Context

- As release-0.4.4: run `pnpm build`, `pnpm test`, `node e2e/run.mjs`, the todos bench and `pnpm pack --dry-run` on `main`, check the Version Packages pull request, and hand it to the maintainer.
- After it merges and the package is on npm, merge `main` into `next` and push directly. Remove the "template-import" entry of the differential test in that sync.

## Acceptance

- [ ] Checks on `main` pass; the results are in the outcome.
- [ ] brumate 0.5.1 is on npm, and `next` holds `main`.

## Sizing

S: checks and one hand-off.
