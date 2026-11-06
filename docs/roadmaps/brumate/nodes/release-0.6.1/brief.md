---
id: release-0.6.1
title: Release brumate 0.6.1
status: done
priority: must
type: release
outline: false
milestone: 0.6.1
target: main
from: main
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-05
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/*/package.json
  - packages/*/CHANGELOG.md
reserves: []
provides: []
depends_on:
  - on: client-fixes
    kind: hard
    why: ref setters after the render, memo-reject and class-order diverge from the server on 0.6.0
  - on: render-memos
    kind: hard
    why: memo-throw, debounce-start and function-prop-reads diverge from the server on 0.6.0
  - on: dom-content-loaded
    kind: hard
    why: an onDOMContentLoaded handler never runs on 0.6.0
  - on: module-script-shared
    kind: hard
    why: a browser-rendered component gets its own <script module> state on 0.6.0
  - on: text-field-refused-edit
    kind: hard
    why: TextField and SearchField keep the typed text after a refused edit on 0.6.0
  - on: template-scope-leak
    kind: hard
    why: a same-file template in a browser-rendered component leaks its scopes on 0.6.0
  - on: prerender-search-params
    kind: hard
    why: a prerendered page drops its query string on 0.6.0 (#466)
  - on: head-title-navigation
    kind: hard
    why: a #head title stops following its memo after client navigation on 0.6.0 (#467)
  - on: template-component-import
    kind: hard
    why: a same-file template that renders a component throws on update on 0.6.0
  - on: template-update-in-place
    kind: hard
    why: an input in a same-file template loses focus at each update on 0.6.0
  - on: prerender-defer-context
    kind: hard
    why: a prerendered page with browser code shows its #defer body for no user on 0.6.0
  - on: memo-object-cast
    kind: hard
    why: a live memo of an object literal with a type cast fails to parse on 0.6.0
---

# Release brumate 0.6.1

## Goal

Publish brumate 0.6.1 with the patch fixes of the 0.6.1 milestone, then sync `next` with `main`.

## Context

- The cut comes from docs/debates/0.7.0-cut/debate.md: fixes of 0.6.0 behavior that add no API.
- As release-0.5.1: run `pnpm build`, `pnpm test`, `node e2e/run.mjs`, the todos bench and `pnpm pack --dry-run` on `main`, check the Version Packages pull request, and hand it to the maintainer.
- After it merges and the package is on npm, merge `main` into `next` and push directly.

## Acceptance

- [x] Checks on `main` pass; the results are in the outcome.
- [x] brumate 0.6.1 is on npm, and `next` holds `main`.

## Sizing

S: checks and one hand-off.
