---
id: skill-0-9-apis
title: The brumate skill teaches the 0.9 APIs
status: active
priority: must
type: docs
story:
early: false
outline: false
milestone: 0.9.0
target: 
ship: auto
land: auto
from: 
size: S
spike: false
hypothesis:
verify: node packages/brumate/skills/run-tasks.mjs --reference
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent:
owns: []
shared:
  - packages/brumate/skills/**
  - packages/brumate/test/skill*
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: view-transitions
    kind: hard
    why: the skill teaches viewTransition, a 0.9 API (added 2026-11-18)
  - on: module-signals
    kind: hard
    why: the skill teaches module signals, a 0.9 API (added 2026-11-18)
  - on: async-effects
    kind: hard
    why: it teaches the API
  - on: produce-map-set
    kind: hard
    why: it teaches the API
  - on: external-scripts
    kind: hard
    why: it teaches the API
  - on: observability
    kind: hard
    why: it teaches the API
  - on: style-scope-where
    kind: hard
    why: it teaches the rule
  - on: effect-copy-warning
    kind: hard
    why: the skill names BRM209
  - on: style-files
    kind: hard
    why: the skill says how component CSS reaches the page
---

# The brumate skill teaches the 0.9 APIs

## Goal

The brumate skill (packages/brumate/skills/brumate, SKILL.md and references/) covers what 0.9.0 adds, so an agent with the skill writes it right:

- async effects: `$effect(async ...)` and `$client(async ...)`, their cleanup forms and the rule for reads after an `await` (website/docs/effects.md);
- the BRM209 warning for an effect that only copies signals, and the `$memo` it suggests;
- `$produce` on `Map` and `Set` (website/docs/state.md, reference-signals.md);
- module signals: `$signal`/`$memo` at the top level of a `.brm.ts` module and of `<script module>`, writes through exported functions, BRM211 and BRM208 (website/docs/reactive-modules.md);
- external scripts: `<script src trigger="idle|visible|interaction">`, inline scripts with a trigger, `data-rerun` (website/docs/navigation.md);
- named view transitions: `viewTransition`, `viewTransitionName`, `transition()` and `transition: true` (website/docs/markup.md, navigation.md);
- `onTrace` and `brumate/otel`, briefly, pointing at website/docs/observability.md (observability-docs already added one bullet);
- scoped styles add no specificity (`:where`), and component CSS reaches the page inline in server renders with cacheable sheets (website/docs/styles.md), in one line each.

## Context

- Same shape as skill-0-8-apis: one correct example per API in the reference that fits, and a line in SKILL.md where it routes to references. Keep the skill short.
- The docs pages above are the source of truth; copy their forms exactly. Code blocks in the skill are compiled by `test/skill.test.ts`.

## Acceptance

- [ ] Each API above has a correct example or line in the skill, matching the docs.
- [ ] `node packages/brumate/skills/run-tasks.mjs --reference` passes, and `packages/brumate/test/skill.test.ts` passes.
- [ ] A patch changeset for brumate.
- [ ] `pnpm format:check`, `pnpm exec oxlint`.
