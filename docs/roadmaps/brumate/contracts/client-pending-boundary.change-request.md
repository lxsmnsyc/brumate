# Change request: client-pending-boundary

## From browser-try (2026-11-02, additive)

Add to the interface in `waits.ts`, exported from `brumate/client`:

```ts
// The body of a `#try` that the browser renders, in a boundary of its own that counts as one
// wait of the boundary around it. Outside a boundary, the body fills in place.
function attempt(body: () => Out): DocumentFragment;
```

Compiled code, in client mode, for a `#try` that has a `t` entry (anchored, `tryCatchesClient`):

```ts
try {
  const $$body3 = () => { ... };
  $$html += $$b.nodes($$b.attempt($$body3));
} catch ($$error2) { ... }
```

Behavior:

- `attempt` is an owner of `bound`/`give`. With no wait, it returns the body. Otherwise it counts once in the boundary around it with `join`, sets `done` to `give` then `leave` that boundary, and sets `f`: it drops the held work of the body, sets `f` to a no-op so later failures of the body end there, and leaves the boundary around it.
- `f` does not render the `#catch` body itself, unlike the line "browser-try sets `f` to show its `#catch` in place of the boundary". `fail` already finds the `#try` through its `t` entry and renders the `#catch` with `catchInto`, also for a `#loading` inside the `#try` and for a child component, a `#for` row and a nested `#try`. A second renderer in `f` would show the `#catch` twice, and `catchInto` in `waits.ts` makes the import cycle that browser-root-boundary hit. So `f` only keeps the failure from reaching a `#loading` around the `#try`, whose own `f` would keep the fallback and drop the body with the `#try` in it.
- `fail` drops an error whose `#try` body was replaced since the error happened (the scope of the body under the block's holder left `scopes`), so two errors of one body at once show the first. This is also a fix for main: two effects of a `#try` body that throw in one update render the `#catch` twice, and the last error stays.
