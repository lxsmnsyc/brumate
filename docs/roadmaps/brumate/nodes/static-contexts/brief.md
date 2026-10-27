---
id: static-contexts
title: A context set once on the server is not live in the browser
status: todo
priority: could
type: feature
outline: false
milestone: smaller-client
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns:
  - packages/brumate/test/render/staticContext*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/graph.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/codegen/**
  - packages/brumate/test/**
  - packages/ui/src/**
reserves: []
provides: []
depends_on:
  - on: ui-date-i18n
    kind: hard
    why: it moved a lookup into I18nProvider to work around this; the node can move it back as its proof
---

# A context set once on the server is not live in the browser

## Goal

Every `$getContext` value counts as live today: graph.ts:356 marks every `context` declaration live, and analyze.ts:839 makes each `$getContext` one. So browser code that reads a context ships everything it could compute from it. ui-date-i18n found this: a strings lookup inside a date part would have shipped every language, so the lookup moved into I18nProvider on the server. Make a context live only when one of its `$setContext` calls sets a live value or sits in a scope the browser creates, like `liveProps` does for props.

## Context

- Start with a spike: whole-program knowledge of providers is needed (which components set which context, and whether the value can change). Write the design in the outcome before building.
- The proof: in a small fixture, a part that reads a static context and looks up a table ships only the looked-up value, not the table. Then check whether I18nProvider's lookup can move back into the date parts without shipping every language.

## Acceptance

- [ ] A test: a context set once with a constant or server-only value is not live; one set from a signal, or inside a block the browser renders, still is.
- [ ] Todos and the ui example do not grow; report any page that shrinks.
- [ ] The brumate and ui suites pass.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: an analysis over providers, behind a spike.
