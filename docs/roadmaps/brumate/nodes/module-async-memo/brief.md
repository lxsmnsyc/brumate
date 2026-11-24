---
id: module-async-memo
title: Async $memo at the top level of a module
status: todo
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
risk: high
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
  - packages/brumate/src/runtime/store.ts
  - packages/brumate/src/error-catalog.ts
  - packages/brumate/test/error-codes.json
  - website/docs/reactive-modules.md
  - website/docs/async-data.md
  - docs/decisions.md
  - .changeset/module-signals.md
reserves: []
provides: []
depends_on:
  - on: module-signal-forms
    kind: hard
    why: same planner in src/module-signals.ts; the importer side of $isPending and $resolve lands there
---

> 2026-11-24: added by the maintainer as a must of 0.9.0, held with module-signal-forms (see that brief).

# Async $memo at the top level of a module

## Goal

`$memo` at the top level of a module takes the same values as in a component: a promise, `await`, and an async iterable. Importers read it like a local async memo: `#loading`, `await name`, `$isPending(name)` and `await $resolve(name)` all work.

```ts
// user.brm.ts
import { $memo, $signal } from 'brumate/signals';

export let id = $signal(1);
export const user = $memo(await fetchUser(id));
```

Today `$memo(await …)` at the top level is BRM211 (`src/module-signals.ts`), and a memo whose value is a promise compiles to a `derived` store that holds the promise itself.

## Context

- Component async memos: `website/docs/async-data.md` and the `$memo` entry in `website/docs/reference-signals.md` (server computes when first read, `#loading` streams it, browser keeps the old value while loading, only the latest run is written).
- Server: a module value is one per process. Decide, with a test, what a second request sees while the first load is pending and after it settles (one shared load, as `export const user = store(fetchUser())` would give). Write the rule in decisions.md and one line in the docs, next to the line for signals.
- Resume: the server rendered a value; the browser must not load again on start when the sources are unchanged, as for a component memo. Read how the page state carries a component memo's value before choosing.
- Prior art: Solid's `createAsync`/`createResource` at module level and Svelte 5 `$derived` with `await`; record what you read (URL and SHA). If a form cannot be built, stop and write why in the log; no new limits without the maintainer's OK.

## Acceptance

- [ ] A module memo with `await`, one with a promise value and one with an async iterable render on the server (outside and inside `#loading`), resume without a second load, and reload in the browser when a source signal changes; only the latest run is written.
- [ ] An importer's `$isPending`, `await $resolve(name)` and `await name` in markup work on it; a handler read without a guard is BRM182 as for a local memo.
- [ ] Two server requests: the documented shared-load rule holds, in a test.
- [ ] A rejected load goes to the importer's nearest `#try`.
- [ ] BRM211 no longer fires for `$memo(await …)`; its catalog text and `test/error-codes.json` updated.
- [ ] Docs: `website/docs/reactive-modules.md` and `website/docs/async-data.md`; decisions.md; `.changeset/module-signals.md`.
- [ ] A page with no module signal ships the same client JS (todos bench).
- [ ] oxlint, root `oxfmt --check`, typecheck, root `pnpm test`, and the e2e run.

## Sizing

M, risk high: server sharing and resume of an async value across components.
