---
id: dynamic-tag-types
title: A dynamic tag checks its attributes and types its handlers from its tag
status: done
priority: should
type: feature
outline: false
milestone: types
target:
from:
size: M
spike: false
verify: pnpm typecheck
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/tsc/test/fixture/src/Dynamic.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/check.ts
  - packages/tsc/test/tsc.test.ts
  - packages/ui/src/*.brm
  - website/**
  - examples/**
reserves: []
provides: []
depends_on:
  - on: element-checks
    kind: hard
    why: it builds on the check of plain elements, in the same file
  - on: ui-generics
    kind: hard
    why: the caller fixes touch the parts that ui-generics rewrites
---

# A dynamic tag checks its attributes and types its handlers from its tag

## Goal

`<{tag} onClick=((event) => ...)>` types `event` from the tag: the element types for an element name, the props for a component. The attributes and `ref` of a dynamic tag are checked the same way. The parts of packages/ui then drop most of their 97 `currentTarget as` casts.

## Context

- [reviews/type-parity.md](../../reviews/type-parity.md), section 1, items 3 and 4, and section 4 C. Today `$$dynamic` in packages/brumate/src/check.ts (about line 55) takes `props: Record<string, unknown>`, so handlers are implicit `any`.
- Shape proposed by the audit: `$$dynamic<T extends keyof Elements | Component<any>>(tag: T, props: T extends keyof Elements ? ElementProps<T> : PropsOf<T>)`, with the prop names that `component()` uses. A generic `T extends AsTarget` in a part resolves to the union, so a handler gets `HTMLElement | SVGElement` as `currentTarget`, which is still better than `any`.
- Remove the casts that the new types make unneeded, and count what is left in the outcome.

## Acceptance

- [ ] A brumate-tsc fixture shows a typed handler and a wrong attribute on a dynamic tag with an element name, and with a component. Both fail on main.
- [ ] `pnpm typecheck` exits 0 in every package, the website and the examples.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one helper of the check, then the casts of the parts.
