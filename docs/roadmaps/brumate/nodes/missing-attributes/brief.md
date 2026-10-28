---
id: missing-attributes
title: The HTML attributes that the element types lack
status: todo
priority: should
type: feature
outline: false
milestone: 0.5.0
target:
from:
size: S
spike: false
verify: pnpm --filter brumate typecheck
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/elements.d.ts
  - packages/brumate/test/elements-types.ts
reserves: []
provides: []
depends_on:
  - on: element-values
    kind: hard
    why: both edit elements.d.ts
  - on: aria-types
    kind: hard
    why: both edit elements.d.ts
---

# The HTML attributes that the element types lack

## Goal

`Elements` has the current HTML attributes that Solid has and brumate lacks: `meter form`, `dialog closedby`, `template shadowroot*`, `style type`, typed `link as`, `script type`, `meta http-equiv`, the `iframe sandbox` and `input autocomplete` tokens, `button command`, the microdata attributes, `autocorrect`, `exportparts`, and `xlink:href` and `xml:lang` on SVG.

## Context

- [reviews/type-parity.md](../../reviews/type-parity.md), section 2, and section 4 I.
- Add only attributes that the HTML standard has today. Leave out the ones that are deprecated.

## Acceptance

- [ ] elements-types.ts has a case for each group, and each is an error on main.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: a list of attributes.
