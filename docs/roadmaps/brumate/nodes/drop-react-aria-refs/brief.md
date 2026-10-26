---
id: drop-react-aria-refs
title: Describe the parts without naming React Aria
status: todo
priority: should
type: docs
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: test -z "$(git grep -il 'react aria\|react-aria' -- packages website docs examples README.md)"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - packages/ui/**
  - website/ui/**
  - docs/proposals.md
shared: []
reserves: []
provides: []
depends_on:
  - on: as-collections
    kind: hard
    why: both edit the doc comments of the collection parts
---

# Describe the parts without naming React Aria

## Goal

React Aria is one influence on the API of @brumate/ui, mixed with Terracotta and Headless UI, not a source of copied code. Code and docs must not name it. Rewrite every mention to describe the behavior itself, in packages/ui, website/ui and docs/proposals.md. Rewrite website/ui/influences.md to name only Terracotta and Headless UI.

## Context

- About 361 mentions in 2026-10. Most are doc comments such as "a button, as Button of React Aria Components", plus the ui README, test names, the docs pages and the Headless UI section of the proposals.
- The rule is the user's, from 2026-10-26: "It's an influence, not a direct copy." The package is MIT, with no Apache notices.
- docs/proposals.md is rewritten too, at the user's request. Keep its design content, and say where behavior comes from in plain terms, such as the WAI-ARIA patterns.
- Keep prop names such as `isDisabled` and `onPress`. They are the API, and need no source named.

## Acceptance

- [ ] `git grep -il 'react aria\|react-aria'` finds nothing in packages, website, docs, examples or README.md. Names of hooks such as `useInteractOutside` and `FocusScope` are gone from comments too.
- [ ] website/ui/influences.md names only Terracotta and Headless UI.
- [ ] No behavior changes: the ui tests and `pnpm --filter website check:samples` pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: many files, but one mechanical pattern of rewording.

## Notes for the worker

- Reword, do not delete content. A sentence that said "as X of React Aria Components" says what the part does.
- Test names that name React Aria get a name of the behavior they check.
