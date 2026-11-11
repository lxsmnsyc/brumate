# Log: derived-stores

## Existing work

`derived` did not exist in `packages/brumate/src/runtime/store.ts` or in the docs on 437a424b. The work was needed.

## Probe

A `.brm` page that reads `$store(total)` and `$store(label)` for module-level `derived` stores (`test/stores/derived/derivedReader.brm`) renders on the server, resumes and updates after `cart.set(...)` and a click. A derived store is a foreign store (`get` and `subscribe`, not a `Store`), which `$store` already reads from an import. No compiler change.

A diamond (`derived([a, derived(a, f)], g)`) ran `g` twice per change in a first version that called `fn` in the source listener: `a`'s listeners run in subscribe order, so the outer store heard `a` before the inner store did and read the old inner value. Fix inside `derived`, as the brief says: a store that hears a source waits, adds a trailing listener to the source's own listener set (a `Set` visits entries added while it iterates, so it runs after the others) and the waiting stores then compute by depth (`level` = 1 + the highest level of the derived sources). `sendStore` is unchanged, so apps that do not import `derived` ship no extra bytes. A source that is not a `Store` has no listener set; the store computes at once.

## Comparison with Svelte 4 (svelte@4.2.19 source, behaviour run on 4.2.18)

Source read: `packages/svelte/src/runtime/store/index.js`, `derived` and `readable`.

| Form                    | Svelte 4                                                                                 | brumate                                                                                    | Same?                         |
| ----------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------- |
| Single store            | `fn(value)`                                                                              | `fn(value)`                                                                                | yes                           |
| Array of stores         | `fn(values[])`                                                                           | `fn(values[])`, typed as a tuple                                                           | yes                           |
| Falsy source            | throws `derived() expects stores as input, got a falsy value`                            | same message                                                                               | yes                           |
| Auto form               | `fn.length < 2`, result is the value                                                     | same                                                                                       | yes                           |
| `(values, set)`         | form chosen by `fn.length >= 2`, may return a cleanup                                    | same                                                                                       | yes                           |
| `(values, set, update)` | `update` is writable's `update`                                                          | `update(change)` writes `change(current)`                                                  | yes                           |
| Cleanup                 | before the next call and on the last unsubscribe                                         | same                                                                                       | yes                           |
| Initial value           | value until `set` or until a subscriber                                                  | value until `set`; `get()` without subscribers gives it for the async form that never sets | yes                           |
| Starts / stops          | first / last subscriber                                                                  | same                                                                                       | yes                           |
| Equality                | `safe_not_equal`: objects always notify (run: a new `{n:1}` notified)                    | `Object.is`                                                                                | no: brumate `Store` contract  |
| Listener at subscribe   | called at once with the value                                                            | not called (store contract)                                                                | no: store contract            |
| `get`                   | `get_store_value` subscribes and unsubscribes (runs `fn` once, cleanup after)            | computes from the sources' `get()` and stops; async form runs once and its cleanup runs    | same effect                   |
| `set` on the result     | none (`readable`)                                                                        | none                                                                                       | yes                           |
| Diamond                 | `fn` runs 3 times, once with the stale inner value (run)                                 | once per change                                                                            | no: the brief asks for it     |
| Pending bit             | `invalidate` marks a source being written, so `fn` waits for the stores written together | the trailing listener and depth order                                                      | different mechanism, same aim |

Not added: `readable`, `writable`, `readonly`, `get`.

## Decisions

- Types: `Stores` and `StoresValues` follow `private.js`, with `StoreLike<any>` in place of `Readable<any>`. The async overload is first, as in Svelte's JSDoc; with the auto overload first, TypeScript did not type the parameters of `(values, set)`.
- `d` (level) is a field on the result, not in the `StoreLike` type.
- The test and render fixtures are in `test/stores/derived/` (new files, not in the brief's owned paths).

## Size

Minified gzip with esbuild, entry importing from `dist/runtime/store.js`: `store` + `sendStore` 335 B on the base, 334 B now; with `derived` 929 B, so `derived` adds 595 B. The todos bench does not import `derived`, so its client JS is unchanged by construction (not run).

## Review fixes

- `start` failing: `started` reset, stops run, the listener is removed, rethrown. Test added.
- `flushComputed` failing: the remaining waiting stores get `waits = false` and the queue empties. Test added.
- Late `set` after the last unsubscribe writes `out.v`; `get()` then gives it (Svelte keeps it). Test added.
- Docs moved to `context.md`; `state.md` keeps a pointer; the once-per-change limit for other libraries is in the docs.
