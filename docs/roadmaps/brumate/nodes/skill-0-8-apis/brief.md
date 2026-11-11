---
id: skill-0-8-apis
title: The brumate skill teaches the 0.8 APIs
status: active
priority: must
type: docs
story:
early: false
outline: false
milestone: 0.8.0
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
added: 2026-11-11
spent:
owns:
  - packages/brumate/skills/brumate/**
shared:
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: skill-tasks
    kind: hard
    why: the tasks name the APIs the skill misses
---

# The brumate skill teaches the 0.8 APIs

## Goal

The brumate skill (packages/brumate/skills/brumate, SKILL.md and references/) covers what 0.8.0 adds, so an agent with the skill writes it right: `derived` from brumate/store, `getEvent().nonce` for an inline head script written with `raw()`, `<script data-rerun>` in `#head`, the file's `<style>` as the outermost block (block styles with global markers), and, where the skill points at @brumate/ui, `ColorScheme` with `colorScheme()`.

## Context

- skill-tasks (2026-11-11, outcome on main) found that SKILL.md and its references mention only block styles among the 0.8 APIs.
- Sources of truth: website/docs/context.md (Derived stores), reference-security.md and reference-server.md (event nonce), navigation.md (data-rerun), styles.md and control-flow.md (styles in blocks), website/ui/color-scheme.md.
- Keep the skill short: one example per API in the reference that fits (state.md for derived, syntax.md for styles and head scripts), and a line in SKILL.md where it routes to references.

## Acceptance

- [ ] Each API above has a correct example in the skill, matching the docs.
- [ ] `node packages/brumate/skills/run-tasks.mjs --reference` still passes (6/6), and `packages/brumate/test/skill.test.ts` passes.
- [ ] `pnpm format:check`, `pnpm exec oxlint`.
