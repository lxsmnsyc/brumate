---
id: observability-docs
title: Docs for observability
status: active
priority:
type: feature
story: observability
early: false
outline: false
milestone:
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter website check:samples
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent:
owns:
  - website/docs/observability.md
shared:
  - website/src/docs.ts
  - docs/decisions.md
  - docs/proposals.md
  - packages/brumate/skill/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: observability-core
    kind: hard
    why: the page shows the final span names, the `src/middleware.ts` export and the `traceparent` rules
  - on: observability-otel
    kind: hard
    why: the page shows the adapter's real import and options
  - on: observability-browser
    kind: hard
    why: the page shows the browser start option and the build flag
---

# Docs for observability

## Goal

A website page that shows how to set `onTrace` on the server and in the browser, the span names and attributes, the adapter for OpenTelemetry, what is never recorded, and how off costs nothing. The decisions are in `docs/decisions.md`.

## Current state

No page. The proposal is [Observability](../../../../proposals.md#observability). The website samples are checked by `pnpm --filter website check:samples`.

## Acceptance

- [ ] `website/docs/observability.md` has: a server example (`src/middleware.ts` with `onTrace`), the browser option, the `otel()` example, a table of the span names and attributes (copied from the frozen contract `trace-span`), the privacy rules, and the trace of one click that calls a server function.
- [ ] Every code sample compiles in `check:samples`.
- [ ] `docs/decisions.md` records: finished spans, the `onTrace` export beside `onError`, OpenTelemetry in a subpath with an optional peer, the build constant for the browser, and the answer to the story's question.
- [ ] The proposal's Observability section links to the page, or says what changed in the shipped version.
- [ ] The brumate skill mentions `onTrace` in the server section, and its code blocks compile in the skill test.
- [ ] A patch changeset is not needed (docs only); if the skill changes, a patch changeset for the skill files.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm --filter website check:samples`.

## Sizing

S: one page, one decision entry, one skill note.

## Bytes

0 on every page of an app; website docs only.
