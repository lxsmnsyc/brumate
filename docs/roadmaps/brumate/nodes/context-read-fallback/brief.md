---
id: context-read-fallback
title: $getContext takes a fallback, $hasContext goes, $store takes a store only
status: active
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
  - website/docs/**
  - examples/**
  - docs/decisions.md
  - .changeset/*.md
reserves: [BRM199]
provides: []
depends_on:
  - on: ui-store-guards
    kind: hard
    why: it rewrote the same ui readers to $store(g?.state); this node rewrites them again
---

# $getContext takes a fallback, $hasContext goes, $store takes a store only

## Goal

The approved debate is docs/debates/context-read-fallback/debate.md (2026-11-06). Read it first: it holds the settled structure, the prior art (Qwik v2 `useContext(ctx, default)`, Vue `inject(key, default)`) and the accepted risks. In short:

- `$getContext(C)` throws without a provider, as today. `$getContext(C, fallback)` returns the provided value, or the fallback when no provider is above. The argument count decides (as Vue's `arguments.length`), so `$getContext(C, undefined)` is the optional read. A provided `undefined` is a value (presence is `key in v`).
- The fallback is lazy. A literal is passed as it is; any other expression compiles to a function that the runtime calls only when the walk finds no provider, in the reader's scope, once per read. Nothing is stored on the context.
- One walk per read: the compiled guarded read `has(C, scope) ? consume(C, scope) : undefined` becomes `consume(C, scope, fallback)` on the server and in the browser. Delete `has()` (server.ts) and `hasContext()` (client/context.ts).
- `$hasContext` is removed from `brumate/signals`, the compiler and the types. Its 2 standalone ui uses (Toolbar.brm:38, ToggleButtonGroup.brm:63, `ToolbarContext` is `Context<boolean>`) become `$getContext(ToolbarContext, false)`.
- `$store` takes a store only, as silmaril's `$store(store)` does (the maintainer, 2026-11-06). `$store(Ctx)`, `$store(g?.key)`, `$store(undefined)` and `$store(null)` are compile errors whose message names the fix; a source that gives no store at run time throws a `TypeError` naming `$store`. Remove the nullish paths store-any-source added (`findStored`, both `consumeStore`s) and the `undefined | null` overload. Type: `$store<T>(source: StoreLike<T>): T`.
- An optional store has two documented forms:
  - Guard on the value, when there is no constant default: `const g = $getContext(C, undefined); const s = g ? $store(g.state) : undefined;`. The compiler accepts this one form for a `const` read with a fallback (the guard is fixed, since contexts are static); other forms are BRM197 with the new form in its message.
  - A store as the fallback, when a constant default exists: `const locale = $store($getContext(LocaleContext, store(DEFAULT_LOCALE)));`. The store is made per reader and only without a provider, so nothing is shared across requests and no guard is needed. `$store($getContext(C, …))` compiles to the key form (the browser links the provider's store, and runs the fallback only without one).
- `let` keeps the write at the assignment, not silmaril's write-back at registration and after each change (the maintainer, 2026-11-06). Say so in the `$store` entry of `docs/decisions.md`.

## Work

- Compiler (`analyze.ts` guard handling around lines 122, 492-519 and 1130; codegen of context and store reads), runtime (server.ts, client/context.ts, runtime/store.ts), types (`runtime/signals.ts`, `packages/tsc/test/fixture-has`).
- packages/ui: rewrite every reader with a script, as ui-store-guards did. The 74 `$hasContext(C) ? $getContext(C) : undefined` reads, the 66 `$hasContext(C) ? $store(C) : undefined` reads (to the guard form, or the store-fallback form where the reader already falls back to a constant, such as `localeStore ?? DEFAULT_LOCALE`), the 63 `$store(g?.state)` reads and the 2 standalone `$hasContext`. Behavior with and without a provider must not change. If the ui diff passes 60 files, stop after the core and the tests, and report: the orchestrator splits the ui rewrite into its own node.
- Docs: `website/docs/context.md` (rewrite "Reading without a provider", show both optional-store forms, say the fallback is lazy and that a non-literal fallback runs again in the browser on resume, as a store source does), `website/docs/reference-signals.md`, the skill's references, the BRM197 example in `error-catalog.ts`, regenerated error pages (`UPDATE_SKILL=1`), website and examples call sites. `docs/decisions.md`: rewrite the context-no-defaults entry's `$hasContext` part and the `$store` entry, linking the debate. Edit the story's unreleased changesets (store-any-source, has-context, context-no-defaults) instead of adding one.

## Acceptance

- [ ] `$getContext(C, fallback)` returns the fallback without a provider and the provided value with one, on the server, on resume and in browser renders; the fallback function is not called when a provider exists (test with a counter).
- [ ] One provider walk per read: `has`/`hasContext` are gone from the runtime.
- [ ] `$hasContext` is gone from `brumate/signals`, the compiler, types, docs, website, examples and packages/ui.
- [ ] `$store(Ctx)`, `$store(g?.key)`, `$store(undefined)` and `$store(null)` are compile errors naming the fix; a non-store at run time throws a `TypeError`; tests for each.
- [ ] `$store($getContext(C, store(x)))` links the provider's store on resume without running the fallback, and makes one store per reader without a provider (two server requests get two stores).
- [ ] brumate, tsc and ui tests, every package's and example's `test` script, and `node e2e/run.mjs --only ui --no-build` pass.
- [ ] The ui example's client JS gzip before and after; `$hasContext` and `$getContext` counts before and after.

## Sizing

L: compiler, runtime, types and docs, plus about 200 scripted ui reader rewrites.
