---
id: store-only-source
title: $store takes a store only, as silmaril's does
status: todo
priority: must
type: refactor
story: context-stores
outline: false
milestone: 0.7.0
target:
from:
size: L
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-06
spent:
owns: []
shared:
  - packages/brumate/src/**
  - packages/brumate/test/**
  - packages/brumate/skills/**
  - packages/tsc/test/**
  - packages/ui/src/**
  - packages/ui/test/**
  - packages/ui/e2e/**
  - website/docs/context.md
  - website/docs/reference-signals.md
  - website/docs/errors.md
  - docs/decisions.md
  - .changeset/*.md
reserves: [BRM199]
provides: []
depends_on:
  - on: ui-store-guards
    kind: hard
    why: it rewrote the same ui readers to $store(g?.state); this node reverts that form
---

# $store takes a store only, as silmaril's does

## Goal

The maintainer asked for `$store` to follow silmaril's interface (https://github.com/lxsmnsyc/silmaril/tree/992c6f576112a2a97be9611dc36d4ecf7a1200ad, README "Stores"): `$store(store)` binds one store, a value with `subscribe(callback)` that returns a cleanup, `get()`, and optionally `set(state)`. On 2026-11-06 the maintainer found two forms that the roadmap added on its own, and chose to remove both:

1. `$store(Ctx)`, which reads the store that a context holds. It came from the context-stores spike, which narrowed `$store` to `$store(ctx)`. A context's store is read as `$store($getContext(C))`, or as `$store(g.key)` for a key of a `$getContext` value.
2. `$store(undefined)` and `$store(null)` giving `undefined`, added by store-any-source for `$store(g?.state)`. The maintainer chose "store only" over keeping it. An optional read goes back to the explicit guard: `const s = $hasContext(C) ? $store(g.state) : undefined` for a guarded `g`, or `$hasContext(C) ? $store($getContext(C)) : undefined`.

Every other source that store-any-source allows stays: a key of a `$getContext` value, an import, a prop, a `<script module>` value, a call, `store(0)`. The server and resume rules stay as `docs/decisions.md` records them (BRM198, the foreign-store refusal in the page state, the one repair at resume).

Prior art checked on 2026-11-06: no store binder takes a context (silmaril `$$store`, Svelte 5 `$s` after `getContext`, Solid `from` after `useContext`, React `useSyncExternalStore`). Svelte 5 gives `undefined` for a nullish store (`store_get`, `subscribe_to_store`); the maintainer kept silmaril's strict shape instead. `let` keeps the write at the assignment, not silmaril's write-back at registration and after each change: the maintainer approved this on 2026-11-06, so `docs/decisions.md` should say so in the `$store` entry.

## Work

- Compiler: a source that is a context (`$store(Ctx)`, guarded or not) is a compile error, BRM199, whose message names the fix `$store($getContext(Ctx))`. A source written with `?.`, or a literal `undefined` or `null`, is a compile error too (BRM197 or BRM199, pick the one whose message fits and say why in the outcome). `$store($getContext(C))` and its guarded form compile to the key form (the context node, no path), so the browser links it from the provider and nothing runs again at resume.
- Runtime: a source that gives no store throws a `TypeError` naming `$store`, under `const` and `let`, on the server and in the browser. Remove the `undefined`/`null` paths that store-any-source added to `findStored` and both `consumeStore`s.
- Types: one signature, `$store<T>(source: StoreLike<T>): T`. Drop `Context<…>` and the `undefined | null` overload. Update `packages/tsc/test/fixture-has`.
- packages/ui: rewrite the 63 `$store(g?.key)` readers that ui-store-guards made (its outcome on `feat/context-stores` lists them) back to the guarded form, and every `$store(C)` reader (about 80, most of them `$hasContext(C) ? $store(C) : undefined`) to the `$getContext` form. Behavior with and without a provider must not change.
- Docs: the `$store` and context-no-defaults entries of `docs/decisions.md` (say the maintainer removed both forms on 2026-11-06 to match silmaril), `website/docs/context.md`, `website/docs/reference-signals.md`, the skill's `references/signals.md`, the BRM197 example in `error-catalog.ts` (it still shows the double guard), and the regenerated error pages (`UPDATE_SKILL=1`). Edit `.changeset/store-any-source.md` and the has-context and context-no-defaults changesets rather than adding a new one: none of these forms has been released.

## Acceptance

- [ ] `$store(Ctx)`, `$store(g?.key)`, `$store(undefined)` and `$store(null)` are compile errors with a message that names the fix; tests for each.
- [ ] A source that gives no store at run time throws a `TypeError` on the server and in the browser; tests for each.
- [ ] `$store($getContext(C))` resumes from its provider without running the source again (the `z` export has no entry for it).
- [ ] No `$store(C)` or `$store(…?.…)` remains in packages/ui, the examples, the website or the skill; counts before and after.
- [ ] brumate, tsc and ui tests, every package's and example's `test` script, and `node e2e/run.mjs --only ui --no-build` pass.
- [ ] The ui example's client JS gzip before and after.

## Sizing

L: compiler, runtime, types and docs, plus about 140 ui readers.
