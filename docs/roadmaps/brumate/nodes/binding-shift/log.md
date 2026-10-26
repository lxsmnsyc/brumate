# Log: binding-shift

- Added `holders` to `SCOPE_IDS`: classes that keep references in their own fields. `Binding` is the first. `shiftState` copies a holder with every own field passed through `shiftValue`, so `ref`, `set` and a reference inside `value` all move. client-routes.ts still imports no code.
- Tests failed on main before the change: the binding move (ref.scope stayed 2) and the holder scan.
- The class scan reads shared.ts for classes with a field that names a reference class, so it no longer depends on the field being called `scope`.
- Size, gzip unminified, `npx tsdown`: produce 3863 to 3934 (+71), client 30903 to 30909 (+6), client-routes (lazy) 1793 to 1818.
