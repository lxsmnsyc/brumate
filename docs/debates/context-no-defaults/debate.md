---
goal: Remove default values from the brumate context API so createContext takes only a key and $getContext throws when no provider above set the context
date: 2026-11-05
rounds: 2 of 2
status: approved
roadmap: docs/roadmaps/brumate
supersedes: none
decision: docs/decisions.md, the entry "Contexts have no default value" (on feat/context-stores, e87e290e)
---

# Debate: contexts without default values

The maintainer's motivation (J1): a default value is module-global, so it can leak global state, which contradicts a context API that is meant to be local. On the server a `store(null)` default is one object shared by every request that reads the context without a provider (J5).

## Settled structure

The shape follows Svelte 5.40 (Q1, J13), not Solid 2.0, which keeps optional defaults (J12).

- `createContext(key)` takes only a key, and `Context` has only `key`. `$getContext(C)` throws a named error carrying the key when no provider above set the context, on the server and in the browser. The `defaultValue` fallbacks, the `CONTEXT_ADDED` hook and the `madeContexts` and `waitingReads` maps are deleted. `routeContext` and `navigationContext` lose their defaults, since the runtime provides both to every page. (P1, P13, J8)
- `$hasContext(C)` is a new compile-time function in `brumate/signals`, next to `$getContext`, and returns a boolean. The server walks the scope parents as `$getContext` does; the browser uses `findProvider` on the page state, so the page state gains nothing. Providers are static, so the answer is fixed when the scope is made. (P2, P9, J11)
- Optional reads use `$hasContext` alone. The compiler accepts one guarded `$store` shape, `const x = $hasContext(C) ? $store(C) : undefined`, and the same with `$store(g.state)` when `g` is `$hasContext(C) ? $getContext(C) : undefined`. No extra argument on `$getContext` or `$store`. A fallback such as en-US for the locale is built per reader. (O9, O1)
- Nodes, all inside the context-stores story on `feat/context-stores`, before store-repair-compare (P11, P12, O11):
  - context-throw (M): the core change above, its tests, and the 24 `packages/brumate` test calls.
  - has-context (M): `$hasContext`, the guarded `$store` shape, BRM codes, and server and browser tests, including a provider made by a browser render and a reader in a streamed `#loading` chunk (O12).
  - ui-no-defaults-1 to ui-no-defaults-4 (M each): the about 40 ui contexts and their readers (129 `$store`, 76 `$getContext` calls in about 80 files), split into four file groups of about 20 files. They wait for has-context. The Locale reader falls back to en-US per reader.
  - context-docs (S): `website/docs/context.md`, the 12 website and 4 example calls, `decisions.md` (also the list at line 7), and a minor changeset.
- store-repair-compare drops its item that restores the LocaleContext en-US default store; its other items stay. The story PR to `next` waits for context-docs. (P12)

## Budget

- device: no new tools or services; workers as in earlier ui waves, one ui node at a time since they share story files.
- time: 7 nodes (6 M, 1 S) before the story PR. context-throw can start at once; has-context gates the four ui nodes. (P11, O11)
- tokens: about 7 worker runs plus fresh reviews, in line with earlier M nodes; no measured figure. (P11)

## Rejected

- A fallback argument at the read, `$getContext(C, () => fallback)`: the maintainer chose the Svelte shape (P7, Q1).
- An optional flag, `$getContext(C, true)` and `$store(C, true)`: a second optional-read form beyond `$hasContext` (P10, O8).
- Primitive-only defaults, as Solid 2.0 advises: keeps defaults, not key-only (O6, Q1).
- A factory default `createContext(key, () => value)`: keeps `CONTEXT_ADDED` and is not key-only (P8).
- Landing after the story PR: it would ship `CONTEXT_ADDED` and the Locale default to `next` only to delete them; 0.7.0 has no date (O4, O10).
- A new page-state flag for `$hasContext`: the browser already finds providers (O2, O7, J11).

## Prior art

- Svelte 5.40+ (5.57.3): `createContext()` returns `[get, set, has]`; `get` throws without an ancestor `set` (J13).
- Solid 2.0 (2.0.0-rc.21): `createContext<T>()` throws `ContextNotFoundError` without a Provider, but `createContext(default)` stays, advised for primitives only, because module scope is shared by every request; optional contexts use `null` (J12).

## Open risks

- The four ui nodes run one after another behind has-context, so the 0.7.0 must waits on them (O10): accepted, 0.7.0 has no date.
- Server and browser could answer `$hasContext` differently for providers made after resume (O12): covered by the has-context tests.

## Inferred choices

- Breaking change with no deprecation step, minor bump (J7): from the 0.x rules.
- Lands inside the story, since the story PR is not open and 0.7.0 is unreleased (J6).

## Answers from the user

- How should a part read a context that may have no provider? Follow Svelte: key-only `createContext`, `$getContext` throws, `$hasContext(C)` for optional reads.

## Overruled

- none

## Cost of this debate

- 2 of 2 rounds, about 163k tokens

## Correction after approval

- 2026-11-05: fact J10 (a `$store` source must be a context, a key of a `$getContext` value or an import, else BRM194) was a limit the store-contract worker added, not a rule the maintainer set. It drove the guarded `$store` shapes (O1, O9) and part of the case against P7. The maintainer ruled that `$store` takes any expression, as silmaril's `$store`, Svelte's `$store` and React's `useSyncExternalStore` do. Nodes store-any-source and ui-store-guards follow, before store-repair-compare. The rest of the settled structure stands.
