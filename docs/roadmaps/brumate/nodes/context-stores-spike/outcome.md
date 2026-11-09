# Outcome: context-stores-spike

## Built

- `brumate/store` (`packages/brumate/src/runtime/store.ts`): `Store<T>` with `get()`, `subscribe(fn)` (returns the stop function, does not call `fn` at once) and `set(value)`; `store(value)`; `isStore`, `isForeignStore` and `sendStore(store, value)`. `sendStore` writes the value and calls the listeners inside the core's pass (`globalThis[Symbol.for('brumate.pass')]`), so every reader of one send updates in one ordered pass.
- `$toStore(x)` (compile time) as a leaf of a `$setContext` value, alone or as a key of an object. The analyzer makes it a `provide` site of its own (node `x`, `site.store`), and the reads inside `$toStore` are untracked for the outer provide site, which gets `holdsStores` and emits no update: the context is static. The store's update is a binding of the provider, where `updateContext` sat: `export function u<id>($$s) { $$b.storeUpdate($$s, <id>, <x>); }`. `$toStore(signal)` marks the signal `bound`, so it keeps a slot and stays live, and the store's `set` writes it. A store of a memo or a prop is read-only (`set` throws).
- `$store(Context)` and `$store(field.key)` for `const field = $getContext(Context)` (compile time, a `context` declaration with a slot). The server records `z: [key, slot, path?]` on the reader's scope; the browser subscribes the slot in `addScopes` and writes `get()` when it differs from the server's value. A browser render calls `$$b.consumeStore(Context, scope, slot, path?)`, which subscribes at once. A reader that left the page unsubscribes on the next send (not through `cleanups`, which `#offscreen` runs while hiding).
- The seroval plugin `brumate/store` (`serial.ts`): `$b.s(value, scope?, site?, slot?)`. Only the value crosses, with where `$toStore` made it. `stateValues.s` makes a new store, and `linkMadeStores` puts it on its scope (`scope.st[site]`) and links `set` to the signal's slot. `callable` turns function references inside a store's value into functions.
- The server refuses a store that is not of brumate/store in a provided value or a key of it: `The context "<key>" holds a store that is not of brumate/store. ...`.
- A module-level store reaches readers as the default value of a context: `createContext('theme', store('light'))`. `createContext` calls a global hook, and the browser links the waiting reads of that key once the module runs. The reader's update part exports `z = [Context]` for each imported context that `$store` reads, so its module runs with the component's code.
- Feature flag `stores` (`HAS_STORES`), found from `$$b.toStore`, `$$b.consumeStore`, `$$ctx.toStore`, `$$ctx.consumeStore` or an import of `brumate/store`.
- Tests: `packages/brumate/test/stores/stores.test.ts` with fixtures in `test/stores/render/`; the size fixture in `test/stores/size/{live,store}/`.

## Result

Gates of the brief:

| Gate                                                                               | Result | Evidence                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resume: a handler field in a store's context crosses as a function reference       | pass   | `storeField`: the context is `{ state: $toStore(state), bump }`. The state record holds `$b.f("StoreField_…#h6", …)` and `$b.s(…)`; clicking the reader's button calls `field.bump()`, and both the provider and the reader show 1, then 2.                                                        |
| Resume: one store keeps one identity across a streamed `#loading` chunk            | pass   | `storeLoading`: a reader outside and one inside the `#loading` body. After the chunk, both readers' `$getContext` slots, the provider's `v['store-picker']` and `provider.st` are the same object (the page state's shared `refs` keep it). A later write reaches both.                            |
| Resume: a module-level store changed since the server render is repaired on resume | pass   | `storeTheme`: the server renders `light`; the browser's module starts at `dark` (a saved value); the reader shows `dark` after resume, and `blue` after `theme.set('blue')`. Failed before the update part imported the context module (`z` export).                                               |
| Resume: a reader that resumes after a `set` reads the current value                | pass   | `storeLoading`: a click writes `a!` before the chunk arrives; the server renders the chunk with `a`; the reader inside it shows `a!` once it resumes.                                                                                                                                              |
| Diamond cases with a provider store from props and memos                           | pass   | `storeDiamond` (memo, the context-plus-middle-prop case), `storeChildren` (memo of a prop, children inserted into the provider), `storeProp` (`$toStore(prop)`): each leaf computes once per click with the new list and the new store value (`pick 3 2`, `kidPick 4 3` and so on), with no error. |
| A user `store().set` writes through the queued context send                        | pass   | `storeUser`: a handler writes `letters` and calls `last.set(...)`; the leaf computes once (`pick 3 2`). A `set` from a timer is one pass of its own (`pick 3 0`).                                                                                                                                  |
| Negative check                                                                     |        | With `sendStore` deferred by a microtask (outside the pass), all four diamond tests fail.                                                                                                                                                                                                          |

Not covered by a gate, built and tested: `$toStore(signal)` whose `set` from a reader writes the provider's signal (`storePicker`), and the foreign store refusal (`storeForeign`).

- result: met. All 6 gates pass; size is reported below.
- reproduce: `npx vitest run test/stores` in packages/brumate (9 tests).

## Size

Gzip -9 of each JS file of `vite build` of `test/stores/size/<way>` (one provider, a `#for` of 42 `Day` readers, `{ selected, focused }` plus a `select` handler). brumate dist built from this branch.

| build                           | core chunk            | App chunk (both components) | rpc chunk (seroval, lazy) | all JS                 |
| ------------------------------- | --------------------- | --------------------------- | ------------------------- | ---------------------- |
| live context, base 98a98c1c     | 6925                  | 468                         | 13525                     | 24410                  |
| live context, this branch       | 6944 (+19)            | 465                         | 13601 (+76)               | 24499 (+89)            |
| store per provider, this branch | 7536 (+592 over live) | 490 (+25)                   | 13601                     | 25123 (+624 over live) |

- An app without stores pays 19 B in the core (gated branches that stay) and 76 B in the lazy serializer chunk (the plugin is always in the list).
- The store way costs about 590 B of core: the `Store` class, `sendStore`, the plugin's `stateValues.s`, `linkMadeStores`, the reader subscribe and repair (`findStore`, `subscribeSlot`, `linkRead`, the waiting reads and the context hook) and `consumeStore`/`toStore`/`storeUpdate`. The debate estimated about 170 B for the plugin alone. The per-reader compiled code is the same size both ways (+25 B for the App chunk).
- Not measured: the page HTML and state. Each reader adds an unpacked record with `z: [["grid",1,"state"]]`, so its slots no longer pack into a group.

## Proposed API and compile shape for store-contract

```ts
// brumate/store
export class Store<T> {
  get(): T;
  subscribe(listener: (value: T) => void): () => void; // no call at once
  set(value: T): void; // throws for a store of a memo or a prop
}
export function store<T>(value: T): Store<T>;

// brumate/signals (compile time)
export function $toStore<T>(value: T): Store<T>; // a memo, a signal or a prop, only in a $setContext value
export function $store<T>(source: Context<Store<T>> | Store<T>): T; // see below for the key form
```

- Provider: `$setContext(Ctx, $toStore(x))` or `$setContext(Ctx, { state: $toStore(x), onPick })`. Server: `$$ctx.provide(Ctx, { state: $$ctx.toStore(x, $$s1, <site>, <signal slot>?), onPick: $$ctx.fn(…) }, $$s1)`. Client update (binding stage): `$$b.storeUpdate($$s, <site>, <x>)`. The outer provide site emits no update.
- Reader: `const value = $store(Ctx)`, or `const field = $getContext(Ctx); const state = $store(field.state);` (one key deep, the Svelte and Solid shape: a static context that holds handlers and stores). Server: `$$ctx.consumeStore(Ctx, $$s1, <slot>, "state"?)`, which records `z`. Browser render: `$$b.consumeStore(...)`. Update part: `export const z = [Ctx]` for imported contexts.
- Page state: `$b.s(value, scope?, site?, slot?)`; the reader's record gets `z: [key, slot, path?][]`.
- Module-level stores: as a context default, `createContext(key, store(v))`. A direct `$store(moduleStore)` without a context is not built: the browser cannot name the store from the page state. store-contract can either keep the context-default form only, or compile `$store(importedStore)` to a resume export of the reader that names the import.
- Error messages without codes yet (store-contract assigns BRM codes): `Read a store with "const name = $store(Context)"`, the same with `at the top level of a script`, `$store takes one argument, the context or a key of its value`, `$toStore takes one argument, a memo, a signal or a prop`.

## Deviations

- Outside the shared paths: `packages/brumate/package.json` (the `./store` export), `tsdown.config.ts` (entry), `vitest.config.ts` (alias), `tsconfig.json` (path of `brumate/store`). `brumate/store` cannot exist without them.
- `test/skill.test.ts` names the 2 new functions and 4 new messages as pending: the error catalog wants a BRM code for each, a numbered resource that this brief reserves none of, and `skills/brumate/references/signals.md` is outside the shared paths. store-contract removes the two `pending` sets.
- `test/scope-ids.test.ts`: the full record has the new field `z`.
- No changeset: the spike is not a feature; store-contract writes it.

## Stubs left

- `$store` takes a context or one key of a `$getContext` value, not any expression, and not a store import (see the proposal).
- `$toStore` only as a leaf of a `$setContext` value (the value, or a key or item of an object or array literal). Elsewhere the analyzer reports nothing and the call stays in the code.
- Stores that `$toStore` made in the browser hold their scope in `scope.st`; nothing removes a scope's stores but the scope itself.

## Gotchas

- A store's origin `o = [scope, site, slot]` holds a scope ID. `SCOPE_IDS` marks `z` as `none`, but the plugin's scope argument is not shifted for client navigation with `b-offset`. store-contract should add the store to the ID table (`holders`) or send the origin as a `SlotReference`.
- The brand of a store is a field `k = 'brumate.store'`, not `Object.defineProperty` with a symbol: a top-level side effect kept the class in every build (+263 B core).
- `createContext` calls a global hook (`Symbol.for('brumate.contextAdded')`) when `HAS_STORES` is on. The browser waits for it to link readers of a store in a default value, because the context module runs only with the component code.
- `$getContext(Ctx)` still records `x[key]` for the live path; with a static store context nothing calls `updateContext`, so it is dead weight until static-contexts-final drops `x`.
- The full packages/brumate suite under a load average of 15 to 27 (other workers) failed 118 tests on timeouts; the reruns of those files pass but for flakes that fail on the base too.

## Proposed learnings

- A module of the runtime that a feature flag guards has no top-level side effect, such as `Object.defineProperty` on a prototype | the bundler keeps the whole class for it | packages/brumate/src/runtime | yes (build the size fixture without stores and grep for the feature's strings)

## Verification

- `npx vitest run test/stores` in packages/brumate: 9 passed.
- `npx vitest run test/stores test/skill.test.ts test/scope-ids.test.ts test/features.test.ts test/feature-flags-off.test.ts test/serial-entry.test.ts`: 98 passed. `test/codegen.test.ts test/render.test.ts test/fixtures.test.ts test/diagnostics.test.ts test/check.test.ts test/order.test.ts`: 255 passed.
- `npx vitest run` (all of packages/brumate) under load: 2688 passed, 118 failed, nearly all 5 s or 10 s timeouts. Rerun of resume, inspect, testing and feature-flags with `--hookTimeout=60000 --maxWorkers=2`: 1240 passed, 2 failed; both pass alone on this branch, and one of them fails alone on the base. `ResolveGoneChild` and `resolveGone` (differential) fail alone on the base too.
- `pnpm lint`: exit 0. `pnpm build && pnpm typecheck`: exit 0. `npx oxfmt --check`: only `docs/debates/0.7.0-cut/ledger.json` and `sealed.json`, which fail the same on the base.
- Not run: `node e2e/run.mjs`, `pnpm bench`, packages/ui tests.

## Size of the node

- Estimated M, actual M.
