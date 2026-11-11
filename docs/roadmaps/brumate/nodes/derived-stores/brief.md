---
id: derived-stores
title: derived() for module-level stores
status: active
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.8.0
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/stores/derived.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns:
  - packages/brumate/test/stores/derived.test.ts
shared:
  - packages/brumate/src/runtime/store.ts
  - website/docs/state.md
  - website/docs/context.md
  - website/docs/reference-signals.md
  - docs/decisions.md
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: store-contract
    kind: hard
    why: derived() builds on the Store class, sendStore and the queued write of foreign stores
---

# derived() for module-level stores

## Goal

`brumate/store` exports `derived(sources, fn, initial?)` with the API of Svelte 4's `derived`: a read-only store computed from one store or an array of stores, for state that lives at module level, outside any component. Inside a component, `$toStore` over a `$memo` covers the same need (context-stores-spike).

```ts
import { derived, store } from 'brumate/store';

export const cart = store<number[]>([]);
export const total = derived(cart, (items) => items.reduce((sum, price) => sum + price, 0));
export const label = derived([cart, total], ([items, sum]) => `${items.length} items, ${sum}`);
// The (values, set, update) form, with a cleanup and an initial value.
export const slow = derived(
  cart,
  (items, set) => {
    const timer = setTimeout(() => set(items.length), 100);
    return () => clearTimeout(timer);
  },
  0,
);
```

## Context

- Approved by the maintainer on 2026-11-05, deferred to 0.8.0 because no ui part needs a module-level store (every live context comes from a provider).
- API copied from Svelte 4: [`derived` in svelte@4.2.19](https://github.com/sveltejs/svelte/blob/svelte@4.2.19/packages/svelte/src/runtime/store/index.js) (tag commit 23ec635435ea4c4f51a6946cc9c1f1b351855f79), docs https://svelte.dev/docs/svelte-store#derived. Its rules:
  - `stores` is one store or an array; a falsy entry throws `derived() expects stores as input, got a falsy value`.
  - `fn(values, set, update)`; `values` is the value for a single store and an array for an array. The form is chosen by `fn.length`: fewer than 2 parameters is the auto form (the return value is the new value); 2 or more is the async form (the function calls `set` or `update`, and may return a cleanup function that runs before the next call and when the last subscriber leaves).
  - `initial_value` is the value until `set` is first called (the async form) or until the store has a subscriber.
  - It starts at the first subscriber and stops at the last (`readable(initial, start)`); the sources are subscribed only while it has subscribers.
  - Svelte's stores call a listener at subscribe time and give no `get`. Brumate's contract does not: `StoreLike` has `get()`, and `subscribe(listener)` does not call at once (runtime/store.ts:50-89). Keep brumate's contract: `derived` returns a `StoreLike<T>` without `set`, so `$store(total)` is one-way and `let x = $store(total)` throws as for any store without `set` (outcome of store-contract). Sources are `StoreLike` values (`isContract`), so they can be a `Store`, a `bridge()` store or a foreign store.
- Differences from Svelte to decide in the worker's log, with the reason: equality is `Object.is` as in `Store` (Svelte's `safe_not_equal` notifies for every object); `get()` with no subscriber computes from the sources' `get()` for the auto form and runs the function once and stops for the async form.
- It runs outside the update queue, so it follows the rule for foreign stores (docs/debates/context-stores/debate.md, O10): readers get the value through the queued context send, or the diamond cases of ordered-updates fail. `sendStore` already runs a store's listeners inside the browser's pass (store.ts:176-198), so build the derived value on a `Store` and `sendStore`.
- Resume: it sends nothing. A module-level store is not part of the page state; the browser computes `derived` again from its sources, as the spike's gate for module-level stores changed since the server render requires (outcome of context-stores-spike). A `derived` in a provided value is a foreign store and is refused on the server (decisions.md, `$store` entry); a derived over a `bridge()` is read from the module like any import.
- Tree-shake: `derived` is a plain function export; an app that does not import it ships none of it. Measure the gzip of `brumate/store` with and without it.
- `$store` already takes any expression that gives a store (store-any-source), so `$store(total)` and `$store(derived(a, f))` need no compiler change. Check that, do not assume.

## Steps

- [ ] Probe on `release/0.8` first: a `.brm` page that reads `$store(total)` for `total = derived(cart, ...)` from a module, renders on the server, resumes, and then `cart.set(...)` updates the text. It tests the foreign-store path that derived uses. A diamond (`derived([a, derived(a, f)], g)`) must call `g` once per change of `a` with consistent values; if it does not, the fix is in `derived` (read the sources' `get()` after the pass), not a change to the contract.
- [ ] Implement and type `derived` (overloads for the two forms; a `StoresValues` type that maps a tuple of stores to a tuple of values).
- [ ] Docs and changeset.

## Acceptance

- [ ] `packages/brumate/test/stores/derived.test.ts` covers: one store and an array (values are a value / a tuple); the auto form; the `(values, set, update)` form with a cleanup that runs before the next call and on the last unsubscribe; the initial value before the first `set`; sources subscribed only while there are subscribers; `get()` with and without subscribers; a falsy source throws; a diamond runs `fn` once per change; unchanged results (`Object.is`) do not notify; a foreign `StoreLike` source works.
- [ ] A `.brm` render test: a module-level `derived` read with `$store` renders on the server, resumes, and updates in the browser after the source changes.
- [ ] Server render does not leave a subscription on the module-level sources after the request (count the listeners of the source after a render).
- [ ] The gzip size of an app that does not import `derived` is unchanged (todos client JS, `pnpm bench --only brumate --scenario todos`), and the size added by `derived` is in the outcome.
- [ ] Docs: a section "Derived stores" in website/docs/state.md (beside the stores section) with a sample that `pnpm --filter website check:samples` accepts, a row in website/docs/reference-signals.md or the page that lists `brumate/store`, and one line in website/docs/context.md that points module-level derived values to it. docs/decisions.md has one entry with the Svelte differences.
- [ ] A minor changeset for `brumate` (`.changeset/derived-stores.md`).
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/stores`. Then `pnpm lint`, `pnpm format:check`, `pnpm typecheck`.

## Sizing

S. Uncertainty medium (diamond ordering against the pass; no brumate precedent for a computed store). Everything else low: one source file, one test file, docs.

## Notes for the worker

- Do not add `readable`, `writable` or `get` helpers. Only `derived` was approved.
- Do not add `set` to the result. A writable derived is not part of Svelte 4's API.
- `brumate/store` is a separate entry (package.json "./store"); keep `derived` out of the core chunk and import nothing new into it.
