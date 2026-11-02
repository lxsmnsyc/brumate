---
id: release-0.4.3
title: Release brumate 0.4.3
status: done
priority: must
type: release
outline: false
milestone: 0.4.3
target: main
from: main
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-02
spent: 20000
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: primitive-await-memo
    kind: hard
    why: an async memo with await in a template literal stays empty in a browser render
  - on: upload-blob-metadata
    kind: hard
    why: files and blobs sent to server functions lose their type, name and lastModified
---

# Release brumate 0.4.3

## Goal

Publish brumate 0.4.3 with the hotfixes of the 0.4.3 milestone, then sync `next` with `main`.

## Context

- Same steps as release-0.4.1: the Version Packages pull request shows only patch bumps, and the maintainer merges it (`gate: true`).
- Before handing it over: `pnpm build && pnpm test && node e2e/run.mjs` pass on `main`, and `pnpm bench` todos size is recorded.

## Acceptance

- [ ] The Version Packages pull request shows brumate 0.4.3 and only patch bumps.
- [ ] Build, tests, e2e and the bench pass on `main`; the results are in the outcome.
- [ ] The maintainer merges the pull request and the package is on npm.
- [ ] `next` is synced with `main`, and the fix holds on `feat/browser-async` after its next sync.

## Sizing

S: checks and one pull request that the tooling writes.
