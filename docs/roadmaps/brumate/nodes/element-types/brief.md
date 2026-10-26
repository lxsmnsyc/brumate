---
id: element-types
title: Types for elements, markup and components
status: active
priority: should
type: contract
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec tsc --noEmit -p .
exclusive: []
fulfilled_by: 
gate: false
added: 2026-10-26
owns:
  - packages/brumate/elements.d.ts
  - packages/brumate/package.json
  - packages/brumate/test/elements-types.ts
  - docs/roadmaps/brumate/contracts/element-types.md
shared:
  - .changeset/*.md
  - packages/brumate/types.d.ts
  - packages/brumate/src/runtime/signals.ts
reserves: []
provides: [element-types]
depends_on: []
---

# Types for elements, markup and components

## Goal

brumate has no type for an element, for markup or for a component, as JSX has `JSX.IntrinsicElements`, `JSX.Element` and component types. Define them in brumate: the attributes of each element by tag (fields, `class`, `style`, handlers, `data-*`, `aria-*`, and brumate attributes such as `ref` and `{...spread}`), a `Markup` type for what children, a `#template` and a render give, and `Component<P>` for a component of a .brm file. Freeze them as the element-types contract.

## Context

- Today a .brm import is `(props: any, ctx) => Promise<string>` (types.d.ts), children are `unknown` or `any`, a `#template` is checked as an async function that returns nothing, and check.ts checks only the handlers of a plain element.
- @brumate/ui builds its own approximation in as.ts from `HTMLElementTagNameMap`, which is unsound (it allows fields that are not attributes, and lower-cases names) and opaque to readers.
- Solid and Preact export these from their JSX namespace. Terracotta reads `JSX.IntrinsicElements` for `as`.
- Source: Request of the user, 2026-10-26: brumate lacks an element definition like JSX.Element

## Acceptance

- [ ] packages/brumate/test/elements-types.ts checks, with `@ts-expect-error`: an unknown attribute of `a`, a wrong type for `href`, a handler with the wrong event, and that a `Markup` value is not a string.
- [ ] The element-types contract is frozen, with the names and where they are exported.
- [ ] `pnpm typecheck` passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: the types are known from JSX libraries. Choosing which DOM fields are attributes is the larger part.

## Notes for the worker

- Types only. Checking plain elements against them is element-checks.
