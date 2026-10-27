---
id: mathml-elements
title: MathML elements and their currentTarget
status: todo
priority: should
type: feature
outline: false
milestone: types
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
  - packages/brumate/src/check.ts
  - docs/roadmaps/brumate/contracts/element-types.md
reserves: []
provides: []
depends_on:
  - on: element-values
    kind: hard
    why: both edit elements.d.ts and the element-types contract
---

# MathML elements and their currentTarget

## Goal

`Elements` has the MathML tags, with the global MathML attributes and their own (`display`, `mathvariant`, `scriptlevel` and the per-element ones). A handler on a MathML element gets a `MathMLElement` as `currentTarget`, not `HTMLElement`.

## Context

- [reviews/type-parity.md](../../reviews/type-parity.md), section 1, items 9 and 10, and section 4 F. `$$Element` in packages/brumate/src/check.ts (about line 57) and `ElementOf` read `HTMLElementTagNameMap` and `SVGElementTagNameMap` only; add `MathMLElementTagNameMap`.
- Solid lists about 30 MathML tags. Use the tags of MathML Core.
- Leave `a`, `script`, `style` and `title` inside `<svg>` as the contract decided.
- Add the MathML tags to the element-types contract as a change entry.

## Acceptance

- [ ] elements-types.ts has cases for a MathML tag with a wrong attribute, and a handler that reads `currentTarget` as `MathMLElement`. Both fail on main.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one list of tags, and one helper.
