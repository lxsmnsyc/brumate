---
id: ui-skill
title: A skill for @brumate/ui, shipped in its package
status: todo
priority: should
type: feature
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify: pnpm --filter @brumate/ui exec vitest run test/skill.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - packages/ui/skills/**
  - packages/ui/test/skill.test.ts
  - packages/ui/package.json
shared:
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: ui-docs-pages-collections-3
    kind: hard
    why: the skill follows the finished ui docs, so it waits for the last docs pages
  - on: ui-docs-pages-utilities
    kind: hard
    why: the skill follows the finished ui docs, so it waits for the last docs pages
  - on: brm-skill
    kind: hard
    why: it follows the format and the test harness of the brumate skill
  - on: as-controls
    kind: hard
    why: the skill teaches as and ref, which as-controls settles
  - on: as-collections
    kind: hard
    why: the skill teaches as and ref on collections, which as-collections settles
  - on: ui-generics
    kind: hard
    why: the skill teaches the value types of the parts
  - on: drop-react-aria-refs
    kind: hard
    why: the skill must describe the parts in the same words as their docs
---

# A skill for @brumate/ui, shipped in its package

## Goal

A skill in the Agent Skills format for the parts of @brumate/ui. It covers how parts compose (a Label, a field and a FieldError; a Select with its Popover and ListBox), slots, contexts, `as` and `ref`, bindable state with `$bind`, render props as `#template`, and the `data-*` state for styling. It ships in the @brumate/ui package, so its version matches the parts. Its `brm` code blocks are compiled and run against the parts in a test, as the brumate skill's are.

## Context

- The brumate skill (brm-skill, #250) ships in packages/brumate/skills and documents only brumate. A ui reference was taken out of it, because the parts are a separate package with their own releases.
- Never name React Aria. Describe the parts themselves.

## Acceptance

- [ ] packages/ui/skills/brumate-ui/SKILL.md and its references exist, and `files` in packages/ui/package.json ships them.
- [ ] A test compiles every `brm` block of the skill against the parts, and a block marked wrong fails with its error.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: mostly writing, on the harness of the brumate skill.
