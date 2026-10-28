---
id: conditional-rest-spread
title: A conditional spread of the rest props in markup
status: todo
priority: should
type: feature
outline: false
milestone: 0.5.0
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "conditional spread of the rest"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/conditionalRest*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/test/check.test.ts
  - packages/brumate/test/resume.test.ts
  - website/docs/**
reserves: []
provides: []
depends_on:
  - on: rest-ref-local-error
    kind: hard
    why: it makes the conditional spread an error, which this node lifts
---

# A conditional spread of the rest props in markup

## Goal

Allow the props object or the rest as a branch of `?:`, `&&`, `||` or `??` inside a markup spread, such as `<div {...(open ? rest : {})}>` or `<div {...(open && rest)}>`. The other branch is an object literal, `undefined`, `null` or `false`. Anything else stays the error of rest-ref-local-error: a call such as `{...pick(rest)}`, a nested condition, or the rest on both sides with different objects.

## Behavior

- Branch on: as `{...rest}` today. A `ref` in the rest reaches the element, and the other props apply.
- Branch off: the rest props are not on the element, and a `ref` in the rest is set to `undefined`.
- The condition flips after the first render: the ref arrives or clears, and the props are added or removed, in the browser.

## Context

- The maintainer chose to merge rest-ref-local-error (#299) with the conditional as an error, and to allow it here with defined behavior (2026-10-27).
- The forward of a ref from a spread is gated in codegen/markup.ts by `spreadsRest`, which looks at what the spread expression reads (rest-ref-spread, dynamic-tag-rest-ref). A condition is not designed for there; make it explicit.

## Acceptance

- [ ] check.test.ts: the allowed forms compile; `{...pick(rest)}`, a nested condition and `{...(a ? rest : other)}` with a non-literal `other` stay errors.
- [ ] resume.test.ts: the ref arrives when the condition starts true, is undefined when it starts false, and arrives and clears as it flips; the same for an element in a block the browser renders.
- [ ] The packages/brumate and packages/ui suites pass. The eager core grows by at most 0.05 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: a wider allow-list in the check, and the off branch of the forward.
