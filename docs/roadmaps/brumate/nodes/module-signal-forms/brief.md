---
id: module-signal-forms
title: $gate, $debounced, $throttled, $optimistic and $untrack at the top level of a module
status: active
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.9.0
target: main
ship: pr
land: direct
from:
size: M
risk: medium
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/module-signals.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-24
spent:
owns:
  - packages/brumate/src/module-signals.ts
  - packages/brumate/test/module-signals.test.ts
  - packages/brumate/test/module-signals/
shared:
  - packages/brumate/src/compile.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/vite.ts
  - packages/brumate/src/check-command.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/src/runtime/store.ts
  - packages/brumate/test/error-codes.json
  - website/docs/reactive-modules.md
  - website/docs/reference-signals.md
  - docs/decisions.md
  - .changeset/module-signals.md
reserves: []
provides: []
depends_on:
  - on: module-signals
    kind: hard
    why: extends the transform of module-signals in src/module-signals.ts
---

> 2026-11-24: added by the maintainer as a must of 0.9.0, which is held until it lands. The 0.9 promo and changeset say "module signals", and a module that reaches for `$gate` or a debounced value gets BRM211. The maintainer called shipping that "false marketing".

# $gate, $debounced, $throttled, $optimistic and $untrack at the top level of a module

## Goal

Every compile-time function that declares a value in a component also declares one at the top level of a `.brm.ts` module and of `<script module>`, with one value per module, read by importers like `$signal` and `$memo` are today:

```ts
// search.brm.ts
import { $debounced, $gate, $memo, $signal, $untrack } from 'brumate/signals';

export let input = $signal('');
export const query = $gate(input, (_, next) => next.length >= 2);
export const typed = $debounced(input, 300);
export const label = $memo(`${query} (${$untrack(input.length)})`);
```

Today `planModuleSignals` accepts only `$signal` and `$memo` in a top-level declaration; any other compile-time function there throws BRM211 "… at the top level, except in a declaration of a signal or a memo" (`src/module-signals.ts`, `reject` and the declaration loop).

## In scope

- `$gate(value, guard)`: a `derived` store that keeps its value when the guard returns false, with the rules of the component form (first value passes, guard untracked, held error, no promise: BRM203).
- `$debounced(value, ms)` and `$throttled(value, ms)`: stores of the source that the browser writes after the wait; on the server the value itself, as in a component. Pending while waiting, so `$isPending` of an importer sees it.
- `$optimistic(source)`: follows a module memo or signal-like source and can be written by exported functions; the guess resets when the source changes or when every server call of the page finishes, as in a component.
- `$untrack(expr)` inside a module memo (and the other forms): the names it reads are not sources of the `derived`.
- Importer side: a component that imports any of these reads it like `$store(x)`, and `$isPending`, `$resolve` and `$untrack` work on an imported module signal or memo as they do on a local one. Check each, and fix the ones that do not.

## Out of scope

- Async `$memo` at module level: node module-async-memo.
- `$effect` and `$client` at the top level: they need a scope (module-signals brief, "Notes for the worker"). They stay BRM211.
- Component-only functions (`$props`, `$setContext`, `$getContext`, `$route`, `$searchParam`, `$navigation`, `$id`, `$title`, `$action`, `$handler`, `$bind`, `$isBound`, `$isPassed`): BRM211 stays, with advice that names the component.

## Context

- Read `nodes/module-signals/outcome.md` first; the transform, the importer side and the Vite wiring are there.
- Prior art: read how Svelte 5 treats `$derived` and Solid's `createMemo` with `equals` at module level before choosing a form; record what you read (URL and SHA) in the log. Copy the component API of each brumate form exactly: same arguments, same errors.
- Prefer compiling each form to `brumate/store` (`store`, `derived`) plus the runtime helper the component form already uses, so a module without these forms ships nothing new. If a form cannot be expressed that way, stop and write why in the log; do not add a new limit without the maintainer's OK.
- A module value is one per server process, as for `$signal` (decisions.md, module-signals entry).

## Acceptance

- [ ] Each in-scope form at the top level of a `.brm.ts` module and of `<script module>` renders on the server, resumes, and updates in the browser when its sources change, read by two components on one page (`test/module-signals.test.ts`).
- [ ] `$gate`: a guard that returns false keeps the value and does not run readers; a guard that throws holds the error.
- [ ] `$debounced` and `$throttled`: timing tests with fake timers; pending while waiting.
- [ ] `$optimistic`: a write from an exported function shows the guess; it resets when the source changes.
- [ ] `$untrack` in a module memo: a change of the untracked name does not recompute.
- [ ] `$isPending`, `$resolve` and `$untrack` in a component on an imported module value.
- [ ] BRM211 keeps firing for the out-of-scope forms, with a message that names where to call them.
- [ ] Docs: "Shared state at module level" in `website/docs/reactive-modules.md` lists every form a module can declare; `website/docs/reference-signals.md` notes module support per form; samples pass `pnpm --filter website check:samples`. decisions.md entry updated. `.changeset/module-signals.md` (not yet released) describes the whole set.
- [ ] A page with no module signal ships the same client JS (`pnpm bench --only brumate --scenario todos`).
- [ ] oxlint, root `oxfmt --check`, typecheck, root `pnpm test`, and the e2e run.

## Sizing

M. The transform and importer side exist; this adds four forms to one planner, their tests and docs. Uncertainty: `$optimistic` reset on "every server call of the page" from module code.
