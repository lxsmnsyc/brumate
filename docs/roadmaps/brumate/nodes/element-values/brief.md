---
id: element-values
title: The element types accept every value that the runtime accepts
status: done
priority: should
type: fix
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: pnpm --filter brumate typecheck
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/elements.d.ts
  - packages/brumate/test/elements-types.ts
  - docs/roadmaps/brumate/contracts/element-types.md
shared:
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# The element types accept every value that the runtime accepts

## Goal

`Elements` of `brumate/elements` accepts every value that the runtime and the syntax accept, so element-checks does not report false errors when it starts checking plain elements.

## Context

- [reviews/type-parity.md](../../reviews/type-parity.md), section 1, items 12 and 13, and section 4 B. The changes:
  - `class` takes a class value: a string, an array, an object of booleans, nested.
  - `style` takes a string or a style object with camel-case and `--custom` names.
  - `select` gets `value`.
  - `value` and `checked` of `input`, `select` and `textarea` take a bound signal (`$bind`).
  - `form action` and `formaction` take a server function.
  - Number attributes take `number | \`${number}\``, since static attributes are strings (`tabindex="0"` appears 37 times in the repo).
  - `autocomplete` takes a boolean; drop `ToggleEnd`, add `KeyPress`.
  - Export the handler type, as Solid exports `JSX.EventHandler`.
- Check each value against the runtime (packages/brumate/src/runtime) before you widen a type, so the types stay sound.
- This changes the frozen element-types contract. The maintainer accepted it on 2026-10-27 (contracts/element-types.change-request.md). Write the change in the contract and bump it to v1.1.

## Acceptance

- [ ] packages/brumate/test/elements-types.ts has a case for each widened value, and each fails on main.
- [ ] It still rejects wrong values: a number for `class`, an unknown style name, a string for `checked`.
- [ ] element-types is v1.1, with the change listed.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: many small type changes, each checked against the runtime.
