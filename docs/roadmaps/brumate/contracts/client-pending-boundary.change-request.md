# Change request: client-pending-boundary v1.2 (additive)

From: browser-loading-fallback (2026-11-02). Adapted locally; the contract is not edited.

## Change

`waits.ts` exports three more functions, from `brumate/client`, next to `wait` and `fillSettled`:

```ts
// The compiled `#loading` of a browser render. `group` is the `#reveal` block of the same render around it.
function loading(body: () => Out, fallback?: () => Out, group?: Reveal): DocumentFragment;

// The memos that markup of a browser render reads and that still load, counted in the boundary of the render.
function countLoads(id: ScopeId | Scope, values: unknown[]): void;

// A `#reveal` block of a browser render: one group, one chain of bodies.
function reveal(order: RevealOrder, collapsed: boolean): Reveal;
```

## Behavior

- `loading` is an owner of `bound`/`give`. With no wait and no turn to wait for, it returns the body's nodes. Otherwise it returns two empty comments around the fallback, sets `done` to put the body in place of the fallback, and sets `f`: a failed wait keeps the fallback, as on the server, and drops the body's held scopes. A block that closed during the hold drops the body.
- A body that `#reveal` holds for its turn, with no wait of its own, gets a boundary that `loading` makes, `{ n: 0, c: writes, o: boundary, w }`, so its work waits as a waiting body's does. This is the one place outside `bound` that makes a `Boundary`.
- `countLoads` does nothing outside a boundary. In one, it counts each thenable with `join`, ends with `leave`, and a rejection with `fail` (once per error and scope, shared with `fillSettled`) then `fault`. Its waits follow the value, not the slot, as `fillSettled` does, so a newer load that a prop starts during the hold does not hold the body.
- The compiler emits `countLoads` after `setSlots` for the memos of a scope that the server waits for where they are declared (`blockingMemos`), and at the start of a `#loading` body for the memos that the body reads from outside (`awaitedMemos`).
- The flag `loading` of features.ts (`__BRUMATE_HAS_LOADING__`) turns `countLoads` into a no-op in builds that render no `#loading` in the browser.

## Why

The frozen interface has the internals for owners of boundaries but no entry for the compiled block. The memos that a body reads without `await` do not wait anywhere, so the boundary needs a way to count them.
