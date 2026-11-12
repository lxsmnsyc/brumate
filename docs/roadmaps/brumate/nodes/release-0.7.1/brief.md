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
  - on: get-event-helper-docs
    kind: hard
    why: the getEvent docs do not say a .ts helper needs the event passed in (added 2026-11-11)
  - on: inline-memo-errors
    kind: hard
    why: an inline memo throws at its declaration instead of at a read (added 2026-11-11)
  - on: key-letter-case
    kind: hard
    why: prevent(fn, 'Mod+K') never matches Cmd+K (added 2026-11-11)
  - on: popover-tab-out
    kind: hard
    why: Tab out of a non-modal popover panel leaves it open (added 2026-11-11)
  - on: live-style-scope-id
    kind: hard
    why: live style variables miss elements the browser renders outside the component's render function (added 2026-11-11)
  - on: style-nonce
    kind: hard
    why: a strict style-src policy blocks every component stylesheet on 0.7.0
---

# Release brumate 0.7.1

## Goal

Publish brumate 0.7.1 with the patch fixes of the 0.7.1 milestone, then merge `main` into `release/0.8`.

## Acceptance

- [ ] The maintainer merges the Version Packages pull request, and brumate 0.7.1 is on npm.
- [ ] `release/0.8` holds `main` (merge pushed directly, after the checks).

## Sizing

S: checks and one hand-off.

## Merge notes for main into release/0.8 (2026-11-11)

- popover-tab-out and popover-group-alert both add `leaveByTab` to packages/ui/src/overlay.ts, identical: keep one copy and one import. In Popover.brm keep a single keyDown block for every non-modal popover (drop `group &&` from the 0.8 condition, keep `!trigger?.isPreview` from main).
- live-style-scope-id: apply the same `.id` rule in `liveVariableScopes` (codegen/markup.ts on release/0.8).
- inline-memo-errors: release/0.8's render-memo-reads has the narrower `cannotThrow`; resolve to it.
- key-letter-case: keep @brumate/ui's `matchesShortcut` and the runtime `keyMatches` on the same letter rule.
