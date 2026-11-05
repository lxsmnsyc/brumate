# Log: store-contract

- Read the spike outcome, the debate and silmaril's stores page. The spike built the context-default form, `Store`, `$toStore`, the plugin and the context-key `$store`. Built here: any source, `let`, codes, gaps.
- Design: `$store(source)` resolves at run time: a context (read through the provider), a store, or an object with the store at `path`. The analyzer finds where the browser gets it again (`Declaration.store`): context key, or the index of an import in the update part's `z` export. Other sources are BRM194.
- `let` writes through `scope.b[slot]` (the setter slot of `$bind`), so `x = next` and `x++` call `store.set`. No write-back effect, so resume never calls `set`.
- Subscriptions write the slot with `writeSlot` (not `set`), and stop in `removeScope` / `leavePage` through `scope.stops`.
- `Store.set` and `sendStore` skip equal values; the provider update forces the send because a signal's `set` stores the value first.
- Outer update of a context with stores is back: `$toStore(x)` is rewritten to `$$b.madeStore($$s, site)`.
- Store origin in the page state moves with `b-offset` (client-routes.ts, in place, by mark `k`).
