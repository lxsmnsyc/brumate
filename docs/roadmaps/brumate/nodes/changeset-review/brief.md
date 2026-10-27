---
id: changeset-review
title: Review and trim the pending changesets before the release
status: todo
priority: should
type: chore
outline: false
milestone: ui-0.1
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
