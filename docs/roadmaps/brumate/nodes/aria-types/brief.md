---
id: aria-types
title: Typed ARIA attributes and roles
status: todo
priority: should
type: feature
outline: false
milestone: types
target:
from:
size: M
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
  - docs/roadmaps/brumate/contracts/element-types.md
reserves: []
provides: []
depends_on:
  - on: element-values
    kind: hard
    why: both edit elements.d.ts and the element-types contract
---

# Typed ARIA attributes and roles

## Goal

Each `aria-*` attribute of WAI-ARIA 1.2 has its value type: a boolean, a tristate, an enumeration, a number or an ID list. `role` is the union of the ARIA roles. `aria-${string}` stays for the rest.

## Context

- [reviews/type-parity.md](../../reviews/type-parity.md), section 2 "ARIA and roles", and section 4 G. Solid types each ARIA attribute this way.
- Booleans are written as strings in HTML (`aria-expanded="true"`), and the parts pass `String(flag)`. Accept `boolean | 'true' | 'false'` where the runtime writes both the same.
- The stricter types flag callers in packages/ui only once element-checks checks plain elements. Do not fix callers here.

## Acceptance

- [ ] elements-types.ts has cases for a wrong `aria-expanded`, a wrong `aria-live` and an unknown `role`, each an error, and each valid on main.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: about 50 attributes and 80 roles, written from the spec.
