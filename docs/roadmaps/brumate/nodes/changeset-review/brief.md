---
id: changeset-review
title: Review and trim the pending changesets before the release
status: todo
priority: should
type: chore
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-10-27
owns:
  - .changeset/*.md
shared: []
reserves: []
provides: []
depends_on:
  - on: shared-part-imports
    kind: hard
    why: its changeset is part of the release
  - on: streamed-loading-errors
    kind: hard
    why: its changeset is part of the release
  - on: html-attributes-navigation
    kind: hard
    why: its changeset is part of the release
  - on: promise-prop-memo
    kind: hard
    why: its changeset is part of the release
  - on: memo-prop-browser-child
    kind: hard
    why: its changeset is part of the release
  - on: parser-closed-nesting
    kind: hard
    why: its changeset is part of the release
  - on: color-area-page-keys
    kind: hard
    why: its changeset is part of the release
  - on: loading-header-error
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: streamed-memo-reads
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: late-state-record
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: check-package-imports
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: bind-read-your-writes
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: checkbox-description
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: code-examples
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: date-field-sync
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: field-error-clears
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: overlay-focus-fixes
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: overlay-navigation-cleanup
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: runtime-event-cancel
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: tokenfield-sync
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: try-sample-console
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: ui-docs-pages-collections-3
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: ui-docs-pages-utilities
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: ui-skill
    kind: hard
    why: the review runs after every node of the 0.4.0 cut
  - on: size-trim
    kind: hard
    why: it is the last must node of core-correct; the review runs once the core changes have landed
  - on: batching
    kind: hard
    why: the review runs once the core changes have landed
---

# Review and trim the pending changesets before the release

## Goal

The changelog of the next release (brumate 0.4.0, @brumate/ui 0.1.0 and the language packages, PR #98) reads as a short list of what changed for users. Today about 100 changesets are pending, one per pull request, many about internal steps, review fixes or later fixes of the same feature.

## Context

- Load the Skill `agent-skills:changesets` and follow its rules for bump levels and wording, and `agent-skills:plain-writing`.
- Merge changesets that describe one user-facing change across several pull requests (for example the `as` and `ref` work of the ui parts, the core fixes for a component in `as`, the type audit nodes) into one each.
- Drop changesets that describe nothing a user sees: internal refactors with no change of behavior or size, test-only changes, roadmap docs.
- Check each bump level: patch for changed behavior, minor for something new; a major needs the maintainer.
- Keep the breaking changes visible: the stricter element and event types, the strict `ref` typing, the new error routing of memos.
- Gated: the maintainer reads the result before the release PR #98 merges.

## Acceptance

- [ ] The changelog that `changeset version` would write (run it in a scratch worktree, do not commit its output) reads as a list of user-facing changes, one entry per change.
- [ ] Every remaining changeset has the right package and bump level.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: about 100 files to read, merge or drop.
