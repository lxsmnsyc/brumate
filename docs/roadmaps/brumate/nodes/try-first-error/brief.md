---
id: try-first-error
title: "Two errors of one #try body at once show the #catch once, with the first error"
status: active
priority: must
type: hotfix
outline: false
milestone: 0.4.4
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-31
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client/errors.ts
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
reserves: []
provides: []
depends_on: []
---

# Two errors of one #try body at once show the #catch once, with the first error

## Goal

When two errors of one `#try` body happen in the same turn (two effects that throw in one update, two rows that fail at once), the `#catch` renders once and shows the first error, as on the server. Today `fail` is async, both errors reach `catchInto`, the `#catch` renders twice and the last error stays.

## Context

- Found by browser-try on feat/browser-async (2026-11-02), also on `main`: main's `fail` in packages/brumate/src/runtime/client/errors.ts has the same logic.
- browser-try's fix (on feat/browser-async, a7f1331b and its errors.ts change): `fail` drops an error whose `#try` body was replaced since the error happened (the body's scope under the block's holder left `scopes`); `onError` still sees it, `brumate:error` does not. Port that check and its `tryTwoEffects` test to `main`; the story's `attempt` and `#loading` parts stay on the story.
- When `main` syncs into feat/browser-async, drop the story's duplicate changeset `.changeset/try-shows-first-error.md` so the release notes list the fix once.

## Acceptance

- [ ] A test that fails on `main`: two effects of a `#try` body throw in one update; the `#catch` renders once with the first error.
- [ ] A patch changeset for brumate.
- [ ] Todos within 0.3 kB.

## Sizing

S: one check in `fail` and a test.
