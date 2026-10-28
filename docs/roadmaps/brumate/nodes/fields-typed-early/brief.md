---
id: fields-typed-early
title: Fields typed before the code loads
status: done
priority: must
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/early-input.test.ts
exclusive: []
fulfilled_by: 
gate: false
added: 
owns:
  - packages/brumate/src/runtime/client/resume.ts
  - packages/brumate/test/early-input.test.ts
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/src/runtime/client/state.ts
reserves: []
provides: []
depends_on:
  - on: split-client-runtime
    kind: hard
    why: it changes the resume code, which the split moves
  - on: ordered-updates
    kind: hard
    why: its writes go through writeSlot, whose semantics ordered-updates changes
---

# Fields typed before the code loads

## Goal

When the core resumes a field whose `value` or `checked` is bound, it reads the field from the DOM. When the user changed it, the DOM wins, and the core writes the signal as an input event would. The same for `<select>` and `<textarea>`, with a hook for a part with its own field.

## Context

- Text typed before the code loads is lost or overwritten. TokenField has its own fix (#206), and the SearchField e2e step was flaky for this reason.
- Source: [Fields typed before the code loads](../../../../proposals.md#fields-typed-before-the-code-loads)

## Acceptance

- [ ] A test types into each kind of field before the code loads, and the signal has the text after resume.
- [ ] A field the server rendered with a value that the page changed since is not read back.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: known pattern, several kinds of field.

PR: #286
